# 🤖 Auto Swap Bot - Multi Aggregator

Bot otomatis untuk melakukan swap **USDT ⇄ USDC** secara bolak-balik di **Base Network** dengan multiple DEX aggregators.

---

## 🚀 Fitur

- **Multi Aggregator Support:** 0x, Uniswap V4, Relay  
- **Auto Random Selection:** Memilih aggregator secara random  
- **Gas Optimization:** Menggunakan gas-efficient routes  
- **Auto Approval:** Approval token otomatis dengan amount maksimal  
- **Fallback System:** Jika satu aggregator gagal, coba yang lain  
- **Clean Logging:** Log informatif dan mudah dibaca  
- **Balance Tracking:** Monitor balance sebelum dan setelah swap  

---

## 📦 Instalasi

### 1️⃣ Clone repository
```bash
git clone <repository-url>
cd multi-aggregator
2️⃣ Install dependencies
bash
Copy code
npm install
3️⃣ Setup environment
bash
Copy code
cp .env.example .env
Edit file .env:

env
Copy code
PRIVATE_KEY=your_private_key_here_without_0x_prefix
⚙️ Konfigurasi
Token Address (Base Network)
javascript
Copy code
USDT: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2
USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Swap Settings
javascript
Copy code
{
  slippage: 0.5,           // 0.5% slippage
  minSwapAmount: 0.1,      // Minimum $0.1 per swap
  maxSwapAmount: 1,        // Maximum $1 per swap  
  swapInterval: 30000,     // 30 detik antara swap
  retryCount: 3            // Retry attempts
}
🛠️ Penggunaan
Jalankan bot:

bash
Copy code
npm start
Contoh output:

text
Copy code
 INITIALIZING SWAP BOT 
[02:54:03] ✅ SUCCESS: Wallet initialized: 0x03432cb5bbA5CCb6B097430097a1a0AA99B880a2
[02:54:05] ℹ️ INFO: USDT Balance: 1.955715
[02:54:05] ℹ️ INFO: USDC Balance: 0.0

 STARTING AUTO SWAP BOT 

 SWAP 1 
[02:54:05] 🔄 SWAP: USDT → USDC | Amount: 0.18 USDT
[02:54:05] ℹ️ INFO: Trying Relay...
[02:54:07] ✅ SUCCESS: Relay: 0.179479 USDC
[02:54:07] ✅ SUCCESS: ✅ Relay selected
[02:54:07] ℹ️ INFO: Executing with Relay...
[02:54:16] ✅ SUCCESS: ✅ USDT → USDC | 0.179479 USDC
[02:54:16] ✅ SUCCESS: TX: 0x1a733439fe11ac3042622632d56303d021c1348a53675010d6d4c11bd53ca77c
[02:54:19] ✅ SUCCESS: ✅ USDC received: 0.179479
[02:54:19] ✅ SUCCESS: Swap completed! Total: 1
🔧 Aggregators
1. 0x API
Provider: 0x Protocol

Features: Best price routing, 150+ liquidity sources

API Key: Required (included in config)

Gas: User pays gas fees

2. Uniswap V4
Provider: Uniswap Protocol V4

Features: Latest Uniswap version, hook support

Gas: User pays gas fees

Approval: Permit2 system

3. Relay
Provider: Relay Protocol

Features: Gasless transactions, subsidized fees

API Key: Not required for quotes

Gas: Sponsored (gasless)

📊 Log Levels
✅ SUCCESS: Transaksi berhasil

🔄 SWAP: Informasi swap

ℹ️ INFO: Status dan balance

⚠️ WARNING: Percobaan ulang atau fallback

❌ ERROR: Gagal dan akan dicoba aggregator lain

🛡️ Keamanan
Private key disimpan di environment variables

Hanya approval untuk contract yang terpercaya

Validasi semua transaksi sebelum eksekusi

Maximum approval untuk menghindari multiple transactions

🔄 Flow Kerja
1️⃣ Initialization
Load wallet dan config

Check balance awal

Initialize semua services

2️⃣ Swap Execution
Pilih direction (USDT→USDC atau USDC→USDT)

Generate random amount

Check balance cukup

3️⃣ Quote Gathering
Coba semua aggregators secara random

Pilih quote terbaik

Auto approval jika diperlukan

4️⃣ Transaction
Execute swap transaction

Wait for confirmation

Verify balance changes

5️⃣ Repeat
Switch direction

Wait interval

Ulangi proses

🐛 Troubleshooting
Common Issues:
Insufficient Balance

Pastikan wallet punya cukup USDT/USDC

Check gas fees untuk native ETH

Approval Failed

Bot akan auto retry dengan aggregator lain

Manual approval mungkin diperlukan pertama kali

RPC Issues

Bot punya 4 RPC fallbacks

Auto switch jika RPC down

Transaction Failed

Biasanya karena slippage terlalu ketat

Bot akan coba aggregator lain

Error Messages:
"No quotes available" → Semua aggregators gagal

"Insufficient balance" → Top up token yang diperlukan

"Transaction failed" → Coba lagi atau kurangi amount

📈 Performance
Success Rate: ~95% (dengan fallback system)

Gas Costs: Optimized untuk Base network

Swap Time: 10–30 detik per swap

Accuracy: Slippage 0.5% untuk stablecoins

🤝 Kontribusi
Pull requests welcome!
Untuk major changes, silakan buka issue terlebih dahulu.

📄 License
MIT License — bebas digunakan untuk personal dan commercial purposes.