const TOKEN_CONFIG = {
    BASE: {
        chainId: 8453,
        nativeToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        tokens: {
            USDT: {
                // USDT asli di Base
                address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
                decimals: 6,
                symbol: "USDT"
            },
            USDC: {
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                decimals: 6,
                symbol: "USDC"
            }
        }
    }
};

const SWAP_CONFIG = {
    slippage: 1, // 0.5% slippage
    swapInterval: 30000,
    retryCount: 3
};

module.exports = { TOKEN_CONFIG, SWAP_CONFIG };