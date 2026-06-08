# Premium Expense Tracker PWA

A modern, production-ready, mobile-first **Expense Tracker Progressive Web App (PWA)** built using **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **Shadcn UI**, and **MongoDB Atlas** (Mongoose). Optimized for personal finance tracking with elegant dark mode aesthetics, offline-first sync engine, passcode security, and data exports.

## Features

- 📱 **Mobile First & PWA Installable**: Glassmorphic, modern responsive UI matching premium fintech apps. Fully installable on iOS and Android.
- 🔒 **Secure PIN Authentication**: Quick 4-digit passcode page that works both online (via HTTP-only cookies) and offline (using client-side local verification).
- 📴 **Offline Caching & Queue Sync**: Full offline support using **IndexedDB**. View recent transactions and add expenses or people while completely disconnected; they queue locally and sync automatically to MongoDB Atlas once connection is restored.
- 📊 **Premium Charts & Analytics**: Custom Recharts visualizations including 12-month trends, category breakdowns (Pie), spending by person (Bar), and payment method distribution.
- 📥 **Flexible Data Exports**: Instant client-side generation and downloading of data reports in **PDF**, **Excel (XLSX)**, and **CSV** formats (functional offline!).
- 🔄 **Backups & Recovery**: Complete database export and import utility to download all transaction schemas as JSON files and restore them in one click.

---

## Folder Structure

```
src/
 ├── app/             # App Router pages, layouts, and API endpoints
 ├── components/      # UI components, modals, tables, and navbars
 ├── hooks/           # Offline sync and browser connection state managers
 ├── lib/             # Mongoose DB connections and IndexedDB wrappers
 ├── models/          # MongoDB schemas (Person, Expense)
 ├── types/           # Core TypeScript type definitions
 └── utils/           # Report exporters (PDF, Excel, CSV)
```

---

## Getting Started

### 1. Setup Environment Configuration

Create a `.env.local` file in the root of the project with the following properties:

```env
# MongoDB Connection URI (Atlas connection string)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/expense-tracker?retryWrites=true&w=majority

# Passcode to unlock the application (4 digits, default is 1234)
APP_PIN=1234

# Node environment state
NODE_ENV=development
```

### 2. Install Dependencies & Run

1. Open your terminal in the project directory.
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the local development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`. Enter the default PIN `1234` to unlock the app.

---

## Offline Synchronization Details

- **Viewing Data**: The application loads the last-cached copy of transactions and people from the browser's IndexedDB store immediately, enabling instantaneous page loads even when offline.
- **Offline Mutations**: When adding an expense or person while offline, a temporary ID (`temp_exp_` or `temp_per_`) is generated, the record is added to the local cache table, and the action is queued in a `sync-queue` store.
- **Automatic Sync**: A background hook monitors the `navigator.onLine` state. When the browser triggers the `online` event, the queue is read, sent as a batch to the `/api/sync` endpoint, resolved on the server (mapping temporary IDs to final MongoDB ObjectId references), and committed to the database.

---

## Vercel Deployment

Deploy this project to Vercel in seconds:
1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Import the project in the [Vercel Dashboard](https://vercel.com).
3. Add `MONGODB_URI` and `APP_PIN` in the **Environment Variables** section.
4. Click **Deploy**. Vercel will build the serverless package and deploy the App Router pages.
