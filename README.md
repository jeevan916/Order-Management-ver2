
# 💎 AuraGold Order & Collection Manager

**AuraGold** is an enterprise-grade backend application designed specifically for **Gold Jewellery Manufacturers and Sellers**.

---

## 🚀 Deployment Guide

### Option 1: Automated (GitHub Actions)
If you have a GitHub repository, push your code to `main`. The included `.github/workflows/deploy.yml` will automatically build and deploy to Hostinger if you configure the Secrets (`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `API_KEY`) in your repository settings.

### Option 2: Manual Upload (Hostinger File Manager)
If you cannot use GitHub, follow these steps to deploy manually:

#### 1. Prepare Environment
1.  Create a file named `.env` in the project root folder.
2.  Add your API Key inside it: `API_KEY=your_actual_api_key_here`

#### 2. Build the App
Run the following commands in your terminal:
```bash
npm install
npm run build
```
This will create a `dist` folder containing the production-ready application.

#### 3. Upload to Hostinger
1.  Log in to your **Hostinger Dashboard**.
2.  Go to **Files > File Manager**.
3.  Navigate to `public_html`.
4.  **Upload** the contents of the `dist` folder (index.html, assets folder, etc.) directly into `public_html`.
5.  Your site is now live!

---

## 🌟 Core Functionality

### 1. Smart Order Generation
*   **Live Rate Integration:** Fetches real-time gold rates.
*   **Complex Pricing:** Calculates Metal Value, VA%, Making Charges, and Tax.

### 2. Advanced Payment Plans
*   **Milestone Generation:** Splits total into installments.
*   **Gold Rate Protection:** Locks rates for customers paying advances.

### 3. WhatsApp Integration
*   **Communication Hub:** Live chat console.
*   **Template Architect:** Create and manage message templates using AI.
*   **Automated Triggers:** Payment receipts and reminders sent automatically.

### 4. System Intelligence
*   **Activity Logging:** Tracks user actions to suggest workflow improvements.
*   **Self-Healing:** Auto-fixes missing templates or configuration errors.
