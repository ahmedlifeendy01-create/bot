# 🔧 دليل إصلاح مشكلة Google Sheets - Invalid JWT Signature

## ❌ المشكلة:
الخطأ: `invalid_grant: Invalid JWT Signature`

## 🔍 الأسباب المحتملة:

### 1️⃣ مفتاح Service Account منتهي الصلاحية أو محذوف
- مفاتيح Google Service Account يمكن أن تنتهي صلاحيتها
- قد يكون المفتاح تم حذفه من Google Cloud Console

### 2️⃣ Google Sheets API غير مفعل
- يجب تفعيل Google Sheets API في المشروع

### 3️⃣ Service Account غير مشارك في Google Sheet
- يجب مشاركة الملف مع البريد الإلكتروني للـ Service Account

---

## ✅ الحل الكامل (خطوة بخطوة):

### الخطوة 1: إنشاء مفتاح جديد تماماً

#### أ) الذهاب إلى Google Cloud Console
🔗 https://console.cloud.google.com/

#### ب) تفعيل Google Sheets API
1. اذهب إلى **APIs & Services** → **Library**
2. ابحث عن "**Google Sheets API**"
3. إذا لم يكن مفعلاً، اضغط **Enable**

#### ج) إنشاء/تحديث Service Account
1. اذهب إلى **APIs & Services** → **Credentials**
2. إذا كان `alaa-bot@alaa-soliman-bot.iam.gserviceaccount.com` موجوداً:
   - اضغط عليه
   - اذهب لتبويب **Keys**
   - اضغط **Add Key** → **Create new key**
   - اختر **JSON**
   - اضغط **Create**
   - سيتم تحميل ملف JSON جديد
3. إذا لم يكن موجوداً:
   - اضغط **Create Credentials** → **Service Account**
   - أدخل اسماً (مثل: `voting-bot-service`)
   - أعطه دور **Editor** أو **Owner**
   - أنشئ مفتاحاً جديداً كما في الأعلى

---

### الخطوة 2: تحديث GOOGLE_CREDENTIALS في Replit

1. افتح الملف JSON الذي تم تحميله
2. **انسخ كل المحتوى** (من `{` إلى `}`)
3. في Replit:
   - افتح **Tools** → **Secrets**
   - ابحث عن `GOOGLE_CREDENTIALS`
   - **احذفه تماماً**
   - أضفه من جديد
   - **الصق** محتوى الملف JSON الجديد **كاملاً**
   - احفظ

⚠️ **تحذير هام**: تأكد من نسخ الملف **كاملاً** بدون تعديل أي حرف!

---

### الخطوة 3: مشاركة Google Sheet مع Service Account

1. افتح Google Sheet الخاص بك:
   🔗 https://docs.google.com/spreadsheets/d/1ehztBzZjBe7MTMa3xBwx7Vsix-hoqCCzA89qt2f2NH4/edit

2. اضغط زر **Share** (مشاركة)

3. أضف البريد الإلكتروني من الملف JSON:
   - ابحث عن `"client_email"` في الملف
   - انسخ البريد (مثل: `alaa-bot@alaa-soliman-bot.iam.gserviceaccount.com`)
   - الصقه في خانة المشاركة

4. أعطه صلاحية **Editor**

5. اضغط **Send** أو **Share**

---

### الخطوة 4: التحقق من بنية Google Sheet

تأكد أن Google Sheet يحتوي على الصفحات التالية بالأسماء الصحيحة:

| اسم الصفحة | الأعمدة المطلوبة |
|------------|------------------|
| **Settings** | key \| value |
| **Delegates** | userId \| name \| center \| village \| supervisorId |
| **Supervisors** | userId \| name \| center |
| **Voters** | name \| nationalId \| rollNumber \| center \| village |
| **Votes** | timestamp \| delegateUserId \| voterNationalId \| status \| center \| village |

⚠️ **مهم**: الأسماء يجب أن تكون **بالإنجليزية** و**مطابقة تماماً**!

---

### الخطوة 5: اختبار الاتصال

بعد تطبيق الخطوات السابقة:
1. أعد تحميل صفحة Dashboard في المتصفح
2. أو شغّل الأمر: `node test-google-auth.js`

---

## 📝 ملاحظات إضافية:

### إذا كان المشروع جديداً:
- قد تحتاج إلى تمكين billing في Google Cloud (لكن Google Sheets API مجاني عادة)

### إذا ظهرت أخطاء أخرى:
- "Permission denied": تأكد من مشاركة الملف مع Service Account
- "Spreadsheet not found": تأكد من معرف الجدول صحيح في `GOOGLE_SHEETS_SPREADSHEET_ID`

---

## 🎯 الخلاصة:
المشكلة الأساسية هي أن المفتاح الحالي لا يعمل. **الحل الأفضل** هو:
1. ✅ إنشاء مفتاح Service Account **جديد**
2. ✅ تحديث `GOOGLE_CREDENTIALS` في Replit Secrets
3. ✅ مشاركة Google Sheet مع Service Account
4. ✅ تفعيل Google Sheets API

بعد ذلك سيعمل كل شيء بشكل صحيح! 🎉
