# Telegram Voting Bot Dashboard

## Overview
A Telegram voting bot with a web dashboard for managing voting campaigns. The system tracks votes from delegates and supervisors across multiple centers (طما، طهطا، جهينة) using Google Sheets as the backend database.

## Project Architecture

### Components
1. **Web Dashboard** (`src/dashboard.js`)
   - Express.js web server on port 5000
   - Basic authentication for admin access
   - Real-time voting statistics and charts
   - Delegate and supervisor management
   - CSV export functionality

2. **Telegram Bot** (`src/bot.js`)
   - Node.js Telegram bot for delegates and supervisors
   - Voter list management with pagination
   - Vote recording (VOTED, NOT_VOTED, INVALID)
   - Pinned status messages for progress tracking

3. **Google Sheets Backend** (`src/sheets.js`)
   - Sheets: Delegates, Supervisors, Voters, Votes, Settings
   - Google Sheets API integration for data storage
   - Supports multiple authentication methods

### Technology Stack
- **Runtime**: Node.js (ES Modules)
- **Web Framework**: Express.js
- **Bot Library**: node-telegram-bot-api
- **Database**: Google Sheets (via googleapis)
- **Authentication**: express-basic-auth
- **Styling**: Inline CSS with Cairo font (Arabic support)
- **Charts**: Chart.js

## Configuration

### Required Environment Variables
- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather
- `DASHBOARD_USER`: Dashboard login username (default: admin)
- `DASHBOARD_PASS`: Dashboard login password (default: admin123)
- `GOOGLE_SHEETS_SPREADSHEET_ID`: Google Sheets spreadsheet ID
- `GOOGLE_CREDENTIALS`: JSON credentials for Google service account
- `PORT`: Server port (default: 5000)

### Google Sheets Setup
The system expects the following sheets in the spreadsheet:
- **Delegates**: userId, name, center, village, supervisorId
- **Supervisors**: userId, name, center
- **Voters**: name, nationalId, rollNumber, center, village
- **Votes**: timestamp, delegateUserId, voterNationalId, status, center, village
- **Settings**: key-value pairs for configuration

## Recent Changes
- **2025-10-20**: إعادة بناء لوحة التحكم بتصميم مؤسسي احترافي + إحصائيات تفصيلية
  - تصميم جديد كامل مع قائمة جانبية (Sidebar) ونظام تنقل احترافي
  - صفحة تسجيل دخول محسّنة مع تأثيرات بصرية متقدمة
  - بطاقات إحصائية تفاعلية مع أيقونات ملونة وتدرجات
  - رسوم بيانية محسّنة باستخدام Chart.js
  - **إحصائيات تفصيلية لكل مندوب ومشرف:**
    - عدد الناخبين المسجلين
    - عدد الأصوات الصحيحة (تم التصويت)
    - عدد الأصوات الباطلة
    - عدد من لم يصوتوا
    - عدد الأصوات المتبقية
    - النسبة المئوية للإنجاز (مع شريط تقدم مرئي)
  - جداول احترافية مع تصميم عصري وإحصائيات شاملة
  - نظام فلترة محسّن وسهل الاستخدام
  - تصميم متجاوب (Responsive) للجوال والأجهزة اللوحية
  - نظام ألوان CSS variables منظم ومتناسق
  - تأثيرات Hover و Transitions سلسة
  - إضافة Cache-Control headers لمنع التخزين المؤقت
  - تحسينات أمنية: التحقق الإلزامي من SESSION_SECRET
  - إضافة صفحة /setup-help لمساعدة المستخدمين
  - حفظ جميع الوظائف الأساسية (CRUD، تصدير CSV، الفلاتر)

- **2025-10-19**: Imported from GitHub and configured for Replit environment
  - Updated server to bind to 0.0.0.0:5000 for Replit proxy compatibility
  - Changed default PORT from 3000 to 5000
  - Configured Replit Secrets for GOOGLE_CREDENTIALS and PORT
  - Removed old .env file to prevent conflicts with Replit Secrets
  - Fixed centerStats undefined bug in dashboard.js
  - Set up Dashboard workflow on port 5000
  - Created replit.md documentation

## User Preferences
None specified yet.

## Development

### Running Locally
```bash
npm install
npm start  # Dashboard
npm run bot  # Telegram bot
```

### NPM Scripts
- `npm start`: Start dashboard server
- `npm run bot`: Start Telegram bot
- `npm run dev`: Development mode with nodemon

## Notes
- The bot and dashboard run as separate processes
- Both components share the same Google Sheets backend
- The dashboard provides read-only viewing and delegate/supervisor management
- The bot handles the actual voting process
- All text and UI are in Arabic (RTL layout)
