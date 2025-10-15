// config/uniswap.js
const { ChainId } = require('@uniswap/sdk-core');

const UNISWAP_CONFIG = {
    // **CORRECTED: Base Mainnet Addresses from Uniswap Deployments**
    UNIVERSAL_ROUTER: "0x2626664c2603336E57B271c5C0b26F421741e481", // Universal Router on Base
    QUOTER_ADDRESS: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a", // Quoter on Base
    PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3", // Permit2 (same across chains)
    
    // Chain ID
    CHAIN_ID: ChainId.BASE,
    
    // ABI yang Diperlukan
    ABIS: {
        UNIVERSAL_ROUTER: [
            "function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable"
        ],
        QUOTER: [
            "function quoteExactInputSingle(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint256 amountIn, bytes hookData) external returns (uint256 amountOut)"
        ],
        ERC20: [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function balanceOf(address account) external view returns (uint256)",
            "function allowance(address owner, address spender) external view returns (uint256)"
        ],
        PERMIT2: [
            "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
            "function allowance(address user, address token, address spender) external view returns (uint160 amount, uint48 expiration)"
        ]
    },

    // Pool Fees (in basis points)
    FEES: {
        LOW: 100,    // 0.01%
        MEDIUM: 500, // 0.05%
        HIGH: 3000   // 0.3%
    }
};

module.exports = { UNISWAP_CONFIG };