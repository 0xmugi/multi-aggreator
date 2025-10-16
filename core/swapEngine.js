const { ethers } = require('ethers');
const RelayService = require('../services/relayService');
const ZeroXService = require('../services/zeroXService');
const { Helpers } = require('../utils/helpers');
const { TOKEN_CONFIG, SWAP_CONFIG } = require('../config/tokens');
const Logger = require('../services/logger');

class SwapEngine {
    constructor(wallet) {
        this.wallet = wallet;
        this.relayService = new RelayService();
        this.zeroXService = new ZeroXService();
        this.swapCount = 0;
        this.lastSwapDirection = 'USDT_TO_USDC';
        this.approvedTokens = new Set();
        this.lastGasPrice = null;
    }

    async executeSwap() {
        try {
            Logger.header(`SWAP ${this.swapCount + 1}`);
            
            const { sellToken, buyToken, sellSymbol, buySymbol } = this.getSwapDirection();
            
            // **OPTIMASI: Gunakan 95% balance untuk kasih ruang gas fees**
            const maxAmount = await this.getOptimizedSwapAmount(sellSymbol);
            
            Logger.swap(`${sellSymbol} → ${buySymbol} | Amount: ${maxAmount} ${sellSymbol}`);

            // Check balance
            await this.checkBalance(sellSymbol, maxAmount);

            // **OPTIMASI: Dapatkan gas price terlebih dahulu**
            await this.updateGasPrice();

            // **OPTIMASI: Bandingkan 0x vs Relay dengan mempertimbangkan gas costs**
            const bestQuote = await this.getBestPriceQuoteWithGas(sellToken, buyToken, maxAmount, sellSymbol, buySymbol);
            
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

    // **OPTIMASI: Method untuk mendapatkan gas price terbaik**
    async updateGasPrice() {
        try {
            const provider = this.wallet.provider;
            
            // Dapatkan current gas price dari network
            const feeData = await provider.getFeeData();
            
            // **STRATEGI GAS HEMAT: Gunakan gas price rendah dengan buffer kecil**
            const currentGasPrice = feeData.gasPrice || feeData.maxFeePerGas;
            
            if (currentGasPrice) {
                // Untuk Base chain yang murah, kita bisa menggunakan gas price yang lebih rendah
                // Tapi beri sedikit buffer untuk memastikan tx diproses
                const optimizedGasPrice = (currentGasPrice * 110n) / 100n; // +10% dari current
                
                this.lastGasPrice = optimizedGasPrice;
                Logger.info(`Gas Price: ${ethers.formatUnits(optimizedGasPrice, 'gwei')} Gwei`);
            }
        } catch (error) {
            Logger.warning(`Failed to update gas price: ${error.message}`);
            // Fallback gas price untuk Base chain
            this.lastGasPrice = ethers.parseUnits('0.01', 'gwei'); // Sangat rendah untuk Base
        }
    }

    // **OPTIMASI: Hitung amount yang optimal untuk swap**
    async getOptimizedSwapAmount(symbol) {
        try {
            const balance = await this.wallet.getTokenBalance(symbol);
            const decimals = TOKEN_CONFIG.BASE.tokens[symbol].decimals;
            const balanceFormatted = ethers.formatUnits(balance, decimals);
            
            // **GUNAKAN 95% DARI BALANCE** (lebih hemat dari 99%)
            const optimizedAmount = Number(balanceFormatted) * 0.95;
            
            // **OPTIMASI: Untuk gas efficiency, gunakan amount yang rounded**
            const roundedAmount = this.roundAmountForGasEfficiency(optimizedAmount, symbol);
            
            // Validasi minimum amount
            const minAmount = 0.01; // Minimal 0.01 token (lebih rendah)
            if (roundedAmount < minAmount) {
                throw new Error(`Balance too low for swap. Minimum: ${minAmount} ${symbol}`);
            }
            
            return roundedAmount;
        } catch (error) {
            Logger.error(`Failed to get optimized swap amount: ${error.message}`);
            throw error;
        }
    }

    // **OPTIMASI: Round amount untuk gas efficiency**
    roundAmountForGasEfficiency(amount, symbol) {
        // Untuk token USD, round ke 2 decimal places
        if (symbol === 'USDT' || symbol === 'USDC') {
            return Number(amount.toFixed(2));
        }
        // Untuk token lain, round ke 6 decimal
        return Number(amount.toFixed(6));
    }

    // **OPTIMASI: Bandingkan quotes dengan mempertimbangkan gas costs**
    async getBestPriceQuoteWithGas(sellToken, buyToken, amount, sellSymbol, buySymbol) {
        const aggregators = [
            { 
                name: '0x', 
                getQuote: () => this.get0xQuoteWithGas(sellToken, buyToken, amount, sellSymbol, buySymbol),
                priority: 1
            },
            { 
                name: 'Relay', 
                getQuote: () => this.getRelayQuoteWithGas(sellToken, buyToken, amount, sellSymbol, buySymbol),
                priority: 2
            }
        ];

        const quotes = [];
        
        // **OPTIMASI: Parallel fetching untuk speed**
        const quotePromises = aggregators.map(async (aggregator) => {
            try {
                const quote = await aggregator.getQuote();
                if (quote) {
                    quotes.push({
                        ...quote,
                        aggregatorName: aggregator.name,
                        priority: aggregator.priority
                    });
                }
            } catch (error) {
                Logger.warning(`${aggregator.name}: ${error.message}`);
            }
        });

        await Promise.allSettled(quotePromises);

        if (quotes.length === 0) {
            return null;
        }

        // **STRATEGI PEMILIHAN: Pertimbangkan net amount setelah gas fees**
        const bestQuote = this.selectBestQuoteByNetValue(quotes, amount);
        
        Logger.success(`🏆 BEST: ${bestQuote.aggregatorName} - ${bestQuote.formattedOutput} | Gas: ${bestQuote.estimatedGasCost || 'N/A'}`);
        return bestQuote;
    }

    // **OPTIMASI: Pilih quote berdasarkan nilai bersih setelah gas fees**
    selectBestQuoteByNetValue(quotes, inputAmount) {
        return quotes.reduce((best, current) => {
            if (!best) return current;
            
            const bestNetValue = this.calculateNetValue(best, inputAmount);
            const currentNetValue = this.calculateNetValue(current, inputAmount);
            
            return currentNetValue > bestNetValue ? current : best;
        });
    }

    // **OPTIMASI: Hitung nilai bersih setelah dikurangi gas fees**
    calculateNetValue(quote, inputAmount) {
        try {
            const outputAmount = parseFloat(quote.formattedOutput.split(' ')[0]);
            const gasCost = quote.estimatedGasCost ? parseFloat(quote.estimatedGasCost) : 0;
            
            // Konversi gas cost ke USD (estimasi kasar untuk Base)
            // Asumsi: 1 USD = 1 USDC/USDT, gas cost dalam USD
            const gasCostUSD = gasCost;
            
            return outputAmount - gasCostUSD;
        } catch (error) {
            // Fallback ke output amount jika calculation gagal
            return parseFloat(quote.formattedOutput.split(' ')[0]);
        }
    }

    async get0xQuoteWithGas(sellToken, buyToken, amount, sellSymbol, buySymbol) {
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
                buySymbol,
                gasPrice: this.lastGasPrice // **OPTIMASI: Gunakan optimized gas price**
            };

            const quote = await this.zeroXService.getQuote(quoteParams);
            if (!quote || !quote.to || !quote.data) {
                throw new Error('Invalid quote');
            }

            // **OPTIMASI: Hitung estimated gas cost**
            quote.estimatedGasCost = await this.estimateGasCost(quote);
            
            // **OPTIMASI: Check allowance dengan strategy yang lebih smart**
            const needsApproval = await this.checkAllowance(sellToken, sellSymbol, quote.allowanceTarget);
            if (needsApproval) {
                await this.approveTokenWithLowGas(sellToken, sellSymbol, quote.allowanceTarget);
            }

            return quote;
            
        } catch (error) {
            throw new Error(`0x: ${error.message}`);
        }
    }

