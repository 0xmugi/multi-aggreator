const { ethers } = require('ethers');
const RPCService = require('../services/rpcService');
const Logger = require('../services/logger');
const { Validators } = require('../utils/validators');

class Wallet {
    constructor(privateKey) {
        if (!Validators.validatePrivateKey(privateKey)) {
            throw new Error('Invalid private key');
        }

        this.rpcService = new RPCService();
        this.provider = this.rpcService.getCurrentProvider();
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.address = this.wallet.address;
        
        Logger.success(`Wallet initialized: ${this.address}`);
    }

    async getBalance(tokenAddress = null) {
        try {
            if (tokenAddress) {
                const abi = ['function balanceOf(address) view returns (uint256)'];
                const contract = new ethers.Contract(tokenAddress, abi, this.wallet);
                const balance = await contract.balanceOf(this.address);
                return balance;
            } else {
                return await this.rpcService.getBalance(this.address);
            }
        } catch (error) {
            Logger.error(`Balance check failed: ${error.message}`);
            throw error;
        }
    }

    async getTokenBalance(symbol) {
        const { TOKEN_CONFIG } = require('../config/tokens');
        const token = TOKEN_CONFIG.BASE.tokens[symbol];
        return await this.getBalance(token.address);
    }

    async approveToken(tokenAddress, spender, amount = null) {
        try {
            // Jika amount tidak diberikan, gunakan MAX_UINT256 untuk approval maksimal
            const approveAmount = amount || ethers.MaxUint256;
            
            Logger.info(`Approving ${tokenAddress} for ${spender}...`);
            
            const abi = ['function approve(address, uint256) returns (bool)'];
            const contract = new ethers.Contract(tokenAddress, abi, this.wallet);
            
            const tx = await contract.approve(spender, approveAmount);
            Logger.success(`Approval sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            Logger.success(`Approval confirmed`);
            
            return receipt;
        } catch (error) {
            Logger.error(`Token approval failed: ${error.message}`);
            throw error;
        }
    }

    async sendTransaction(transaction) {
        try {
            Logger.info('Sending transaction...');
            
            const tx = await this.wallet.sendTransaction(transaction);
            Logger.success(`Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            Logger.success(`Transaction confirmed`);
            
            return receipt;
        } catch (error) {
            Logger.error(`Transaction failed: ${error.message}`);
            throw error;
        }
    }

    async getNonce() {
        return await this.rpcService.getTransactionCount(this.address);
    }
}

module.exports = Wallet;