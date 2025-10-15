const { ethers } = require('ethers');
const { API_CONFIG } = require('../config/chains');
const { TOKEN_CONFIG } = require('../config/tokens');
const Logger = require('./logger');

class ZeroXService {
    constructor() {
        this.baseURL = API_CONFIG.ZEROX.baseURL;
        this.apiKey = API_CONFIG.ZEROX.apiKey;
        this.enabled = !!this.apiKey;
        
        if (this.enabled) {
            Logger.info('0x service enabled with API key');
        } else {
            Logger.warning('0x service disabled - no API key');
        }
    }

    async getPrice(params) {
        if (!this.enabled) {
            throw new Error('0x API key not configured');
        }

        const url = `${this.baseURL}/swap/allowance-holder/price`;
        
        const searchParams = new URLSearchParams({
            chainId: TOKEN_CONFIG.BASE.chainId.toString(),
            sellToken: params.sellToken,
            buyToken: params.buyToken,
            sellAmount: params.amount.toString(),
            taker: params.takerAddress,
            slippagePercentage: (params.slippage || 0.5).toString()
        });

        try {
            Logger.info(`Getting price from 0x: ${params.sellSymbol} -> ${params.buySymbol}`);
            
            const headers = {
                '0x-api-key': this.apiKey,
                '0x-version': 'v2'
            };

            const response = await fetch(`${url}?${searchParams.toString()}`, { headers });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`0x API error: ${response.status} ${errorText}`);
            }

            const priceData = await response.json();
            
            // Debug response structure
            Logger.info(`0x price response keys: ${Object.keys(priceData).join(', ')}`);
            
            if (priceData.validation && priceData.validation.errors) {
                throw new Error(`0x validation errors: ${JSON.stringify(priceData.validation.errors)}`);
            }

            // Format buy amount untuk display
            const buyDecimals = TOKEN_CONFIG.BASE.tokens[params.buySymbol].decimals;
            const buyAmountFormatted = ethers.formatUnits(priceData.buyAmount, buyDecimals);
            
            Logger.price(`0x price: ${buyAmountFormatted} ${params.buySymbol}`);
            
            return priceData;
        } catch (error) {
            Logger.error(`0x price check failed: ${error.message}`);
            throw error;
        }
    }

    async getQuote(params) {
        if (!this.enabled) {
            throw new Error('0x API key not configured');
        }

        const url = `${this.baseURL}/swap/allowance-holder/quote`;
        
        const searchParams = new URLSearchParams({
            chainId: TOKEN_CONFIG.BASE.chainId.toString(),
            sellToken: params.sellToken,
            buyToken: params.buyToken,
            sellAmount: params.amount.toString(),
            taker: params.takerAddress,
            slippagePercentage: (params.slippage || 0.5).toString()
        });

        try {
            Logger.info(`Getting quote from 0x...`);
            
            const headers = {
                '0x-api-key': this.apiKey,
                '0x-version': 'v2'
            };

            Logger.info(`0x Request URL: ${url}?${searchParams.toString()}`);

            const response = await fetch(`${url}?${searchParams.toString()}`, { headers });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`0x quote error: ${response.status} ${errorText}`);
            }

            const quote = await response.json();
            
            // Debug response structure
            Logger.info(`0x quote response keys: ${Object.keys(quote).join(', ')}`);
            
            if (quote.validation && quote.validation.errors) {
                throw new Error(`0x validation errors: ${JSON.stringify(quote.validation.errors)}`);
            }

            // Validasi response quote
            if (!quote) {
                throw new Error('Empty response from 0x');
            }

            // Cek struktur response berdasarkan dokumentasi 0x
            let transactionData = null;
            let toAddress = null;
            let value = "0";

            // Coba berbagai kemungkinan struktur response
            if (quote.transaction) {
                // Struktur: { transaction: { to, data, value } }
                transactionData = quote.transaction.data;
                toAddress = quote.transaction.to;
                value = quote.transaction.value || "0";
            } else if (quote.to && quote.data) {
                // Struktur: { to, data, value }
                transactionData = quote.data;
                toAddress = quote.to;
                value = quote.value || "0";
            } else {
                // Log seluruh response untuk debugging
                Logger.warning(`Unexpected 0x response structure: ${JSON.stringify(quote).substring(0, 500)}`);
                throw new Error('Unexpected response structure from 0x API');
            }

            if (!toAddress) {
                throw new Error('Missing "to" address in 0x quote response');
            }

            if (!transactionData || transactionData === '0x') {
                throw new Error('Invalid transaction data in 0x quote response');
            }

            // Format buy amount untuk display
            const buyDecimals = TOKEN_CONFIG.BASE.tokens[params.buySymbol].decimals;
            const buyAmountFormatted = ethers.formatUnits(quote.buyAmount, buyDecimals);
            
            Logger.success(`0x quote received: ${buyAmountFormatted} ${params.buySymbol}`);
            
            return {
                ...quote,
                service: '0x',
                buyAmount: quote.buyAmount,
                to: toAddress,
                data: transactionData,
                value: value,
                gas: quote.gas || "300000",
                allowanceTarget: quote.allowanceTarget,
                formattedOutput: `${buyAmountFormatted} ${params.buySymbol}`
            };
        } catch (error) {
            Logger.error(`0x quote failed: ${error.message}`);
            throw error;
        }
    }
}

module.exports = ZeroXService;