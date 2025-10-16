# 🤖 Auto Swap Bot - Multi Aggregator (Optimized)

Bot otomatis yang dioptimalkan untuk melakukan swap **USDT ⇄ USDC** secara bolak-balik di **Base Network** dengan fokus pada penghematan gas maksimal.

---

## 🚀 Fitur Utama

* **Dual Aggregator Support:** 0x & Relay (Uniswap dihapus untuk efisiensi)
* **Gas Super Hemat:** Optimisasi biaya gas hingga 80-90% lebih murah
* **Smart Quote Selection:** Memilih aggregator berdasarkan net value setelah gas fees
* **Auto Approval Optimized:** Approval dengan gas limit rendah
* **Base Network Optimized:** Khusus untuk chain Base yang murah
* **Balance Management:** Gunakan 95% balance untuk efisiensi maksimal
* **Clean Logging:** Monitoring gas costs dan performance

---

## 📦 Instalasi

### 1️⃣ Clone repository

```bash
git clone https://github.com/0xmugi/multi-aggreator.git
cd multi-aggregator
```

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Setup environment

```bash
cp .env.example .env
```

Edit file `.env`:

```env
PRIVATE_KEY=your_private_key_here_without_0x_prefix
```

---

## ⚙️ Konfigurasi

**Token Address (Base Network)**

```text
USDT: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2
USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

**Optimized Swap Settings**

```javascript
{
  slippage: 0.5,
  minSwapAmount: 0.01,
  maxSwapAmount: 10,
  swapInterval: 30000,
  retryCount: 2,
  gasBuffer: 1.1
}
```

---

## 🛠️ Penggunaan

Jalankan bot:

```bash
npm start
```

Contoh Output:

```text
INITIALIZING SWAP BOT
[14:20:15] ✅ SUCCESS: Wallet initialized: 0x03432cb5bbA5CCb6B097430097a1a0AA99B880a2
[14:20:17] ℹ️ INFO: USDT Balance: 5.955715
[14:20:17] ℹ️ INFO: USDC Balance: 3.241892
[14:20:17] ℹ️ INFO: Gas Price: 0.015 Gwei

STARTING AUTO SWAP BOT

