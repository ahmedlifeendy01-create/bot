# دليل النشر على GitHub

## 1. تثبيت Git

### Windows:
- تحميل Git من: https://git-scm.com/download/win
- تثبيت Git مع الإعدادات الافتراضية

### أو استخدام GitHub Desktop:
- تحميل GitHub Desktop من: https://desktop.github.com/

## 2. إنشاء Repository على GitHub

1. اذهب إلى https://github.com
2. انقر على "New Repository"
3. املأ البيانات:
   - Repository name: `telegram-voting-bot`
   - Description: `Telegram Voting Bot with Dashboard for Alaa Soliman Al-Hadawi`
   - Visibility: Private (أو Public حسب رغبتك)
4. انقر "Create repository"

## 3. رفع المشروع إلى GitHub

### باستخدام Git Command Line:

```bash
# تهيئة Git
git init

# إضافة الملفات
git add .

# Commit أولي
git commit -m "Initial commit: Telegram Voting Bot with Dashboard"

# ربط Repository
git remote add origin https://github.com/YOUR_USERNAME/telegram-voting-bot.git

# رفع الملفات
git push -u origin main
```

### باستخدام GitHub Desktop:

1. افتح GitHub Desktop
2. انقر "Add an Existing Repository from your hard drive"
3. اختر مجلد المشروع
4. انقر "Publish repository"
5. اختر "Keep this code private" أو "Make public"
6. انقر "Publish repository"

## 4. إعداد Environment Variables

### في GitHub Repository:
1. اذهب إلى Settings > Secrets and variables > Actions
2. أضف المتغيرات التالية:
   - `TELEGRAM_BOT_TOKEN`
   - `DASHBOARD_USER`
   - `DASHBOARD_PASS`
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_APPLICATION_CREDENTIALS`
   - `PORT`

## 5. النشر على Render

### إعدادات Render:
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: `18.x`

### Environment Variables في Render:
- أضف نفس المتغيرات من GitHub Secrets

## 6. الملفات المهمة

### ملفات مطلوبة:
- `package.json` - تبعيات المشروع
- `src/` - ملفات المصدر
- `README.md` - دليل المشروع
- `.gitignore` - ملفات مستبعدة

### ملفات مستبعدة:
- `.env` - متغيرات البيئة
- `node_modules/` - تبعيات
- `*.json` - ملفات JSON الحساسة

## 7. خطوات النشر السريع

1. **تثبيت Git**
2. **إنشاء Repository على GitHub**
3. **رفع الملفات**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/telegram-voting-bot.git
   git push -u origin main
   ```
4. **إعداد Environment Variables**
5. **النشر على Render**

## 8. التحقق من النشر

- **GitHub**: تحقق من وجود الملفات في Repository
- **Render**: تحقق من تشغيل التطبيق
- **الداشبورد**: http://your-app.onrender.com
- **البوت**: تحقق من عمل البوت في تيليجرام

---
**ملاحظة**: تأكد من عدم رفع ملفات حساسة مثل `.env` أو ملفات JSON للحسابات
