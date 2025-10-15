const { ethers } = require('ethers');
const RelayService = require('../services/relayService');
const ZeroXService = require('../services/zeroXService');
const UniswapService = require('../services/uniswapService');
const { Helpers } = require('../utils/helpers');
const { TOKEN_CONFIG, SWAP_CONFIG } = require('../config/tokens');
const Logger = require('../services/logger');

class SwapEngine {
    constructor(wallet) {
        this.wallet = wallet;
        this.relayService = new RelayService();
        this.zeroXService = new ZeroXService();
        this.uniswapService = new UniswapService(wallet);
        this.swapCount = 0;
        this.lastSwapDirection = 'USDT_TO_USDC';
        this.approvedTokens = new Set();
    }

    async executeSwap() {
        try {
            Logger.header(`SWAP ${this.swapCount + 1}`);
            
            const { sellToken, buyToken, sellSymbol, buySymbol } = this.getSwapDirection();
            
            // **GUNAKAN MAX BALANCE BUKAN RANDOM AMOUNT**
            const maxAmount = await this.getMaxSwapAmount(sellSymbol);
            
            Logger.swap(`${sellSymbol} → ${buySymbol} | MAX Amount: ${maxAmount} ${sellSymbol}`);

            // Check balance
            await this.checkBalance(sellSymbol, maxAmount);

            // **PRIORITASKAN UNISWAP DULU UNTUK TESTING**
            const bestQuote = await this.getBestPriceQuote(sellToken, buyToken, maxAmount, sellSymbol, buySymbol);
            
            if (!bestQuote) {
                throw new Error('No quotes available from any aggregator');
            }

            await this.executeSwapWithService(bestQuote.service, bestQuote, sellSymbol, buySymbol);
            
            this.swapCount++;
            this.lastSwapDirection = this.lastSwapDirection === 'USDT_TO_USDC' ? 'USDC_TO_USDT' : 'USDT_TO_USDC';
            
            Logger.success(`Swap completed! Total: ${this.swapCount}`);

        } catch (error) {
            Logger.error(`Swap failed: ${error.message}`);
            throw error;
        }
    }

    // **METHOD BARU: GET MAX SWAP AMOUNT (99% dari balance)**
    async getMaxSwapAmount(symbol) {
        try {
            const balance = await this.wallet.getTokenBalance(symbol);
            const decimals = TOKEN_CONFIG.BASE.tokens[symbol].decimals;
            const balanceFormatted = ethers.formatUnits(balance, decimals);
            
            // Gunakan 99% dari balance untuk kasih ruang gas fees
            const maxAmount = Number(balanceFormatted) * 0.99;
            
            // Pastikan amount tidak terlalu kecil
            const minAmount = 0.1; // Minimal 0.1 token
            if (maxAmount < minAmount) {
                throw new Error(`Balance too low for swap. Minimum: ${minAmount} ${symbol}`);
            }
            
            return Number(maxAmount.toFixed(6)); // Presisi 6 decimal
        } catch (error) {
            Logger.error(`Failed to get max swap amount: ${error.message}`);
            throw error;
        }
    }

    async getBestPriceQuote(sellToken, buyToken, amount, sellSymbol, buySymbol) {
        // **UBAH URUTAN: UNISWAP DULU UNTUK TESTING**
        const aggregators = [
            { name: 'Uniswap V4', getQuote: () => this.getUniswapQuote(sellToken, buyToken, amount, sellSymbol, buySymbol) },
            { name: 'Relay', getQuote: () => this.getRelayQuote(sellToken, buyToken, amount, sellSymbol, buySymbol) },
            { name: '0x', getQuote: () => this.get0xQuote(sellToken, buyToken, amount, sellSymbol, buySymbol) }
        ];

        const quotes = [];
        
        // **PROSES SEQUENTIAL - Uniswap dulu untuk testing**
        for (const aggregator of aggregators) {
            try {
                const quote = await aggregator.getQuote();
                if (quote) {
                    quotes.push({
                        ...quote,
                        aggregatorName: aggregator.name
                    });
                    Logger.success(`${aggregator.name}: ${quote.formattedOutput}`);
                    
                    // **JIKA UNISWAP BERHASIL, PAKAI UNISWAP SAJA UNTUK TESTING**
                    if (aggregator.name === 'Uniswap V4') {
                        Logger.success(`🏆 USING UNISWAP V4 FOR TESTING: ${quote.formattedOutput}`);
                        return quote;
                    }
                }
            } catch (error) {
                Logger.warning(`${aggregator.name}: ${error.message}`);
            }
        }

        if (quotes.length === 0) {
            return null;
        }

        // Fallback ke aggregator lain jika Uniswap gagal
        const bestQuote = quotes.reduce((best, current) => {
            const bestAmount = BigInt(best.buyAmount);
            const currentAmount = BigInt(current.buyAmount);
            return currentAmount > bestAmount ? current : best;
        });

        Logger.success(`🏆 BEST: ${bestQuote.aggregatorName} - ${bestQuote.formattedOutput}`);
        return bestQuote;
    }

