require('dotenv').config();
const Wallet = require('./core/wallet');
const SwapEngine = require('./core/swapEngine');
const Logger = require('./services/logger');
const { SWAP_CONFIG } = require('./config/tokens');

class Bot {
    constructor() {
        this.privateKey = process.env.PRIVATE_KEY;
        this.isRunning = false;
        this.swapEngine = null;
    }

    async initialize() {
        try {
            Logger.header('INITIALIZING SWAP BOT');
            
            if (!this.privateKey) {
                throw new Error('PRIVATE_KEY not found in environment variables');
            }

            console.log('Initializing wallet...');
            const wallet = new Wallet(this.privateKey);
            
            console.log('Initializing swap engine...');
            this.swapEngine = new SwapEngine(wallet);
            
            await this.displayBalances();
            
            Logger.success('Bot initialized successfully!');
            return true;
            
        } catch (error) {
            Logger.error(`Initialization failed: ${error.message}`);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    }

    async displayBalances() {
        try {
            const stats = await this.swapEngine.getSwapStats();
            Logger.info(`USDT Balance: ${stats.usdtBalance}`);
            Logger.info(`USDC Balance: ${stats.usdcBalance}`);
            Logger.divider();
        } catch (error) {
            Logger.error(`Balance display failed: ${error.message}`);
            // Jangan exit, lanjutkan tanpa balance display
        }
    }

    async start() {
        if (this.isRunning) {
            Logger.warning('Bot is already running');
            return;
        }

        this.isRunning = true;
        Logger.header('STARTING AUTO SWAP BOT');
        
        let errorCount = 0;
        const maxErrors = 5;

        while (this.isRunning) {
            try {
                await this.swapEngine.executeSwap();
                errorCount = 0;
                
                await this.displayBalances();
                
                Logger.info(`Waiting ${SWAP_CONFIG.swapInterval / 1000} seconds until next swap...`);
                await this.delay(SWAP_CONFIG.swapInterval);
                
            } catch (error) {
                errorCount++;
                Logger.error(`Swap attempt ${errorCount} failed: ${error.message}`);
                
                if (errorCount >= maxErrors) {
                    Logger.error(`Too many consecutive errors. Stopping bot.`);
                    this.stop();
                    break;
                }
                
                await this.delay(10000);
            }
        }
    }

    stop() {
        this.isRunning = false;
        Logger.header('BOT STOPPED');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    Logger.header('SHUTTING DOWN');
    if (bot) {
        bot.stop();
    }
    process.exit(0);
});

// Main execution
const bot = new Bot();

async function main() {
    try {
        await bot.initialize();
        await bot.start();
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run the bot
main();