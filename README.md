🤖 Auto Swap Bot - Multi Aggregator

Bot otomatis untuk melakukan swap USDT ⇄ USDC secara bolak-balik di Base Network dengan multiple DEX aggregators.

🚀 Fitur

Multi Aggregator Support: 0x, Uniswap V4, Relay

Auto Random Selection: Memilih aggregator secara random

Gas Optimization: Menggunakan gas-efficient routes

Auto Approval: Approval token otomatis dengan amount maksimal

Fallback System: Jika satu aggregator gagal, coba yang lain

Clean Logging: Log informatif dan mudah dibaca

Balance Tracking: Monitor balance sebelum dan setelah swap

📦 Instalasi

1️⃣ Clone repository
git clone <repository-url> && cd multi-aggregator

2️⃣ Install dependencies
npm install

3️⃣ Setup environment
cp .env.example .env
Lalu edit file .env:
PRIVATE_KEY=your_private_key_here_without_0x_prefix

⚙️ Konfigurasi

Token Address (Base Network)
USDT: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2
USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

Swap Settings:
{ slippage: 0.5, minSwapAmount: 0.1, maxSwapAmount: 1, swapInterval: 30000, retryCount: 3 }

🛠️ Penggunaan

Jalankan bot:
npm start

Contoh output:

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

0x API — Best price routing, 150+ liquidity sources (API key required)

Uniswap V4 — Latest version with hook support, Permit2 system

Relay — Gasless swaps (sponsored gas, no API key)

📊 Log Levels

✅ SUCCESS: Transaksi berhasil
🔄 SWAP: Informasi swap
ℹ️ INFO: Status dan balance
⚠️ WARNING: Percobaan ulang atau fallback
❌ ERROR: Gagal dan akan dicoba aggregator lain

🛡️ Keamanan

Private key disimpan di environment variables

Approval hanya untuk contract terpercaya

Validasi transaksi sebelum eksekusi

Maximum approval untuk efisiensi

🔄 Flow Kerja

1️⃣ Initialization → Load wallet & config → Check balance → Init services
2️⃣ Swap Execution → Pilih arah swap → Generate random amount → Cek balance
3️⃣ Quote Gathering → Coba semua aggregator → Pilih quote terbaik → Approval otomatis
4️⃣ Transaction → Eksekusi → Tunggu konfirmasi → Cek perubahan balance
5️⃣ Repeat → Ganti arah → Tunggu interval → Ulangi

🐛 Troubleshooting

Insufficient Balance: Top up token & cek gas ETH
Approval Failed: Auto retry / lakukan manual pertama kali
RPC Issues: Bot auto switch ke RPC lain
Transaction Failed: Coba lagi / longgarkan slippage
Error umum:

“No quotes available” → Semua aggregator gagal

“Insufficient balance” → Saldo tidak cukup

“Transaction failed” → Coba ulang atau kurangi jumlah

📈 Performance

Success Rate: ~95%

Gas: Optimized for Base

Swap Time: 10–30 detik

Slippage: 0.5% (stablecoins)

🤝 Kontribusi

Pull request dipersilakan. Untuk perubahan besar, buka issue terlebih dahulu.

📄 License

MIT License — bebas digunakan untuk personal & commercial purposes.