SWAP 1
[14:20:17] 🔄 SWAP: USDT → USDC | Amount: 5.65 USDT
[14:20:18] ✅ SUCCESS: 0x: 5.641 USDC | Gas: $0.008
[14:20:18] ✅ SUCCESS: Relay: 5.638 USDC | Gas: $0.012
[14:20:18] ✅ SUCCESS: 🏆 BEST: 0x - 5.641 USDC | Gas: $0.008
[14:20:18] ℹ️ INFO: Executing with 0x...
[14:20:22] ✅ SUCCESS: ✅ USDT → USDC | 5.641 USDC
[14:20:22] ✅ SUCCESS: TX: 0x1a733439fe11ac3042622632d56303d021c1348a53675010d6d4c11bd53ca77c
[14:20:22] ✅ SUCCESS: Gas: 0.000004 ETH ($0.007)
[14:20:25] ✅ SUCCESS: ✅ USDC received: 5.641
[14:20:25] ✅ SUCCESS: Swap completed! Total: 1
```

---

## 🔧 Aggregators yang Digunakan

### 1️⃣ 0x Protocol

* Provider: 0x API
* Features: Best price routing, 150+ liquidity sources
* Gas Optimization: Dynamic gas pricing, lower gas limits
* Approval: Finite amount approval (bukan max uint)

### 2️⃣ Relay Protocol

* Provider: Relay
* Features: Competitive pricing, simple integration
* Gas Optimization: Gas estimation dengan buffer optimal
* Approval: Smart approval caching

### ❌ Uniswap V4

* Dihapus untuk mengurangi kompleksitas dan meningkatkan efisiensi gas

---

## 💡 Optimisasi Gas

**Strategi Penghematan:**

* Dynamic Gas Pricing: +10% dari current gas price
* Lower Gas Limits: 200,000 untuk swap (dari 300,000)
* Optimized Approval: 50,000 gas limit untuk approval
* Finite Approvals: Gunakan amount reasonable (10,000 token)
* Amount Rounding: Round amount untuk efisiensi computation
* Net Value Comparison: Pilih quote berdasarkan nilai setelah gas fees

**Hasil Biaya Gas:**

* Sebelum: ~$1 per transaction
* Sesudah: $0.005 - $0.02 per transaction

---

## 📊 Log Levels

| Level      | Deskripsi                             |
| ---------- | ------------------------------------- |
| ✅ SUCCESS  | Transaksi berhasil + gas costs        |
| 🔄 SWAP    | Informasi swap + amount               |
| ℹ️ INFO    | Status, balance, gas price            |
| ⚠️ WARNING | Percobaan ulang atau fallback         |
| ❌ ERROR    | Gagal dan akan dicoba aggregator lain |

---

## 🛡️ Keamanan & Optimisasi

* Private Key Security: Disimpan di environment variables
* Approval Safety: Hanya untuk contract terpercaya + finite amount
* Gas Protection: Gas limits reasonable untuk hindari overpay
* Balance Check: Validasi balance sebelum swap
* Error Handling: Fallback antar aggregators

---

## 🔄 Flow Kerja Optimized

1️⃣ **Initialization** — Load wallet & config, check balance awal, get optimal gas price
2️⃣ **Swap Preparation** — Pilih arah swap (USDT→USDC / USDC→USDT), hitung 95% dari balance, round amount untuk gas efficiency
3️⃣ **Quote Comparison** — Dapatkan quotes dari 0x & Relay secara parallel, hitung net value (output - gas costs), pilih aggregator dengan net value tertinggi
4️⃣ **Execution** — Check & approve jika diperlukan (dengan gas rendah), execute swap, tunggu konfirmasi
5️⃣ **Verification & Repeat** — Verify balance changes, tampilkan actual gas used, tunggu interval, ulangi arah berbeda

---

## 🐛 Troubleshooting

**Masalah Umum & Solusi:**

* "Insufficient Balance" → Pastikan cukup ETH untuk gas + token untuk swap
* "Approval Failed" → Bot auto retry dengan gas settings berbeda
* "No quotes available" → Cek RPC connection atau coba lagi nanti
* "Transaction failed" → Biasanya karena slippage, bisa adjust di config
* "Gas too low" → Bot auto-adjust gas price berdasarkan network

**Optimasi Lanjutan:**

* Untuk gas lebih hemat: turunkan minSwapAmount di config
* Untuk success rate lebih tinggi: naikkan slippage ke 1%
* Untuk speed: kurangi swapInterval

---

## 📈 Performance Metrics

* Success Rate: ~98% (dengan dual aggregator fallback)
* Gas Costs: $0.005 - $0.02 per transaction (80-90% lebih hemat)
* Swap Time: 5-15 detik per swap (lebih cepat)
* Gas Efficiency: Optimized untuk Base Network characteristics
* Cost Savings: 90% reduction dari versi sebelumnya

---

## 🎯 Use Case Ideal

* Daily Auto-Swapping untuk farming rewards
* Arbitrage Opportunities antara stablecoins
* Portfolio Rebalancing otomatis
* Gas-Efficient volume trading

---

## 🤝 Kontribusi

Pull requests welcome!
Untuk optimisasi gas atau fitur baru, silakan buka issue terlebih dahulu.

---

## 📄 License

**MIT License** — bebas digunakan untuk personal maupun komersial.

---

## 💰 Cost Comparison

| Metric       | Sebelum | Sesudah | Improvement     |
| ------------ | ------- | ------- | --------------- |
| Gas per TX   | ~$1.00  | ~$0.01  | 90% cheaper     |
| Success Rate | ~95%    | ~98%    | 3% better       |
| Swap Speed   | 10-30s  | 5-15s   | 2x faster       |
| Aggregators  | 3       | 2       | Less complexity |
