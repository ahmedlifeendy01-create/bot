import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function testAuth() {
  try {
    console.log('🔍 بدء اختبار بيانات Google Sheets...\n');
    
    const credentialsJson = process.env.GOOGLE_CREDENTIALS;
    
    if (!credentialsJson) {
      console.error('❌ GOOGLE_CREDENTIALS غير موجود!');
      return;
    }
    
    console.log('✅ GOOGLE_CREDENTIALS موجود');
    console.log('📏 طول المحتوى:', credentialsJson.length, 'حرف');
    
    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
      console.log('✅ تم تحليل JSON بنجاح');
      console.log('📧 البريد الإلكتروني:', credentials.client_email);
      console.log('🔑 معرف المفتاح:', credentials.private_key_id);
      console.log('🔐 المفتاح الخاص يبدأ بـ:', credentials.private_key.substring(0, 50) + '...');
    } catch (e) {
      console.error('❌ خطأ في تحليل JSON:', e.message);
      return;
    }
    
    console.log('\n🔄 محاولة إنشاء Auth...');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    console.log('✅ تم إنشاء GoogleAuth');
    
    console.log('\n🔄 محاولة الحصول على client...');
    const client = await auth.getClient();
    console.log('✅ تم الحصول على client بنجاح');
    
    console.log('\n🔄 اختبار الاتصال بـ Google Sheets API...');
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
      console.error('❌ GOOGLE_SHEETS_SPREADSHEET_ID غير موجود!');
      return;
    }
    
    console.log('📊 معرف الجدول:', spreadsheetId);
    
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    console.log('✅ نجح الاتصال بـ Google Sheets!');
    console.log('📋 اسم الجدول:', res.data.properties.title);
    console.log('📄 عدد الصفحات:', res.data.sheets.length);
    console.log('📑 أسماء الصفحات:');
    res.data.sheets.forEach(sheet => {
      console.log('  - ' + sheet.properties.title);
    });
    
    console.log('\n✅ ✅ ✅ كل الاختبارات نجحت! ✅ ✅ ✅');
    
  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    if (error.code) console.error('🔢 رمز الخطأ:', error.code);
    if (error.errors) {
      console.error('📝 تفاصيل الأخطاء:');
      error.errors.forEach(err => console.error('  -', err.message));
    }
  }
}

testAuth();