    async get0xQuote(sellToken, buyToken, amount, sellSymbol, buySymbol) {
        try {
            const sellDecimals = TOKEN_CONFIG.BASE.tokens[sellSymbol].decimals;
            const formattedAmount = ethers.parseUnits(amount.toString(), sellDecimals).toString();
            
            const quoteParams = {
                sellToken,
                buyToken,
                amount: formattedAmount,
                userAddress: this.wallet.address,
                takerAddress: this.wallet.address,
                slippage: SWAP_CONFIG.slippage,
                sellSymbol,
                buySymbol
            };

            const quote = await this.zeroXService.getQuote(quoteParams);
            if (!quote || !quote.to || !quote.data) {
                throw new Error('Invalid quote');
            }

            // **FIXED: Check allowance before approving**
            const needsApproval = await this.checkAllowance(sellToken, sellSymbol, quote.allowanceTarget);
            if (needsApproval) {
                await this.approveToken(sellToken, sellSymbol, quote.allowanceTarget);
            }

            return quote;
            
        } catch (error) {
            throw new Error(`0x: ${error.message}`);
        }
    }

    // Tambahkan method untuk check allowance
    async checkAllowance(tokenAddress, symbol, spender) {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress, 
                ['function allowance(address, address) view returns (uint256)'], 
                this.wallet
            );
            
            const currentAllowance = await tokenContract.allowance(this.wallet.address, spender);
            const requiredAmount = ethers.parseUnits("10000", TOKEN_CONFIG.BASE.tokens[symbol].decimals);
            
