// services/uniswapService.js
const { ethers } = require('ethers');
const { Token } = require('@uniswap/sdk-core');
const { PoolKey } = require('@uniswap/v4-sdk');
const { UNISWAP_CONFIG } = require('../config/uniswap');
const { TOKEN_CONFIG } = require('../config/tokens');
const Logger = require('./logger');

class UniswapService {
    constructor(wallet) {
        this.wallet = wallet;
        this.provider = wallet.provider;
        
        try {
            this.universalRouter = new ethers.Contract(
                UNISWAP_CONFIG.UNIVERSAL_ROUTER,
                UNISWAP_CONFIG.ABIS.UNIVERSAL_ROUTER,
                wallet
            );
            
            this.quoter = new ethers.Contract(
                UNISWAP_CONFIG.QUOTER_ADDRESS,
                UNISWAP_CONFIG.ABIS.QUOTER,
                this.provider
            );
            
            this.permit2 = new ethers.Contract(
                UNISWAP_CONFIG.PERMIT2,
                UNISWAP_CONFIG.ABIS.PERMIT2,
                wallet
            );
            
            Logger.success('Uniswap V4 contracts initialized');
        } catch (error) {
            Logger.warning(`Uniswap contracts initialization failed: ${error.message}`);
            this.quoter = null;
            this.universalRouter = null;
        }
    }

    async getQuote(sellToken, buyToken, amount, sellSymbol, buySymbol) {
        try {
            if (!this.quoter) {
                throw new Error('Quoter not initialized');
            }

            const sellDecimals = TOKEN_CONFIG.BASE.tokens[sellSymbol].decimals;
            const formattedAmount = ethers.parseUnits(amount.toString(), sellDecimals);

            Logger.info(`Uniswap V4: Getting quote for ${amount} ${sellSymbol} → ${buySymbol}`);

            // **FIXED: Create Token objects untuk SDK**
            const sellTokenObj = new Token(
                UNISWAP_CONFIG.CHAIN_ID,
                sellToken,
                sellDecimals,
                sellSymbol,
                sellSymbol
            );

            const buyTokenObj = new Token(
                UNISWAP_CONFIG.CHAIN_ID,
                buyToken,
                TOKEN_CONFIG.BASE.tokens[buySymbol].decimals,
                buySymbol,
                buySymbol
            );

            // **FIXED: Coba berbagai fee tiers dengan parameter yang benar**
            const fees = [100, 500, 3000];
            let bestQuote = null;
            let bestAmountOut = 0n;

            for (const fee of fees) {
                try {
                    // **FIXED: Create PoolKey dengan format yang benar**
                    const poolKey = {
                        currency0: sellTokenObj.address,
                        currency1: buyTokenObj.address,
                        fee: fee,
                        tickSpacing: this.getTickSpacing(fee),
                        hooks: "0x0000000000000000000000000000000000000000"
                    };

                    // **FIXED: Tentukan direction yang benar**
                    const zeroForOne = sellTokenObj.address.toLowerCase() === poolKey.currency0.toLowerCase();
                    
                    Logger.info(`Trying fee ${fee}bps, zeroForOne: ${zeroForOne}`);

                    // **FIXED: Gunakan callStatic seperti di dokumentasi**
                    const quotedAmountOut = await this.quoter.callStatic.quoteExactInputSingle(
                        poolKey,
                        zeroForOne,
                        formattedAmount,
                        "0x" // Empty hook data
                    );

                    const buyDecimals = TOKEN_CONFIG.BASE.tokens[buySymbol].decimals;
                    const quotedFormatted = ethers.formatUnits(quotedAmountOut, buyDecimals);
                    
                    Logger.info(`Fee ${fee}bps quoted: ${quotedFormatted} ${buySymbol}`);

                    if (quotedAmountOut > bestAmountOut && quotedAmountOut > 0) {
                        bestAmountOut = quotedAmountOut;
                        bestQuote = {
                            poolKey,
                            zeroForOne,
                            amountIn: formattedAmount,
                            amountOut: quotedAmountOut,
                            fee: fee,
                            tickSpacing: this.getTickSpacing(fee)
                        };
                    }
                } catch (error) {
                    Logger.warning(`Fee ${fee}bps failed: ${error.message}`);
                    continue;
                }
            }

            if (!bestQuote) {
                throw new Error('No valid pool found for any fee tier');
            }

            const buyDecimals = TOKEN_CONFIG.BASE.tokens[buySymbol].decimals;
            const buyAmountFormatted = ethers.formatUnits(bestQuote.amountOut, buyDecimals);
            
            // **FIXED: Encode swap data dengan parameter yang benar**
            const swapData = await this.encodeSwapData(bestQuote);
            
            Logger.success(`Uniswap V4: ${buyAmountFormatted} ${buySymbol} (Fee: ${bestQuote.fee}bps)`);

            return {
                service: 'Uniswap V4',
                to: UNISWAP_CONFIG.UNIVERSAL_ROUTER,
                data: swapData,
                value: "0",
                gas: "800000",
                buyAmount: bestQuote.amountOut.toString(),
                formattedOutput: `${buyAmountFormatted} ${buySymbol}`,
                quote: bestQuote
            };

        } catch (error) {
            throw new Error(`Uniswap V4: ${error.message}`);
        }
    }