    async getRelayQuoteWithGas(sellToken, buyToken, amount, sellSymbol, buySymbol) {
        try {
            const quote = await this.relayService.getQuote(
                sellToken, buyToken, amount, sellSymbol, buySymbol, this.wallet.address
            );
            
            if (!quote || !quote.to || !quote.data) {
                throw new Error('No valid quote from Relay');
            }

            // **OPTIMASI: Hitung estimated gas cost untuk Relay**
            quote.estimatedGasCost = await this.estimateGasCost(quote);

            // Validasi output amount
            const minExpectedOutput = amount * 0.98; // Minimal 98% dari input
            const actualOutput = parseFloat(quote.formattedOutput.split(' ')[0]);
            
            if (actualOutput < minExpectedOutput) {
                throw new Error('Output amount too low');
            }

            return quote;
            
        } catch (error) {
            throw new Error(`Relay: ${error.message}`);
        }
    }

    // **OPTIMASI: Estimate gas cost dengan lebih akurat**
    async estimateGasCost(quote) {
        try {
            const provider = this.wallet.provider;
            
            const estimatedGas = await provider.estimateGas({
                to: quote.to,
                data: quote.data,
                value: quote.value || 0,
                from: this.wallet.address
            });

            const gasLimit = estimatedGas * 120n / 100n; // Tambah 20% buffer
            const gasCostWei = gasLimit * (this.lastGasPrice || ethers.parseUnits('0.01', 'gwei'));
            const gasCostETH = parseFloat(ethers.formatUnits(gasCostWei, 18));
            
            // Konversi ke USD (estimasi kasar untuk Base - asumsi ETH = $1800)
            const ethToUSD = 1800;
            const gasCostUSD = gasCostETH * ethToUSD;
            
            return Number(gasCostUSD.toFixed(4));
        } catch (error) {
            Logger.warning(`Gas estimation failed: ${error.message}`);
            return 0.01; // Fallback cost
        }
    }