            return currentAllowance < requiredAmount;
        } catch (error) {
            Logger.warning(`Allowance check failed: ${error.message}`);
            return true; // Default to needing approval if check fails
        }
    }

    // Method approval yang lebih baik
    async approveToken(tokenAddress, symbol, spender) {
        try {
            Logger.info(`Approving ${symbol} for spender: ${spender}...`);
            
            const tokenContract = new ethers.Contract(
                tokenAddress,
                [
                    'function approve(address spender, uint256 amount) returns (bool)',
                    'function decimals() view returns (uint8)'
                ],
                this.wallet
            );

            const maxAmount = ethers.MaxUint256;
            
            const tx = await tokenContract.approve(spender, maxAmount);
            Logger.info(`Approval sent: ${tx.hash}`);
            
            // Tunggu konfirmasi
            const receipt = await tx.wait();
            if (receipt.status === 1) {
                Logger.success(`✅ ${symbol} approved successfully`);
                return true;
            } else {
                throw new Error('Approval transaction failed');
            }
            
        } catch (error) {
            Logger.error(`Approval failed: ${error.message}`);
            throw error;
        }
    }

    // Dalam SwapEngine - update getUniswapQuote method
    async getUniswapQuote(sellToken, buyToken, amount, sellSymbol, buySymbol) {
        try {
            // **ADDED: Skip Uniswap jika amount terlalu kecil**
            if (amount < 1) {
                throw new Error('Amount too small for Uniswap V4');
            }

            Logger.info(`Trying Uniswap V4 for ${amount} ${sellSymbol}...`);
            
            const quote = await this.uniswapService.getQuote(sellToken, buyToken, amount, sellSymbol, buySymbol);
            if (!quote || !quote.to || !quote.data) {
                throw new Error('No valid pool found');
            }

            // **ADDED: Check if output is reasonable**
            const minExpectedOutput = amount * 0.98; // Minimal 98% dari input
            const actualOutput = parseFloat(quote.formattedOutput.split(' ')[0]);
            
            if (actualOutput < minExpectedOutput) {
                throw new Error('Output amount too low');
            }

            await this.uniswapService.checkAndApprove(sellToken, sellSymbol, amount);
            return quote;

        } catch (error) {
            throw new Error(`Uniswap V4: ${error.message}`);
        }
    }

    // Di dalam SwapEngine class, tambahkan method fallback
    async getRelayQuote(sellToken, buyToken, amount, sellSymbol, buySymbol) {
        try {
            const quote = await this.relayService.getQuote(
                sellToken, buyToken, amount, sellSymbol, buySymbol, this.wallet.address
            );
            
            if (!quote || !quote.to || !quote.data) {
                throw new Error('No valid quote from Relay');
            }

            // Validasi tambahan untuk output amount
            const minExpectedOutput = amount * 0.95; // Minimal 95% dari input
            const actualOutput = parseFloat(quote.formattedOutput.split(' ')[0]);
            
            if (actualOutput < minExpectedOutput) {
                throw new Error('Output amount too low');
            }

            return quote;
            
        } catch (error) {
            throw new Error(`Relay: ${error.message}`);
        }
    }

    // **UPDATE: Tambahkan retry untuk Uniswap khusus**
    async getUniswapQuoteWithRetry(sellToken, buyToken, amount, sellSymbol, buySymbol, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const quote = await this.getUniswapQuote(sellToken, buyToken, amount, sellSymbol, buySymbol);
                if (quote) return quote;
                
                if (i < retries - 1) {
                    Logger.info(`Retrying Uniswap V4 quote... (${i + 1}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        return null;
    }

    async executeSwapWithService(service, quote, sellSymbol, buySymbol) {
        Logger.info(`Executing with ${service}...`);
        
        let receipt;
        if (service === '0x') {
            receipt = await this.execute0xSwap(quote);
        } else if (service === 'Uniswap V4') {
            receipt = await this.uniswapService.executeSwap(quote, sellSymbol, buySymbol);
        } else if (service === 'Relay') {
            receipt = await this.relayService.executeSwap(quote, this.wallet);
        } else {
            throw new Error(`Unknown service: ${service}`);
        }
        
        if (receipt && receipt.status === 1) {
            Logger.success(`✅ ${sellSymbol} → ${buySymbol} | ${quote.formattedOutput}`);
            Logger.success(`TX: ${receipt.hash}`);
            await this.verifySwapResult(sellSymbol, buySymbol);
        } else {
            throw new Error('Transaction failed');
        }
    }

    async execute0xSwap(quoteData) {
        const transaction = {
            to: quoteData.to,
            data: quoteData.data,
            value: BigInt(quoteData.value || "0"),
            gasLimit: BigInt(quoteData.gas || "300000")
        };

        return await this.wallet.sendTransaction(transaction);
    }

    async checkBalance(symbol, requiredAmount) {
        const balance = await this.wallet.getTokenBalance(symbol);
        const decimals = TOKEN_CONFIG.BASE.tokens[symbol].decimals;
        const balanceFormatted = ethers.formatUnits(balance, decimals);
        
        Logger.info(`${symbol} Balance: ${balanceFormatted}`);
        
        if (Number(balanceFormatted) < requiredAmount) {
            throw new Error(`Insufficient ${symbol} balance. Have: ${balanceFormatted}, Need: ${requiredAmount}`);
        }
    }

    async verifySwapResult(sellSymbol, buySymbol) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
            const sellBalance = await this.wallet.getTokenBalance(sellSymbol);
            const buyBalance = await this.wallet.getTokenBalance(buySymbol);
            
            const sellDecimals = TOKEN_CONFIG.BASE.tokens[sellSymbol].decimals;
            const buyDecimals = TOKEN_CONFIG.BASE.tokens[buySymbol].decimals;
            
            const sellFormatted = ethers.formatUnits(sellBalance, sellDecimals);
            const buyFormatted = ethers.formatUnits(buyBalance, buyDecimals);
            
            Logger.info(`Balances - ${sellSymbol}: ${sellFormatted} | ${buySymbol}: ${buyFormatted}`);
            
            if (Number(buyFormatted) > 0) {
                Logger.success(`✅ ${buySymbol} received: ${buyFormatted}`);
            }
        } catch (error) {
            Logger.warning('Balance check failed');
        }
    }

    getSwapDirection() {
        const tokens = TOKEN_CONFIG.BASE.tokens;
        
        if (this.lastSwapDirection === 'USDT_TO_USDC') {
            return {
                sellToken: tokens.USDT.address,
                buyToken: tokens.USDC.address,
                sellSymbol: 'USDT',
                buySymbol: 'USDC'
            };
        } else {
            return {
                sellToken: tokens.USDC.address,
                buyToken: tokens.USDT.address,
                sellSymbol: 'USDC',
                buySymbol: 'USDT'
            };
        }
    }

    async getSwapStats() {
        try {
            const usdtBalance = await this.wallet.getTokenBalance('USDT');
            const usdcBalance = await this.wallet.getTokenBalance('USDC');
            
            return {
                totalSwaps: this.swapCount,
                usdtBalance: ethers.formatUnits(usdtBalance, 6),
                usdcBalance: ethers.formatUnits(usdcBalance, 6),
                nextDirection: this.lastSwapDirection === 'USDT_TO_USDC' ? 'USDC → USDT' : 'USDT → USDC'
            };
        } catch (error) {
            return {
                totalSwaps: this.swapCount,
                usdtBalance: 'Error',
                usdcBalance: 'Error',
                nextDirection: this.lastSwapDirection === 'USDT_TO_USDC' ? 'USDC → USDT' : 'USDT → USDC'
            };
        }
    }
}

module.exports = SwapEngine;