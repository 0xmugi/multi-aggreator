const { ethers } = require('ethers');
const { TOKEN_CONFIG } = require('../config/tokens');

class Helpers {
    static formatAmount(amount, decimals = 18) {
        // Untuk token dengan decimals kecil, gunakan toFixed untuk menghindari floating point error
        const fixedAmount = Number(amount).toFixed(decimals);
        return ethers.parseUnits(fixedAmount, decimals);
    }

    static parseAmount(amount, decimals = 18) {
        return ethers.formatUnits(amount, decimals);
    }

    static calculateMinAmount(amount, slippage = 0.5) {
        const slippageFactor = (100 - slippage) / 100;
        return BigInt(Math.floor(Number(amount) * slippageFactor));
    }

    static getTokenAddress(symbol) {
        // Return address langsung tanpa checksum
        return TOKEN_CONFIG.BASE.tokens[symbol].address;
    }

    static getTokenDecimals(symbol) {
        return TOKEN_CONFIG.BASE.tokens[symbol].decimals;
    }

    // static generateRandomAmount(min, max) {
    //     const random = Math.random() * (max - min) + min;
    //     return Math.round(random * 100) / 100;
    // }

    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static formatPercentage(value) {
        return `${(value * 100).toFixed(2)}%`;
    }

    static calculatePriceImpact(buyAmount, expectedAmount) {
        const impact = (Number(expectedAmount) - Number(buyAmount)) / Number(expectedAmount);
        return Math.abs(impact);
    }

    // Helper untuk format amount yang aman
    static safeFormatAmount(amount, decimals = 6) {
        // Batasi decimal places sesuai dengan token decimals
        const fixedAmount = Number(amount).toFixed(decimals);
        return ethers.parseUnits(fixedAmount, decimals);
    }

    // Helper untuk convert ke checksum address dengan error handling
    static toChecksumAddress(address) {
        try {
            return ethers.getAddress(address);
        } catch (error) {
            // Jika gagal, return address asli
            return address;
        }
    }
}

module.exports = { Helpers };