    // **FIXED: Helper untuk menentukan tick spacing berdasarkan fee**
    getTickSpacing(fee) {
        switch (fee) {
            case 100: return 1;
            case 500: return 10;
            case 3000: return 60;
            default: return 60;
        }
    }

    async encodeSwapData(quote) {
        try {
            // **FIXED: Calculate minimum output dengan slippage**
            const slippage = 50; // 0.5%
            const amountOutMinimum = quote.amountOut * (10000n - BigInt(slippage)) / 10000n;

            // **FIXED: Encode parameters untuk V4_SWAP_EXACT_IN**
            const swapParams = {
                poolKey: quote.poolKey,
                zeroForOne: quote.zeroForOne,
                amountSpecified: quote.amountIn,
                sqrtPriceLimitX96: 0, // No price limit
                hookData: "0x" // No hooks
            };

            // **FIXED: Encode poolKey correctly**
            const poolKeyTypes = [
                'address', 'address', 'uint24', 'int24', 'address'
            ];
            
            const poolKeyValues = [
                swapParams.poolKey.currency0,
                swapParams.poolKey.currency1,
                swapParams.poolKey.fee,
                swapParams.poolKey.tickSpacing,
                swapParams.poolKey.hooks
            ];

            const encodedPoolKey = ethers.AbiCoder.defaultAbiCoder().encode(
                poolKeyTypes,
                poolKeyValues
            );

            // **FIXED: Encode swap parameters**
            const swapTypes = [
                'bytes', // poolKey
                'bool',  // zeroForOne
                'int256', // amountSpecified
                'uint160', // sqrtPriceLimitX96
                'bytes'  // hookData
            ];
            
            const swapValues = [
                encodedPoolKey,
                swapParams.zeroForOne,
                swapParams.amountSpecified,
                swapParams.sqrtPriceLimitX96,
                swapParams.hookData
            ];

            const encodedSwap = ethers.AbiCoder.defaultAbiCoder().encode(swapTypes, swapValues);

            // **FIXED: Command untuk V4 swap (0x04 berdasarkan dokumentasi)**
            const command = "0x04"; // V4_SWAP command
            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
            
            const inputs = [encodedSwap];
            
            return this.universalRouter.interface.encodeFunctionData("execute", [
                command,
                inputs,
                deadline
            ]);

        } catch (error) {
            throw new Error(`Encode failed: ${error.message}`);
        }
    }

    async checkAndApprove(sellToken, sellSymbol, amount) {
        try {
            const tokenDecimals = TOKEN_CONFIG.BASE.tokens[sellSymbol].decimals;
            const amountToApprove = ethers.parseUnits(amount.toString(), tokenDecimals) * 2n;

            // Check ERC20 allowance untuk Universal Router
            const tokenContract = new ethers.Contract(
                sellToken,
                UNISWAP_CONFIG.ABIS.ERC20,
                this.wallet
            );

            const currentAllowance = await tokenContract.allowance(
                this.wallet.address,
                UNISWAP_CONFIG.UNIVERSAL_ROUTER
            );

            if (currentAllowance < amountToApprove) {
                Logger.info(`Approving Universal Router for ${sellSymbol}...`);
                const approveTx = await tokenContract.approve(
                    UNISWAP_CONFIG.UNIVERSAL_ROUTER,
                    ethers.MaxUint256
                );
                
                const receipt = await approveTx.wait();
                if (receipt.status === 1) {
                    Logger.success(`✅ ${sellSymbol} approved for Uniswap`);
                } else {
                    throw new Error('Approval transaction failed');
                }
            }

            return true;

        } catch (error) {
            throw new Error(`Approval failed: ${error.message}`);
        }
    }

    async executeSwap(swapData, sellSymbol, buySymbol) {
        try {
            Logger.info(`Executing Uniswap V4 swap...`);

            const transaction = {
                to: swapData.to,
                data: swapData.data,
                value: 0n,
                gasLimit: 1000000n // **INCREASED: V4 needs more gas**
            };

            const tx = await this.wallet.sendTransaction(transaction);
            Logger.info(`Uniswap V4 transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            Logger.success(`Uniswap V4 transaction confirmed`);
            
            return receipt;

        } catch (error) {
            throw new Error(`Execution failed: ${error.message}`);
        }
    }
}

module.exports = UniswapService;