const { ethers } = require('ethers');
const { CHAIN_CONFIG } = require('../config/chains');
const Logger = require('./logger');

class RPCService {
    constructor() {
        this.currentRpcIndex = 0;
        this.providers = this.initializeProviders();
    }

    initializeProviders() {
        const rpcs = CHAIN_CONFIG.BASE.rpcUrls;
        return rpcs.map(url => {
            try {
                // Gunakan StaticJsonRpcProvider untuk menghindari network detection
                const provider = new ethers.JsonRpcProvider(url, 8453, { staticNetwork: true });
                return provider;
            } catch (error) {
                Logger.error(`Failed to initialize provider for ${url}: ${error.message}`);
                return null;
            }
        }).filter(provider => provider !== null);
    }

    getCurrentProvider() {
        if (this.providers.length === 0) {
            throw new Error('No working RPC providers available');
        }
        return this.providers[this.currentRpcIndex];
    }

    getCurrentRpcUrl() {
        return CHAIN_CONFIG.BASE.rpcUrls[this.currentRpcIndex];
    }

    async switchRPC() {
        const oldIndex = this.currentRpcIndex;
        this.currentRpcIndex = (this.currentRpcIndex + 1) % this.providers.length;
        
        if (this.currentRpcIndex === oldIndex && this.providers.length > 1) {
            this.currentRpcIndex = (this.currentRpcIndex + 1) % this.providers.length;
        }
        
        Logger.rpc(`Switched RPC to: ${this.getCurrentRpcUrl()}`);
        return this.getCurrentProvider();
    }

    async executeWithFallback(operation, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const provider = this.getCurrentProvider();
                const result = await operation(provider);
                return result;
            } catch (error) {
                lastError = error;
                Logger.warning(`RPC attempt ${attempt + 1} failed: ${error.message}`);
                
                if (attempt < maxRetries - 1) {
                    await this.switchRPC();
                    await this.delay(1000);
                }
            }
        }
        
        throw lastError;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = RPCService;