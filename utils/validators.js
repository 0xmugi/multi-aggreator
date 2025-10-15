const { ethers } = require('ethers');
const { SWAP_CONFIG } = require('../config/tokens');

class Validators {
    static validateAddress(address) {
        return ethers.isAddress(address);
    }

    static validateAmount(amount) {
        const numAmount = Number(amount);
        return !isNaN(numAmount) && 
               numAmount >= SWAP_CONFIG.minSwapAmount && 
               numAmount <= SWAP_CONFIG.maxSwapAmount;
    }

    static validatePrivateKey(pk) {
        try {
            new ethers.Wallet(pk);
            return true;
        } catch {
            return false;
        }
    }

    static validateSlippage(slippage) {
        return slippage >= 0.1 && slippage <= 5;
    }
}

module.exports = { Validators };