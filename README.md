# StockWise AI

AI-powered inventory management, POS billing, and retail analytics built for small Indian retailers.

## Key Features

- **Real-time Inventory Management**: Add, inline-edit, and delete stock items, or bulk-import spreadsheets (`.csv`, `.xlsx`, `.xls`) with automatic upsert matching by item name.
- **Integrated POS Billing**: Searchable billing cart with live stock-availability validation, automatic stock deduction, and transaction/sales history tracking.
- **AI Retail Assistant**: Powered by Google Gemini or OpenRouter with 30-day sales velocity analysis, 14-day reorder quantity calculations, dead-stock detection, Indian retail seasonal recommendations, and persistent chat history in English, Hindi, and Malayalam.
- **Proactive Low-Stock & Expiry Alerts**: Configurable minimum stock thresholds and 30-day expiry warnings for in-stock items, controlled by user notification preferences.
- **Data Portability**: One-click CSV backup export for stock, bills, and sales, plus full account data reset.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, React Router v7, Tailwind CSS v4, Shadcn UI, Framer Motion, SheetJS (`xlsx`)
- **Backend & Database**: Convex
- **Authentication**: `@convex-dev/auth` (Email OTP via Resend + Anonymous/Guest login)

## Getting Started

### Prerequisites

- Node.js 20+
- `pnpm`

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

**Client (`.env.local`):**

```env
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

**Convex Backend (`npx convex env set <KEY> <VALUE>`):**

- **Authentication**:
  - `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` (can be initialized with `./set-convex-jwt-env.sh`)
  - `RESEND_API_KEY`: Resend API key for Email OTP delivery (if omitted in local development, OTP codes are logged to the Convex console)
  - `AUTH_EMAIL_FROM`: Optional sender address (defaults to `StockWise AI <onboarding@resend.dev>`)
- **AI Assistant**:
  - `GEMINI_API_KEY` (or `GOOGLE_API_KEY` / `OPENROUTER_API_KEY`)
  - Optional: `GEMINI_MODEL` (defaults to `gemini-2.5-flash`) / `OPENROUTER_MODEL`

### 3. Run Locally

Start the Convex development backend:

```bash
npx convex dev
```

In a separate terminal, start the Vite frontend:

```bash
pnpm dev
```

## Project Structure

- `src/pages/`: Route-level pages (`Landing.tsx`, `Auth.tsx`, `Setup.tsx`, `Dashboard.tsx`, `Stock.tsx`, `LowStock.tsx`, `Expiring.tsx`, `NotFound.tsx`)
- `src/components/dashboard/`: Modular dashboard tabs and dialogs (`OverviewTab.tsx`, `InventoryTab.tsx`, `BillingTab.tsx`, `AiChatTab.tsx`, `SettingsTab.tsx`, `AlertsDialog.tsx`)
- `src/convex/`: Convex schema, queries, mutations, and AI actions (`schema.ts`, `stock.ts`, `bills.ts`, `users.ts`, `ai.ts`, `aiActions.ts`, `auth/`)
