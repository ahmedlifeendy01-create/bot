# بوت تيليجرام للتصويت + لوحة تحكم (Google Sheets)

نظام بسيط يعتمد على Google Sheets بدلاً من قواعد بيانات SQL. يوفر:
- بوت تيليجرام للمندوبين والمشرفين مع أزرار Inline Keyboard.
- تسجيل حالة كل ناخب: تم التصويت، لم يتم التصويت، صوت باطل.
- لوحة تحكم ويب لعرض نسب الإنجاز إجمالاً وبحسب المراكز: طما، طهطا، جهينه.
- إدارة المندوبين والمشرفين (إضافة فقط من الداشبورد)، والناخبون يتم رفعهم مرة واحدة في البداية.

## بنية المشروع
- `src/bot.js`: منطق البوت (بدء الجلسة، عرض قائمة الناخبين، اختيار الحالة).
- `src/dashboard.js`: لوحة التحكم (إحصائيات وإدارة بسيطة) مع Basic Auth.
- `src/sheets.js`: عميل Google Sheets وتعريف الجداول.

## إعداد Google Sheets
أنشئ ملف Google Sheets يحتوي على صفحات (Tabs):
- `Settings` (اختياري الآن): A:B = key, value
- `Delegates`: A:E = userId, name, center, village, supervisorId
- `Supervisors`: A:C = userId, name, center
- `Votes`: A:F = timestamp, delegateUserId, voterNationalId, status, center, village
- `Voters`: A:E = name, nationalId, rollNumber, center, village (قراءة فقط)

ملاحظة: سيتم تحميل قائمة الناخبين من صفحة `Voters` فقط للقراءة، ولن تُحدّث من لوحة التحكم.

## المتغيرات البيئية (.env)
أنشئ ملف `.env` في جذر المشروع يحتوي على:

```
TELEGRAM_BOT_TOKEN=123456:ABC...
DASHBOARD_USER=admin
DASHBOARD_PASS=admin
GOOGLE_SERVICE_ACCOUNT_EMAIL=svc@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your_google_sheet_id
PORT=3000
```

احفظ المفتاح الخاص مع \n حرفياً كما هو موضح أعلاه.

## التشغيل
1) تثبيت الحزم:
```
npm install
```

2) تشغيل لوحة التحكم:
```
npm start
```
افتح: http://localhost:3000

3) تشغيل البوت:
```
npm run bot
```

## التحكم في الوصول داخل البوت
- الدخول يتم بوساطة `userId` لحساب تيليجرام.
- من يظهر في `Delegates` يعتبر مندوباً؛ من يظهر في `Supervisors` يعتبر مشرفاً.
- المندوب يرى قائمة ناخبيه حسب `center` و`village` الخاصة به.
- المشرف يتجه للوحة التحكم لمشاهدة نسب التقدم التفصيلية.

## تخصيص المراكز
المراكز المعرفة افتراضياً: طما، طهطا، جهينه. يمكنك تعديلها داخل `src/dashboard.js` في المتغير `CENTERS`.

## ملاحظات
- لا توجد قواعد بيانات SQL. Google Sheets هو مصدر البيانات الوحيد.
- يمكن إضافة المندوبين والمشرفين من لوحة التحكم. حذفهم يتطلب تعديل الشيت يدوياً حالياً.
- بيانات الناخبين ترفع مرة واحدة ولا تُعدّل من لوحة التحكم.

