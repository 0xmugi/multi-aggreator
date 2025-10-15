const CHAIN_CONFIG = {
    BASE: {
        chainId: 8453,
        name: "Base Mainnet",
        explorers: ["https://basescan.org"],
        rpcUrls: [
            "https://1rpc.io/base",
            "https://base.meowrpc.com", 
            "https://base.drpc.org",
            "https://endpoints.omniatech.io/v1/base/mainnet/public"
        ]
    }
};

const API_CONFIG = {
    RELAY: {
        baseURL: "https://api.relay.link",
        apiKey: "" // Hanya butuh untuk execute, quote tidak butuh
    },
    ZEROX: {
        baseURL: "https://api.0x.org",
        apiKey: "26fd47c7-388a-49ad-9088-f6045540efd4"
    }
};

module.exports = { CHAIN_CONFIG, API_CONFIG };