<div align="center">

<img src="./assets/images/icon.png" alt="Finance & Transactions Tracker" width="120" style="border-radius: 24px;">

# 💰 Finance & Transactions Tracker

**A fully offline, privacy-first Android app that turns your bank SMS into a budget.**
Automatically reads transaction messages to track spending, manage budgets, and monitor net worth across multiple Ethiopian bank accounts.

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

Built for banks that don't offer API access — the app parses SMS notifications from **Commercial Bank of Ethiopia (CBE)** and **TeleBirr** to extract transaction data in real time.

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
- Supports **CBE** and **TeleBirr**, with an extensible parser architecture for adding new banks

### 🏠 Multi-Account Dashboard
- Aggregated net worth across all accounts
- Per-account balance cards with bank branding (logos & colors)
- Monthly income vs. expense summary with spending breakdown
- Spending by category pie chart
- Budget progress overview
- Recent transactions feed

### 📋 Transaction Management
- Full transaction list with **month-by-month filtering**
- Filter by type (Income / Expense) and by category (multi-select)
- Detailed transaction view with editable counterparty, category, and notes
- Manual transaction entry for cash or untracked payments
- Monthly income / expense / net summary bar

### 📊 Budget Tracking
- Set monthly spending limits per category
- Visual progress bars with color-coded status (🟢 green / 🟡 amber / 🔴 red)
- Total budget utilization summary
- Over-budget warnings with exact overage amounts
- Month-to-month navigation

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
- Material 3 inspired design system
- Light and dark mode support (follows system preference)
- Bank-branded account cards (CBE: purple, TeleBirr: blue)
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
| 🎞️ **Animations** | react-native-reanimated |
| 📱 **Native Modules** | Custom Kotlin module for SMS inbox access |
| 🤖 **Platform** | Android only (requires native SMS permissions) |

---

## 📁 Project Structure

```
app/                          # Screens (Expo Router file-based routing)
├── (tabs)/                   # Bottom tab navigator
│   ├── index.tsx             # 🏠 Home / Dashboard
│   ├── transactions.tsx      # 📋 Transaction list with filters
│   ├── budgets.tsx           # 📊 Budget management
│   └── settings.tsx          # ⚙️ Settings & security
├── transaction/
│   ├── [id].tsx              # 🔍 Transaction detail (view/edit)
│   └── add.tsx               # ➕ Manual transaction entry
├── account/
│   └── [id].tsx              # 🏦 Account detail with transactions
└── reconciliation.tsx        # ⚖️ Balance gap resolution

src/
├── db/
│   ├── schema.ts             # 📐 Drizzle ORM table definitions (8 tables)
│   ├── provider.tsx          # 🔌 Database context provider
│   ├── migrations/           # 📦 SQL migration files
│   └── repository/           # 💾 Data access layer (CRUD operations)
├── sms/
│   ├── parsers/
│   │   ├── cbe.ts            # 🏦 CBE SMS parser
│   │   └── telebirr.ts       # 📱 TeleBirr SMS parser
│   ├── dispatcher.ts         # 🔀 Routes SMS to correct parser
│   ├── sync.ts               # 🔄 Sync orchestrator (read → parse → dedupe → insert)
│   └── reader.ts             # 📨 Native SMS inbox access
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

8 normalized tables managed with Drizzle ORM:

- 🏦 **accounts** — bank, account number, custom label, latest balance
- 💳 **transactions** — amount, fees, balance after, counterparty, category, reference, source
- 🏷️ **categories** — name, icon, type (income/expense)
- 📊 **budgets** — per-category monthly spending limits
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

---

## 📸 Screenshots

_Coming soon_

---

## 📄 License

This project is for personal use and portfolio demonstration.
