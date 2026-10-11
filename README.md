# Aster POS — Web & Mobile Manager Guide

This project is built with React, Vite, Tailwind CSS, and Dexie (IndexedDB) with full PWA and Android Capacitor support. It can be deployed directly to **Vercel** as a live web application so managers can access reports, dashboard, menu, and inventory from any browser (Mac, PC, iPhone, iPad, Android).

---

## Deploying to Vercel

### Option 1: Via GitHub / GitLab / Bitbucket (Recommended)
1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Aster POS"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **Add New...** &gt; **Project**.
4. Import your GitHub repository.
5. Vercel automatically detects the Vite configuration:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Click **Deploy**. Your site will be live at `https://your-project.vercel.app`!

### Option 2: Deploying via Vercel CLI
If you prefer deploying directly from your terminal:
```bash
npx -y vercel
```
- When prompted, log in with your Vercel account.
- Select `Y` to link to your project.
- For production deployment, run:
```bash
npx -y vercel --prod
```

---

## Manager Web Access & Activation

1. **Initial License Activation**:
   - The first time you open the website on a new browser, enter the Product Key:
     ```
     AIRL092918
     ```
2. **Default Manager Credentials**:
   - **PIN**: `123456` (or create your own in Super Admin Settings)
   - **Super Admin PIN**: `999900`
3. **Manager Modules Available on Web**:
   - 📊 **Dashboard & Analytics**: Live revenue, peak hours, hourly sales trends, top-selling categories.
   - 📦 **Inventory Management**: Stock tracking, safety thresholds, supplier costs, and adjustment audit logs.
   - 📜 **Sales History & Void Logs**: Full transaction logs, receipt viewing, and void authorizations.
   - 🍽️ **Menu & Recipe Editor**: Add products, pricing, ingredients, and categories.
   - 📶 **Wi-Fi Sync Module**: Connect to the Main Counter POS register over local Wi-Fi / LAN to receive live orders and stock updates in real time.
   - ⚙️ **Settings & Staff Management**: Add staff accounts, configure Gmail OTP gateways, and backup/restore data.
