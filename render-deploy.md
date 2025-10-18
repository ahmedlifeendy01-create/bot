# دليل النشر على Render

## 1. إعدادات Render

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

## 2. Environment Variables

أضف المتغيرات التالية في Render Dashboard:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
DASHBOARD_USER=admin
DASHBOARD_PASS=admin123
GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id_here
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account",...}
PORT=3000
```

## 3. خطوات النشر

### 1. إنشاء حساب على Render:
- اذهب إلى https://render.com
- سجل حساب جديد

### 2. ربط GitHub Repository:
- انقر "New +" > "Web Service"
- اختر "Build and deploy from a Git repository"
- ربط GitHub Repository

### 3. إعدادات الخدمة:
- **Name**: `telegram-voting-bot`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: `18.x`

### 4. إضافة Environment Variables:
- اذهب إلى Environment tab
- أضف جميع المتغيرات المطلوبة

### 5. النشر:
- انقر "Create Web Service"
- انتظر حتى اكتمال البناء
- تحقق من عمل التطبيق

## 4. التحقق من النشر

### 1. فحص Logs:
- اذهب إلى Logs tab
- تحقق من عدم وجود أخطاء

### 2. اختبار الداشبورد:
- افتح الرابط المقدم من Render
- جرب الدخول بـ admin/admin123

### 3. اختبار البوت:
- تحقق من عمل البوت في تيليجرام
- جرب إرسال /start

## 5. إعدادات إضافية

### Custom Domain (اختياري):
- اذهب إلى Settings > Custom Domains
- أضف النطاق المطلوب

### Auto-Deploy:
- في Settings > Build & Deploy
- فعّل "Auto-Deploy" للترقيات التلقائية

## 6. استكشاف الأخطاء

### مشاكل شائعة:
1. **Build Failed**: تحقق من package.json
2. **Start Failed**: تحقق من Environment Variables
3. **Bot Not Working**: تحقق من TELEGRAM_BOT_TOKEN
4. **Sheets Error**: تحقق من GOOGLE_APPLICATION_CREDENTIALS

### Logs مفيدة:
```bash
# فحص logs
render logs

# إعادة تشغيل
render restart
```

## 7. التحديثات

### تحديث الكود:
1. ادفع التغييرات إلى GitHub
2. Render سيقوم بالبناء التلقائي
3. تحقق من النشر الجديد

### تحديث Environment Variables:
1. اذهب إلى Environment tab
2. حدث المتغيرات المطلوبة
3. أعد تشغيل الخدمة

---
**ملاحظة**: تأكد من أن جميع Environment Variables صحيحة قبل النشر
