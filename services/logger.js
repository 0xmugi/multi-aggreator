const chalk = require('chalk');
const { format } = require('date-fns');

class Logger {
    static formatTime() {
        return format(new Date(), 'HH:mm:ss');
    }

    static info(message) {
        console.log(chalk.blue(`[${this.formatTime()}] ℹ️  INFO: ${message}`));
    }

    static success(message) {
        console.log(chalk.green(`[${this.formatTime()}] ✅ SUCCESS: ${message}`));
    }

    static warning(message) {
        console.log(chalk.yellow(`[${this.formatTime()}] ⚠️  WARNING: ${message}`));
    }

    static error(message) {
        console.log(chalk.red(`[${this.formatTime()}] ❌ ERROR: ${message}`));
    }

    static swap(message) {
        console.log(chalk.cyan(`[${this.formatTime()}] 🔄 SWAP: ${message}`));
    }

    static rpc(message) {
        console.log(chalk.magenta(`[${this.formatTime()}] 🌐 RPC: ${message}`));
    }

    static price(message) {
        console.log(chalk.yellow(`[${this.formatTime()}] 💰 PRICE: ${message}`));
    }

    static divider() {
        console.log(chalk.gray('─'.repeat(80)));
    }

    static header(title) {
        console.log('\n' + chalk.bgBlue.white.bold(` ${title} `) + '\n');
    }
}

module.exports = Logger;