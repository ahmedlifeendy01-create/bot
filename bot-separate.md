# تشغيل البوت منفصلاً

## 🤖 إعداد البوت على VPS منفصل:

### 1. إعداد VPS:
```bash
# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# إنشاء مجلد المشروع
mkdir telegram-bot
cd telegram-bot
```

### 2. رفع الملفات:
```bash
# رفع ملفات البوت فقط
scp -r src/bot.js src/sheets.js package.json .env user@your-vps:/path/to/telegram-bot/
```

### 3. تثبيت التبعيات:
```bash
npm install
```

### 4. تشغيل البوت:
```bash
# تشغيل مباشر
node src/bot.js

# أو باستخدام PM2
npm install -g pm2
pm2 start src/bot.js --name "telegram-bot"
pm2 startup
pm2 save
```

## 🔧 إعدادات VPS:

### 1. ملف .env للبوت:
```env
TELEGRAM_BOT_TOKEN=7963257370:AAGQH1iY2QPIHjxr0TY5QPwksl3Ieh5OiCs
GOOGLE_SHEETS_SPREADSHEET_ID=1ehztBzZjBe7MTMa3xBwx7Vsix-hoqCCzA89qt2f2NH4
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account",...}
```

### 2. ملف package.json للبوت:
```json
{
  "name": "telegram-voting-bot",
  "version": "1.0.0",
  "description": "Telegram Voting Bot",
  "main": "src/bot.js",
  "type": "module",
  "scripts": {
    "start": "node src/bot.js",
    "dev": "nodemon src/bot.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "googleapis": "^134.0.0",
    "node-telegram-bot-api": "^0.66.0"
  }
}
```

## 🚀 تشغيل البوت:

### 1. تشغيل مباشر:
```bash
node src/bot.js
```

### 2. تشغيل مع PM2:
```bash
pm2 start src/bot.js --name "telegram-bot"
pm2 monit
```

### 3. تشغيل مع systemd:
```bash
# إنشاء ملف service
sudo nano /etc/systemd/system/telegram-bot.service
```

```ini
[Unit]
Description=Telegram Voting Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/telegram-bot
ExecStart=/usr/bin/node src/bot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# تفعيل الخدمة
sudo systemctl daemon-reload
sudo systemctl enable telegram-bot
sudo systemctl start telegram-bot
sudo systemctl status telegram-bot
```

## 🔍 مراقبة البوت:

### 1. فحص Logs:
```bash
# PM2
pm2 logs telegram-bot

# systemd
sudo journalctl -u telegram-bot -f

# مباشر
tail -f bot.log
```

### 2. إعادة تشغيل:
```bash
# PM2
pm2 restart telegram-bot

# systemd
sudo systemctl restart telegram-bot
```

### 3. إيقاف:
```bash
# PM2
pm2 stop telegram-bot

# systemd
sudo systemctl stop telegram-bot
```

## 📋 خطوات النشر الكامل:

### 1. إعداد VPS:
```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# تثبيت PM2
sudo npm install -g pm2
```

### 2. رفع الملفات:
```bash
# إنشاء مجلد
mkdir telegram-bot
cd telegram-bot

# رفع الملفات (استخدم SCP أو Git)
git clone https://github.com/your-username/telegram-voting-bot.git .
```

### 3. تثبيت التبعيات:
```bash
npm install
```

### 4. إعداد Environment Variables:
```bash
nano .env
# أضف المتغيرات المطلوبة
```

### 5. تشغيل البوت:
```bash
pm2 start src/bot.js --name "telegram-bot"
pm2 startup
pm2 save
```

### 6. التحقق من التشغيل:
```bash
pm2 status
pm2 logs telegram-bot
```

## ⚠️ ملاحظات مهمة:

### 1. الأمان:
- **استخدم firewall** لحماية VPS
- **حدث النظام** بانتظام
- **استخدم SSH keys** بدلاً من كلمات المرور

### 2. المراقبة:
- **راقب استخدام الذاكرة** والـ CPU
- **احتفظ بـ logs** للتحليل
- **أعد تشغيل البوت** عند الحاجة

### 3. النسخ الاحتياطي:
- **احتفظ بنسخة** من الملفات
- **احتفظ بنسخة** من Environment Variables
- **اختبر النظام** بانتظام

---
**ملاحظة**: تأكد من صحة جميع الإعدادات قبل التشغيل
