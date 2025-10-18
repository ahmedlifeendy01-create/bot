# إعدادات Render المحسنة

## 🚀 إعدادات Render الموصى بها:

### Build Command:
```bash
npm install
```

### Start Command:
```bash
npm start
```

### Node Version:
```
18.x
```

## 🔐 Environment Variables المطلوبة:

### 1. Telegram Bot (اختياري - إذا كنت تريد البوت):
```
TELEGRAM_BOT_TOKEN=7963257370:AAGQH1iY2QPIHjxr0TY5QPwksl3Ieh5OiCs
```

### 2. Dashboard Authentication:
```
DASHBOARD_USER=admin
DASHBOARD_PASS=admin123
```

### 3. Google Sheets Configuration:
```
GOOGLE_SHEETS_SPREADSHEET_ID=1ehztBzZjBe7MTMa3xBwx7Vsix-hoqCCzA89qt2f2NH4
```

### 4. Google Sheets Authentication (اختر واحدة):

#### الطريقة الأولى - JSON String:
```
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account","project_id":"alaa-soliman-bot","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"alaa-soliman-bot@alaa-soliman-bot.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/alaa-soliman-bot%40alaa-soliman-bot.iam.gserviceaccount.com"}
```

#### الطريقة الثانية - متغيرات منفصلة:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=alaa-soliman-bot@alaa-soliman-bot.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=alaa-soliman-bot
```

### 5. Server Configuration:
```
PORT=3000
```

## 📋 خطوات الإعداد:

### 1. إنشاء خدمة جديدة في Render:
- اذهب إلى https://render.com
- انقر "New +" > "Web Service"
- اختر "Build and deploy from a Git repository"
- ربط GitHub Repository

### 2. إعدادات الخدمة:
- **Name**: `telegram-voting-dashboard`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: `18.x`

### 3. إضافة Environment Variables:
- اذهب إلى Environment tab
- أضف جميع المتغيرات المطلوبة
- تأكد من صحة القيم

### 4. النشر:
- انقر "Create Web Service"
- انتظر حتى اكتمال البناء
- تحقق من عمل التطبيق

## 🔍 التحقق من النشر:

### 1. فحص Logs:
- اذهب إلى Logs tab
- تحقق من عدم وجود أخطاء
- يجب أن ترى: "Dashboard running on http://localhost:3000"

### 2. اختبار الداشبورد:
- افتح الرابط المقدم من Render
- جرب الدخول بـ admin/admin123
- تحقق من عمل الإحصائيات

### 3. اختبار Google Sheets:
- تحقق من عمل إحصائيات المراكز
- جرب إضافة مندوب أو مشرف
- تحقق من تصدير CSV

## ⚠️ ملاحظات مهمة:

### 1. مشكلة Telegram Bot:
- **لا تشغل البوت والداشبورد معاً** في Render
- **استخدم الداشبورد فقط** في Render
- **شغل البوت منفصلاً** على VPS أو خادم آخر

### 2. Google Sheets Authentication:
- **استخدم JSON credentials** كـ Environment Variable
- **تأكد من صحة المفتاح الخاص**
- **تحقق من صلاحيات حساب الخدمة**

### 3. الأمان:
- **لا تشارك Environment Variables**
- **استخدم كلمات مرور قوية**
- **حدث التوكنات بانتظام**

## 🚀 النشر السريع:

### 1. إعدادات Render:
```
Build Command: npm install
Start Command: npm start
Node Version: 18.x
```

### 2. Environment Variables:
```
DASHBOARD_USER=admin
DASHBOARD_PASS=admin123
GOOGLE_SHEETS_SPREADSHEET_ID=1ehztBzZjBe7MTMa3xBwx7Vsix-hoqCCzA89qt2f2NH4
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account",...}
PORT=3000
```

### 3. النشر:
- انقر "Create Web Service"
- انتظر البناء
- اختبر النظام

---
**ملاحظة**: تأكد من صحة جميع Environment Variables قبل النشر