    // **OPTIMASI: Check allowance dengan batas yang reasonable**
    async checkAllowance(tokenAddress, symbol, spender) {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress, 
                ['function allowance(address, address) view returns (uint256)'], 
                this.wallet
            );
            
            const currentAllowance = await tokenContract.allowance(this.wallet.address, spender);
            // **OPTIMASI: Gunakan amount yang reasonable, bukan max**
            const requiredAmount = ethers.parseUnits("1000", TOKEN_CONFIG.BASE.tokens[symbol].decimals);
            
            return currentAllowance < requiredAmount;
        } catch (error) {
            Logger.warning(`Allowance check failed: ${error.message}`);
            return true;
        }
    }

    // **OPTIMASI: Approval dengan gas rendah**
    async approveTokenWithLowGas(tokenAddress, symbol, spender) {
        try {
            if (this.approvedTokens.has(`${tokenAddress}-${spender}`)) {
                Logger.info(`Already approved ${symbol} for this spender`);
                return true;
            }

            Logger.info(`Approving ${symbol} for spender: ${spender}...`);
            
            const tokenContract = new ethers.Contract(
                tokenAddress,
                [
                    'function approve(address spender, uint256 amount) returns (bool)',
                    'function decimals() view returns (uint8)'
                ],
                this.wallet
            );

            // **OPTIMASI: Gunakan amount yang finite, bukan max uint**
            const reasonableAmount = ethers.parseUnits("10000", TOKEN_CONFIG.BASE.tokens[symbol].decimals);
            
            const tx = await tokenContract.approve(spender, reasonableAmount, {
                gasPrice: this.lastGasPrice,
                gasLimit: 50000 // Gas limit khusus untuk approval
            });
            
            Logger.info(`Approval sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            if (receipt.status === 1) {
                Logger.success(`✅ ${symbol} approved successfully`);
                this.approvedTokens.add(`${tokenAddress}-${spender}`);
                return true;
            } else {
                throw new Error('Approval transaction failed');
            }
            
        } catch (error) {
            Logger.error(`Approval failed: ${error.message}`);
            throw error;
        }
    }

    async executeSwapWithService(service, quote, sellSymbol, buySymbol) {
        Logger.info(`Executing with ${service}...`);
        
        let receipt;
        if (service === '0x') {
            receipt = await this.execute0xSwapWithLowGas(quote);
        } else if (service === 'Relay') {
            receipt = await this.relayService.executeSwap(quote, this.wallet);
        } else {
            throw new Error(`Unknown service: ${service}`);
        }
        
        if (receipt && receipt.status === 1) {
            const actualGasUsed = ethers.formatUnits(receipt.gasUsed * receipt.gasPrice, 18);
            Logger.success(`✅ ${sellSymbol} → ${buySymbol} | ${quote.formattedOutput}`);
            Logger.success(`TX: ${receipt.hash} | Gas: ${actualGasUsed} ETH`);
            await this.verifySwapResult(sellSymbol, buySymbol);
        } else {
            throw new Error('Transaction failed');
        }
    }

    // **OPTIMASI: Execute 0x swap dengan gas rendah**
    async execute0xSwapWithLowGas(quoteData) {
        const transaction = {
            to: quoteData.to,
            data: quoteData.data,
            value: BigInt(quoteData.value || "0"),
            gasLimit: BigInt(quoteData.gas || "200000"), // **OPTIMASI: Lower gas limit**
            gasPrice: this.lastGasPrice // **OPTIMASI: Gunakan optimized gas price**
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
        // **OPTIMASI: Tunggu lebih singkat untuk Base chain**
        await new Promise(resolve => setTimeout(resolve, 3000));
        
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
                nextDirection: this.lastSwapDirection === 'USDT_TO_USDC' ? 'USDC → USDT' : 'USDT → USDC',
                currentGasPrice: this.lastGasPrice ? ethers.formatUnits(this.lastGasPrice, 'gwei') + ' Gwei' : 'N/A'
            };
        } catch (error) {
            return {
                totalSwaps: this.swapCount,
                usdtBalance: 'Error',
                usdcBalance: 'Error',
                nextDirection: this.lastSwapDirection === 'USDT_TO_USDC' ? 'USDC → USDT' : 'USDT → USDC',
                currentGasPrice: 'N/A'
            };
        }
    }
}

module.exports = SwapEngine;
