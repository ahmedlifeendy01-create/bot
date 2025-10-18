# Telegram Voting Bot Dashboard

نظام إدارة التصويت عبر تيليجرام مع لوحة تحكم ويب للنائب علاء سليمان الحديوي

## الميزات

- 🤖 بوت تيليجرام للمندوبين والمشرفين
- 📊 لوحة تحكم ويب للإحصائيات
- 📋 إدارة قوائم الناخبين
- 📈 إحصائيات مفصلة لكل مركز (طما، طهطا، جهينة)
- 📤 تصدير البيانات إلى CSV
- 🔐 نظام مصادقة آمن
- ☁️ تخزين البيانات في Google Sheets
- 📱 رسائل مثبتة تلقائية

## التثبيت والتشغيل

### 1. التثبيت الأولي
```bash
# تثبيت التبعيات
npm install

# إنشاء ملف البيئة
cp .env.example .env
```

### 2. إعداد المتغيرات البيئية
قم بتحديث ملف `.env` بالقيم الصحيحة:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Dashboard Authentication
DASHBOARD_USER=admin
DASHBOARD_PASS=admin123

# Google Sheets Configuration
GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id_here
GOOGLE_APPLICATION_CREDENTIALS=your_service_account.json

# Server Configuration
PORT=3000
```

### 3. تشغيل النظام

#### تشغيل الداشبورد:
```bash
npm start
```

#### تشغيل البوت:
```bash
npm run bot
```

#### تشغيل التطوير:
```bash
npm run dev
```

## الوصول للنظام

- **الداشبورد**: http://localhost:3000
- **بيانات الدخول**: admin / admin123

## الملفات المطلوبة

1. **ملف JSON لحساب الخدمة**: ضعه في مجلد المشروع
2. **ملف Excel بقوائم الناخبين**: رفعه إلى Google Sheets
3. **توكن البوت**: من @BotFather في تيليجرام

## البنية التقنية

```
src/
├── bot.js          # بوت تيليجرام
├── dashboard.js    # لوحة التحكم
└── sheets.js       # إدارة Google Sheets

public/
└── images/         # ملفات الصور

build.bat           # تثبيت التبعيات
start.bat           # تشغيل النظام
stop.bat            # إيقاف النظام
```

## النشر على Render

### Build Command:
```bash
npm install
```

### Start Command:
```bash
npm start
```

### Environment Variables:
```
TELEGRAM_BOT_TOKEN
DASHBOARD_USER
DASHBOARD_PASS
GOOGLE_SHEETS_SPREADSHEET_ID
GOOGLE_APPLICATION_CREDENTIALS
PORT
```

## الدعم

للحصول على الدعم، يرجى التواصل مع فريق التطوير.

---
**النائب علاء سليمان الحديوي** - دائرة طما وطهطا وجهينة