const { ethers } = require('ethers');
const { API_CONFIG } = require('../config/chains');
const { TOKEN_CONFIG } = require('../config/tokens');
const Logger = require('./logger');

class RelayService {
    constructor() {
        this.baseURL = API_CONFIG.RELAY.baseURL;
        this.chainId = TOKEN_CONFIG.BASE.chainId;
    }

    async getQuote(sellToken, buyToken, amount, sellSymbol, buySymbol, userAddress) {
        try {
            const sellDecimals = TOKEN_CONFIG.BASE.tokens[sellSymbol].decimals;
            const formattedAmount = ethers.parseUnits(amount.toString(), sellDecimals).toString();

            // **FIXED: Simplified quote data - remove problematic parameters**
            const quoteData = {
                user: userAddress,
                recipient: userAddress,
                originChainId: this.chainId,
                destinationChainId: this.chainId,
                originCurrency: sellToken,
                destinationCurrency: buyToken,
                amount: formattedAmount,
                tradeType: "EXACT_INPUT",
                slippageTolerance: "100", // Increased to 1% for better success
                // **REMOVED: usePermit, useReceiver, subsidizeFees - causing issues**
                enableTrueExactOutput: false,
                protocolVersion: "v1",
                explicitDeposit: false, // Changed to false
                useExternalLiquidity: true, // Enable for more liquidity
                useFallbacks: true,
                // **CRITICAL FIX: Add these parameters**
                disableOriginSwaps: false,
                forceSolverExecution: true, // Force solver execution
                includedSwapSources: ["uniswap-v3", "uniswap-v2", "sushiswap", "curve"]
            };

            Logger.info(`Relay Request: ${formattedAmount} ${sellSymbol} → ${buySymbol}`);

            const response = await fetch(`${this.baseURL}/quote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(quoteData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                Logger.warning(`Relay quote failed: ${response.status} ${JSON.stringify(errorData)}`);
                return null;
            }

            const quote = await response.json();
            
            // Debug information
            if (quote.steps) {
                Logger.info(`Relay steps found: ${quote.steps.map(s => `${s.id}(${s.kind})`).join(', ')}`);
            }

            // **FIXED: Better step detection**
            let executableStep = null;
            for (const step of quote.steps || []) {
                if (step.kind === 'transaction' && step.items && step.items.length > 0) {
                    const item = step.items[0];
                    if (item.data && item.data.to && item.data.data) {
                        executableStep = step;
                        break;
                    }
                }
            }

            if (!executableStep) {
                Logger.warning('No executable transaction step found in Relay response');
                return null;
            }

            const transactionData = executableStep.items[0].data;
            
            // Get output amount from various possible locations
            const buyAmount = this.extractBuyAmount(quote, buySymbol);
            
            if (!buyAmount || buyAmount === "0") {
                Logger.warning('Invalid or zero output amount from Relay');
                return null;
            }

            const buyDecimals = TOKEN_CONFIG.BASE.tokens[buySymbol].decimals;
            const buyAmountFormatted = ethers.formatUnits(buyAmount, buyDecimals);

            Logger.success(`Relay: ${buyAmountFormatted} ${buySymbol}`);

            return {
                service: 'Relay',
                to: transactionData.to,
                data: transactionData.data,
                value: transactionData.value || "0",
                gas: transactionData.gasLimit || "500000", // Increased gas limit
                maxFeePerGas: transactionData.maxFeePerGas,
                maxPriorityFeePerGas: transactionData.maxPriorityFeePerGas,
                buyAmount: buyAmount,
                formattedOutput: `${buyAmountFormatted} ${buySymbol}`,
                requestId: executableStep.requestId
            };

        } catch (error) {
            Logger.warning(`Relay quote error: ${error.message}`);
            return null;
        }
    }

    extractBuyAmount(quote, buySymbol) {
        // Try multiple possible locations for buy amount
        if (quote.details?.currencyOut?.amount) {
            return quote.details.currencyOut.amount;
        }
        if (quote.details?.outputAmount) {
            return quote.details.outputAmount;
        }
        if (quote.buyAmount) {
            return quote.buyAmount;
        }
        
        // Fallback: calculate from steps if possible
        const swapStep = quote.steps?.find(step => step.id === 'swap');
        if (swapStep?.items?.[0]?.data?.minOut) {
            return swapStep.items[0].data.minOut;
        }
        
        return "0";
    }

    async executeSwap(swapData, wallet) {
        try {
            const transaction = {
                to: swapData.to,
                data: swapData.data,
                value: BigInt(swapData.value || "0"),
                gasLimit: BigInt(swapData.gas || "500000") // Match the increased limit
            };

            // Add EIP-1559 support if available
            if (swapData.maxFeePerGas && swapData.maxPriorityFeePerGas) {
                transaction.maxFeePerGas = BigInt(swapData.maxFeePerGas);
                transaction.maxPriorityFeePerGas = BigInt(swapData.maxPriorityFeePerGas);
            }

            Logger.info('Sending Relay transaction...');
            const tx = await wallet.sendTransaction(transaction);
            Logger.success(`Transaction sent: ${tx.hash}`);
            
            return tx;
        } catch (error) {
            throw new Error(`Relay execution failed: ${error.message}`);
        }
    }
}

module.exports = RelayService;