<div align="center">

<img src="./assets/images/icon.png" alt="Finance & Transactions Tracker" width="120" style="border-radius: 24px;">

# 💰 Finance & Transactions Tracker

**A fully offline, privacy-first Android app that turns your bank SMS into a budget.**
Automatically reads transaction messages and exchange emails to track spending, manage budgets, and monitor net worth across multiple accounts and currencies.

<p>
  <img alt="React Native" src="https://img.shields.io/badge/React_Native-0.83-61DAFB?logo=react&logoColor=black">
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK_55-000020?logo=expo&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Drizzle ORM" src="https://img.shields.io/badge/Drizzle_ORM-SQLite-C5F74F?logo=drizzle&logoColor=black">
  <img alt="Zustand" src="https://img.shields.io/badge/Zustand-5-433E38">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white">
</p>

[![Download APK](https://img.shields.io/badge/⬇_Download-latest_APK-2EA043?style=for-the-badge)](https://github.com/KnightDanny/finance-and-transactions-tracker/releases/latest)

[Features](#-features) · [Tech Stack](#-tech-stack) · [Project Structure](#-project-structure) · [Getting Started](#-getting-started) · [Add a Bank](#-adding-a-new-bank-parser)

</div>

Built for banks that don't offer API access — the app parses SMS notifications from **Commercial Bank of Ethiopia (CBE)**, **Bank of Abyssinia (BOA)**, **Awash Bank**, and **TeleBirr** in real time, and can optionally sync transaction emails from **Binance**, **Bybit**, **OKX**, and **Morse** via Gmail.

---

## 📥 Download

> **[⬇️ Download the latest APK](https://github.com/KnightDanny/finance-and-transactions-tracker/releases/latest)**

Grab the latest `.apk` from the [Releases page](https://github.com/KnightDanny/finance-and-transactions-tracker/releases), then install it on your Android device (you may need to allow installs from unknown sources).

---

## ✨ Features

### 📩 Automatic SMS Parsing
- Reads and parses bank SMS messages using a custom native module
- Keyword-based parsing engine (not regex-dependent on exact formats — resilient to SMS format changes)
- Extracts: amount, fees (service charge, VAT, disaster fund), balance, counterparty, reference number, date
- Deduplication via unique reference numbers to prevent double-counting
- Detects transfers between your own accounts and excludes them from income/expense totals
- Supports **CBE**, **BOA**, **Awash Bank**, and **TeleBirr**, with an extensible parser architecture for adding new banks

### 📧 Gmail Transaction Sync
- Optional Google sign-in to import transaction emails from **Binance**, **Bybit**, **OKX**, and **Morse**
- Incremental watermark-based fetching — only new emails are processed
- Balance-anchor guard keeps imported history consistent with your stated balances
- Runs alongside SMS sync on app open

### 💱 Multi-Currency Accounts
- Accounts in any currency (USD, USDT, EUR, …) next to your ETB bank accounts
- Exchange-rates screen with manual overrides and automatic rate fill
- Net worth and summaries converted to ETB; per-item amounts stay in their native currency

### 🏠 Multi-Account Dashboard
- Aggregated net worth across all accounts, loans included
- Customizable, collapsible dashboard sections
- Per-account balance cards with provider branding (logos & colors)
- Income vs. expense summary for the selected period
- Interactive spending donut chart: tap-to-highlight slices, subcategory grouping toggle, persisted period selection (this month / all time / custom range)
- Budget progress overview and recent transactions feed

### 📋 Transaction Management
- Full ledger with date-range and account filters, sticky day headers, and per-row timestamps
- Filter by type (Income / Expense) and by category (multi-select)
- Detailed transaction view with editable counterparty, category, and notes
- **Transaction splits** — divide one transaction across multiple categories, loan repayments, or people
- **Subcategories** — one-level category nesting with two-tier pickers and unique category colors
- Manual transaction entry with a built-in calculator on every amount field
- Transfer pairing for manual person-to-person and own-account transfers
- CSV export

### 📊 Period Budgets
- Monthly-recurring or custom date-range budgets (future periods allowed)
- Include or exclude specific categories and subcategories — or budget all spending, fees included
- Per-category caps inside a budget
- Per-day allowance line so you know what you can spend today
- Pin budgets to the home dashboard
- Full-page budget editor with collapsible sections

### 🤝 Loan Tracking
- Track money lent and borrowed per person, with due dates
- Record repayments/collections; outstanding balance updates automatically
- Per-loan currency with converted totals
- Outstanding loans feed into net worth (lent adds, borrowed subtracts)

### ⚖️ Balance Reconciliation
- Automatically detects gaps between expected and actual balances
- Shows missing transaction details (type, amount, time range)
- Resolve gaps by adding the missing transaction or skipping
- Ensures account balances stay accurate over time

### 🔒 Security
- 6-digit passcode lock with SHA-256 hashing (salted)
- Biometric authentication (fingerprint)
- Configurable auto-lock timeout (immediate, 30s, 1 min, 5 min)
- Passcode stored in Android Keystore via Expo Secure Store
- Lock screen overlay with cooldown after failed attempts

### 🎨 Theming
- Warm, custom design system: champagne-gold accents on ink surfaces, monospaced amounts
- Light and dark mode support (follows system preference)
- Provider-branded account cards (CBE, TeleBirr, BOA, Awash, Binance, Bybit, OKX, Morse)
- Semantic color tokens for income, expense, warnings, and accents

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| ⚛️ **Framework** | React Native 0.83 + Expo SDK 55 |
| 🟦 **Language** | TypeScript (strict mode) |
| 🧭 **Navigation** | Expo Router (file-based routing) |
| 🗄️ **Database** | expo-sqlite + Drizzle ORM |
| 🐻 **State Management** | Zustand |
| 🔐 **Authentication** | expo-secure-store + expo-local-authentication + expo-crypto |
| 📧 **Email Sync** | Google Sign-In + Gmail API |
| 📈 **Charts** | Custom SVG donut chart (react-native-svg) |
| 🎞️ **Animations** | react-native-reanimated |
| 📱 **Native Modules** | Custom Kotlin module for SMS inbox access |
| 🤖 **Platform** | Android only (requires native SMS permissions) |

---

## 📁 Project Structure

```
app/                          # Screens (Expo Router file-based routing)
├── (tabs)/                   # Bottom tab navigator
│   ├── index.tsx             # 🏠 Home / Dashboard
│   ├── transactions.tsx      # 📋 Transaction ledger with filters
│   ├── budgets.tsx           # 📊 Period budgets overview
│   └── settings.tsx          # ⚙️ Settings & security
├── transaction/
│   ├── [id].tsx              # 🔍 Transaction detail (view/edit/split)
│   └── add.tsx               # ➕ Manual transaction entry
├── account/
│   └── [id].tsx              # 🏦 Account detail with transactions
├── budget-editor.tsx         # 📝 Full-page budget create/edit
├── loans.tsx                 # 🤝 Loan tracking
├── manage-accounts.tsx       # 💼 Account & currency management
├── manage-categories.tsx     # 🏷️ Categories & subcategories
├── exchange-rates.tsx        # 💱 Exchange rate management
├── customize-dashboard.tsx   # 🎛️ Dashboard section visibility
└── reconciliation.tsx        # ⚖️ Balance gap resolution

src/
├── db/
│   ├── schema.ts             # 📐 Drizzle ORM table definitions
│   ├── provider.tsx          # 🔌 Database context provider + migrations
│   └── repository/           # 💾 Data access layer (CRUD operations)
├── sms/
│   ├── parsers/              # 🏦 CBE, BOA, Awash, TeleBirr parsers
│   ├── dispatcher.ts         # 🔀 Routes SMS to correct parser
│   ├── sync.ts               # 🔄 Sync orchestrator (read → parse → dedupe → insert)
│   └── reader.ts             # 📨 Native SMS inbox access
├── email/
│   ├── parsers/              # 📧 Binance, Bybit, Morse, OKX email parsers
│   ├── gmail.ts              # 🔑 Google sign-in + Gmail API client
│   ├── dispatcher.ts         # 🔀 Routes emails to correct parser
│   └── sync.ts               # 🔄 Watermark-based email sync
├── reconciliation/
│   └── engine.ts             # ⚙️ Gap detection & resolution algorithm
├── auth/
│   ├── store.ts              # 🔐 Zustand auth state (passcode, biometric, lock)
│   ├── storage.ts            # 🗝️ Secure passcode persistence (hashed + salted)
│   └── biometric.ts          # 👆 Fingerprint authentication wrapper
├── components/               # 🧩 Reusable UI components
└── utils/                    # 🔧 Currency formatting, date parsing, amount extraction

modules/
└── sms-reader/               # 📲 Custom Expo native module (Kotlin)
```

---

## 🗃️ Database Schema

Normalized tables managed with Drizzle ORM:

- 🏦 **accounts** — bank, account number, custom label, currency, latest balance
- 💳 **transactions** — amount, fees, balance after, counterparty, category, reference, source
- ✂️ **transaction_splits** — split one transaction across categories, loans, or people
- 🏷️ **categories** — name, icon, color, type, optional parent (subcategories)
- 📊 **period_budgets** — recurring or custom-range budgets with category include/exclude and caps
- 💱 **currency_rates** — per-currency ETB exchange rates
- 🤝 **loans** / **loan_payments** — lent & borrowed money with repayment history
- 📈 **balance_snapshots** — historical balance records for net worth tracking
- 🤖 **categorization_rules** — keyword-to-category auto-mapping
- ⚖️ **reconciliation_gaps** — detected balance discrepancies with resolution status
- 🕐 **sms_sync_state** — last sync timestamp to avoid reprocessing

---

## 🚀 Getting Started

### Prerequisites

- 📦 Node.js 18+
- 📱 Android device or emulator
- 🔧 [EAS CLI](https://docs.expo.dev/eas/) for building

### Installation

```bash
# Install dependencies
npm install

# Generate native Android project
npx expo prebuild --platform android

# Build development APK
eas build --platform android --profile development

# Start the dev server
npx expo start --dev-client
```

> ⚠️ **Note:** This app requires a custom development build — it cannot run in Expo Go due to native SMS module access.

### Database Migrations

```bash
# Generate migrations after schema changes
npx drizzle-kit generate
```

---

## 🔌 Adding a New Bank Parser

The SMS parsing system is designed to be extensible:

1. Create a new parser in `src/sms/parsers/`
2. Implement the `BankParser` interface (`canParse` + `parse` methods)
3. Register the parser in `src/sms/dispatcher.ts`

```typescript
// Example: src/sms/parsers/newbank.ts
export const newBankParser: BankParser = {
  canParse: (sender: string, body: string) => {
    return sender.includes('NEWBANK') || body.includes('NewBank');
  },
  parse: (sender: string, body: string, timestamp: number) => {
    // Extract transaction data using keyword matching
  },
};
```

Email parsers follow the same pattern in `src/email/parsers/` with their own dispatcher.

---

## 📸 Screenshots

_Coming soon_

---

## 📄 License

This project is for personal use and portfolio demonstration.
