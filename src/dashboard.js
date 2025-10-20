import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import session from 'express-session';
import { readKeyValueSettings, setKeyValueSetting, listDelegates, deleteDelegateByUserId, listSupervisors, deleteSupervisorByUserId, listVotes, addDelegate, addSupervisor, listVoters } from './sheets.js';
import { readRange } from './sheets.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// Trust proxy - مهم جداً لـ Render و Heroku وغيرها
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('❌ SESSION_SECRET is required but not set in environment variables!');
  console.error('Please set SESSION_SECRET in Replit Secrets for secure session management.');
  process.exit(1);
}

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax', // تغيير من strict إلى lax لتوافق أفضل مع Render
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

// Cache-Control headers to prevent caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

process.on('unhandledRejection', (err) => {
  console.error('UnhandledRejection:', err);
});

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// صفحة مساعدة إعداد Google Sheets
app.get('/setup-help', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>دليل إعداد Google Sheets</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', sans-serif;
          background: #f5f7fa;
          padding: 20px;
          line-height: 1.8;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          border-radius: 15px;
          box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        h1 {
          color: #2c3e50;
          border-bottom: 3px solid #667eea;
          padding-bottom: 15px;
          margin-bottom: 30px;
        }
        h2 {
          color: #667eea;
          margin-top: 30px;
          margin-bottom: 15px;
          font-size: 22px;
        }
        h3 {
          color: #555;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        .step {
          background: #f8f9fa;
          padding: 20px;
          border-right: 4px solid #667eea;
          margin-bottom: 20px;
          border-radius: 8px;
        }
        .warning {
          background: #fff3cd;
          border-right: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 8px;
        }
        .error {
          background: #f8d7da;
          border-right: 4px solid #dc3545;
          padding: 15px;
          margin: 20px 0;
          border-radius: 8px;
        }
        code {
          background: #e9ecef;
          padding: 3px 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
        }
        ul, ol {
          margin-right: 30px;
          margin-bottom: 15px;
        }
        li {
          margin-bottom: 10px;
        }
        .btn {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 30px;
          border-radius: 8px;
          text-decoration: none;
          margin-top: 20px;
          transition: background 0.3s;
        }
        .btn:hover {
          background: #5568d3;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #dee2e6;
          padding: 12px;
          text-align: right;
        }
        th {
          background: #667eea;
          color: white;
        }
        tr:nth-child(even) {
          background: #f8f9fa;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📚 دليل إعداد لوحة تحكم التصويت</h1>
        
        <div class="error">
          <h3>⚠️ مشكلة الاتصال بـ Google Sheets</h3>
          <p>إذا ظهرت لك رسالة "Invalid JWT Signature" أو "تعذر الاتصال بـ Google Sheets"، فهذا يعني أن بيانات الاعتماد لـ Google غير صحيحة.</p>
        </div>

        <h2>📋 الخطوات المطلوبة:</h2>

        <div class="step">
          <h3>1️⃣ إنشاء Service Account في Google Cloud</h3>
          <ol>
            <li>اذهب إلى <a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a></li>
            <li>أنشئ مشروع جديد أو اختر مشروع موجود</li>
            <li>من القائمة الجانبية، اختر "IAM & Admin" ثم "Service Accounts"</li>
            <li>اضغط "Create Service Account"</li>
            <li>أدخل اسم الحساب (مثل: voting-bot-service)</li>
            <li>اضغط "Create and Continue"</li>
            <li>أعطه دور "Editor" أو "Owner"</li>
            <li>اضغط "Done"</li>
          </ol>
        </div>

        <div class="step">
          <h3>2️⃣ إنشاء مفتاح JSON</h3>
          <ol>
            <li>اضغط على Service Account الذي أنشأته</li>
            <li>اذهب لتبويب "Keys"</li>
            <li>اضغط "Add Key" ← "Create new key"</li>
            <li>اختر "JSON"</li>
            <li>اضغط "Create" - سيتم تحميل ملف JSON</li>
            <li><strong>احتفظ بهذا الملف بأمان!</strong></li>
          </ol>
        </div>

        <div class="step">
          <h3>3️⃣ تفعيل Google Sheets API</h3>
          <ol>
            <li>في Google Cloud Console، اذهب إلى "APIs & Services" ← "Library"</li>
            <li>ابحث عن "Google Sheets API"</li>
            <li>اضغط عليه ثم اضغط "Enable"</li>
          </ol>
        </div>

        <div class="step">
          <h3>4️⃣ إعداد Google Sheets</h3>
          <ol>
            <li>أنشئ Google Sheet جديد</li>
            <li>أنشئ الصفحات (Sheets) التالية بالضبط:</li>
          </ol>
          
          <table>
            <thead>
              <tr>
                <th>اسم الصفحة</th>
                <th>الأعمدة المطلوبة</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Delegates</strong></td>
                <td>userId | name | center | village | supervisorId</td>
              </tr>
              <tr>
                <td><strong>Supervisors</strong></td>
                <td>userId | name | center</td>
              </tr>
              <tr>
                <td><strong>Voters</strong></td>
                <td>name | nationalId | rollNumber | center | village</td>
              </tr>
              <tr>
                <td><strong>Votes</strong></td>
                <td>timestamp | delegateUserId | voterNationalId | status | center | village</td>
              </tr>
              <tr>
                <td><strong>Settings</strong></td>
                <td>key | value</td>
              </tr>
            </tbody>
          </table>

          <ol start="3">
            <li>اضف الأعمدة في الصف الأول لكل صفحة</li>
            <li>شارك الملف مع البريد الإلكتروني للـ Service Account:
              <br>ستجده في ملف JSON تحت <code>"client_email"</code>
              <br>أعطه صلاحية "Editor"
            </li>
          </ol>
        </div>

        <div class="step">
          <h3>5️⃣ تحديث Replit Secrets</h3>
          <ol>
            <li>في Replit، افتح Tools ← Secrets</li>
            <li>حدّث <code>GOOGLE_CREDENTIALS</code> بمحتوى ملف JSON <strong>كاملاً</strong></li>
            <li>حدّث <code>GOOGLE_SHEETS_SPREADSHEET_ID</code> بـ ID الـ Spreadsheet:
              <br>يمكن إيجاده في رابط Google Sheet:
              <br><code>https://docs.google.com/spreadsheets/d/<strong>هنا_الـID</strong>/edit</code>
            </li>
          </ol>
        </div>

        <div class="warning">
          <h3>⚡ نصائح هامة:</h3>
          <ul>
            <li>تأكد من نسخ ملف JSON <strong>كاملاً</strong> بدون تعديل</li>
            <li>تأكد من مشاركة Google Sheet مع Service Account Email</li>
            <li>تأكد من تفعيل Google Sheets API</li>
            <li>تأكد من أن أسماء الصفحات بالإنجليزية بالضبط كما هي موضحة</li>
          </ul>
        </div>

        <a href="/" class="btn">← العودة للوحة التحكم</a>
      </div>
    </body>
    </html>
  `);
});

const ADMIN_USER = process.env.DASHBOARD_USER?.trim();
const ADMIN_PASS = process.env.DASHBOARD_PASS?.trim();

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('❌ DASHBOARD_USER and DASHBOARD_PASS are required but not set!');
  console.error('Please set DASHBOARD_USER and DASHBOARD_PASS in Replit Secrets.');
  process.exit(1);
}

console.log('Dashboard Auth configured');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
}

// صفحة تسجيل الدخول الاحترافية
app.get('/login', (req, res) => {
  const error = req.query.error;
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>تسجيل الدخول - لوحة التحكم</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Cairo', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        
        /* خلفية متحركة */
        body::before {
          content: '';
          position: absolute;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: moveBackground 20s linear infinite;
          z-index: 0;
        }
        
        @keyframes moveBackground {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        
        .login-container {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 50px 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 450px;
          z-index: 1;
          animation: slideUp 0.6s ease-out;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .logo-container {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .logo-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
          font-size: 36px;
        }
        
        h1 {
          color: #1a202c;
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        
        .subtitle {
          color: #718096;
          font-size: 15px;
          font-weight: 400;
        }
        
        .error-message {
          background: linear-gradient(135deg, #fc8181 0%, #f56565 100%);
          color: white;
          padding: 15px;
          border-radius: 12px;
          margin-bottom: 25px;
          text-align: center;
          font-weight: 600;
          animation: shake 0.5s;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        
        .form-group {
          margin-bottom: 25px;
        }
        
        label {
          display: block;
          margin-bottom: 10px;
          color: #2d3748;
          font-weight: 600;
          font-size: 15px;
        }
        
        .input-wrapper {
          position: relative;
        }
        
        .input-icon {
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: #a0aec0;
          font-size: 18px;
        }
        
        input {
          width: 100%;
          padding: 16px 50px 16px 20px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 16px;
          font-family: 'Cairo', sans-serif;
          transition: all 0.3s ease;
          background: white;
        }
        
        input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        button {
          width: 100%;
          padding: 18px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 18px;
          font-weight: 700;
          font-family: 'Cairo', sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 40px rgba(102, 126, 234, 0.5);
        }
        
        button:active {
          transform: translateY(0);
        }
        
        .info-box {
          background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%);
          padding: 18px;
          border-radius: 12px;
          margin-bottom: 25px;
          border-right: 4px solid #667eea;
        }
        
        .info-box p {
          font-size: 14px;
          color: #4c51bf;
          line-height: 1.7;
          margin: 0;
        }
        
        @media (max-width: 480px) {
          .login-container {
            padding: 40px 25px;
            margin: 20px;
          }
          
          h1 {
            font-size: 24px;
          }
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="logo-container">
          <div class="logo-icon">🗳️</div>
          <h1>لوحة تحكم التصويت</h1>
          <p class="subtitle">النائب علاء سليمان الحديوي</p>
        </div>
        
        ${error ? '<div class="error-message">⚠️ بيانات الدخول غير صحيحة. يرجى المحاولة مرة أخرى.</div>' : ''}
        
        <div class="info-box">
          <p><strong>ℹ️ معلومة:</strong> استخدم بيانات الدخول المحفوظة في Replit Secrets</p>
        </div>
        
        <form method="POST" action="/login">
          <div class="form-group">
            <label>اسم المستخدم</label>
            <div class="input-wrapper">
              <span class="input-icon">👤</span>
              <input 
                type="text" 
                name="username" 
                required 
                autocomplete="username"
                placeholder="أدخل اسم المستخدم"
              >
            </div>
          </div>
          
          <div class="form-group">
            <label>كلمة المرور</label>
            <div class="input-wrapper">
              <span class="input-icon">🔒</span>
              <input 
                type="password" 
                name="password" 
                required 
                autocomplete="current-password"
                placeholder="أدخل كلمة المرور"
              >
            </div>
          </div>
          
          <button type="submit">تسجيل الدخول</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = (username || '').trim();
  const cleanPassword = (password || '').trim();
  
  if (cleanUsername === ADMIN_USER && cleanPassword === ADMIN_PASS) {
    req.session.authenticated = true;
    req.session.username = cleanUsername;
    console.log('Login successful');
    res.redirect('/');
  } else {
    console.log('Login failed');
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

const CENTERS = ['طما', 'طهطا', 'جهينه'];

function computeStats(votes, allVoters = []) {
  const totals = { overall: { total: 0, voted: 0, not: 0, invalid: 0, totalVoters: 0, totalVoted: 0, remaining: 0, progressPercent: 0 }, centers: {} };
  for (const c of CENTERS) totals.centers[c] = { total: 0, voted: 0, not: 0, invalid: 0, totalVoters: 0, totalVoted: 0, remaining: 0, progressPercent: 0 };
  
  for (const voter of allVoters) {
    const center = voter.center || 'غير محدد';
    if (!totals.centers[center]) totals.centers[center] = { total: 0, voted: 0, not: 0, invalid: 0, totalVoters: 0, totalVoted: 0, remaining: 0, progressPercent: 0 };
    totals.centers[center].totalVoters += 1;
    totals.overall.totalVoters += 1;
  }
  
  for (const v of votes) {
    const center = v.center || 'غير محدد';
    if (!totals.centers[center]) totals.centers[center] = { total: 0, voted: 0, not: 0, invalid: 0, totalVoters: 0, totalVoted: 0, remaining: 0, progressPercent: 0 };
    totals.centers[center].total += 1;
    totals.overall.total += 1;
    if (v.status === 'VOTED') { totals.centers[center].voted += 1; totals.overall.voted += 1; }
    else if (v.status === 'NOT_VOTED') { totals.centers[center].not += 1; totals.overall.not += 1; }
    else if (v.status === 'INVALID') { totals.centers[center].invalid += 1; totals.overall.invalid += 1; }
  }
  
  for (const c of CENTERS) {
    const center = totals.centers[c];
    center.totalVoted = center.voted + center.invalid;
    center.remaining = center.totalVoters - center.totalVoted;
    center.progressPercent = center.totalVoters > 0 ? Math.round((center.totalVoted / center.totalVoters) * 100) : 0;
  }
  
  totals.overall.totalVoted = totals.overall.voted + totals.overall.invalid;
  totals.overall.remaining = totals.overall.totalVoters - totals.overall.totalVoted;
  totals.overall.progressPercent = totals.overall.totalVoters > 0 ? Math.round((totals.overall.totalVoted / totals.overall.totalVoters) * 100) : 0;
  
  return totals;
}

function computeDelegateBreakdown(votes, delegates) {
  const byDelegate = new Map();
  for (const d of delegates) {
    byDelegate.set(d.userId, { delegate: d, total: 0, voted: 0, not: 0, invalid: 0 });
  }
  for (const v of votes) {
    const rec = byDelegate.get(v.delegateUserId);
    if (!rec) continue;
    rec.total += 1;
    if (v.status === 'VOTED') rec.voted += 1;
    else if (v.status === 'NOT_VOTED') rec.not += 1;
    else if (v.status === 'INVALID') rec.invalid += 1;
  }
  return Array.from(byDelegate.values());
}

function computeDelegateStats(delegates, votes, allVoters) {
  const stats = new Map();
  
  for (const delegate of delegates) {
    const delegateVoters = allVoters.filter(v => 
      v.center === delegate.center && v.village === delegate.village
    );
    const delegateVotes = votes.filter(v => v.delegateUserId === delegate.userId);
    
    const totalVoters = delegateVoters.length;
    const voted = delegateVotes.filter(v => v.status === 'VOTED').length;
    const invalid = delegateVotes.filter(v => v.status === 'INVALID').length;
    const notVoted = delegateVotes.filter(v => v.status === 'NOT_VOTED').length;
    const totalVoted = voted + invalid;
    const remaining = totalVoters - totalVoted;
    const progressPercent = totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0;
    
    stats.set(delegate.userId, {
      totalVoters,
      totalVotes: delegateVotes.length,
      voted,
      invalid,
      notVoted,
      totalVoted,
      remaining,
      progressPercent
    });
  }
  
  return stats;
}

function computeSupervisorStats(supervisors, delegates, votes, allVoters) {
  const stats = new Map();
  
  for (const supervisor of supervisors) {
    const supervisorDelegates = delegates.filter(d => d.supervisorId === supervisor.userId);
    const delegateIds = supervisorDelegates.map(d => d.userId);
    const supervisorVotes = votes.filter(v => delegateIds.includes(v.delegateUserId));
    
    const supervisorVoters = allVoters.filter(v => {
      const villages = supervisorDelegates.map(d => d.village);
      return v.center === supervisor.center && villages.includes(v.village);
    });
    
    const totalVoters = supervisorVoters.length;
    const voted = supervisorVotes.filter(v => v.status === 'VOTED').length;
    const invalid = supervisorVotes.filter(v => v.status === 'INVALID').length;
    const notVoted = supervisorVotes.filter(v => v.status === 'NOT_VOTED').length;
    const totalVoted = voted + invalid;
    const remaining = totalVoters - totalVoted;
    const progressPercent = totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0;
    
    stats.set(supervisor.userId, {
      totalVoters,
      totalVotes: supervisorVotes.length,
      voted,
      invalid,
      notVoted,
      totalVoted,
      remaining,
      progressPercent,
      delegatesCount: supervisorDelegates.length
    });
  }
  
  return stats;
}

app.get('/', requireAuth, async (req, res) => {
  let settings = new Map();
  let delegates = [];
  let supervisors = [];
  let votes = [];
  let allVoters = [];
  let totals = { overall: { total: 0, voted: 0, not: 0, invalid: 0 }, centers: {} };
  let loadError = '';
  const { error, success } = req.query;
  
  try {
    settings = await readKeyValueSettings();
    delegates = await listDelegates();
    supervisors = await listSupervisors();
    votes = await listVotes();
    allVoters = await listVoters();
    totals = computeStats(votes, allVoters);
  } catch (e) {
    const errorMsg = e.message || String(e);
    if (errorMsg.includes('Invalid JWT') || errorMsg.includes('invalid_grant')) {
      loadError = '⚠️ خطأ في بيانات الاعتماد لـ Google Sheets. يرجى التحقق من إعدادات GOOGLE_CREDENTIALS.';
    } else if (errorMsg.includes('ENOENT') || errorMsg.includes('not found')) {
      loadError = '⚠️ لم يتم العثور على الصفحات المطلوبة في Google Sheets.';
    } else {
      loadError = `⚠️ تعذر الاتصال بـ Google Sheets: ${errorMsg}`;
    }
    console.error('Sheets load error:', e);
  }

  const filterCenter = req.query.center || '';
  const filterSupervisor = req.query.supervisor || '';
  let filteredVotes = votes;
  let filteredDelegates = delegates;
  let filteredSupervisors = supervisors;

  if (filterCenter) {
    filteredVotes = votes.filter(v => v.center === filterCenter);
    filteredDelegates = delegates.filter(d => d.center === filterCenter);
    filteredSupervisors = supervisors.filter(s => s.center === filterCenter);
  }

  if (filterSupervisor) {
    const supervisorDelegates = filteredDelegates.filter(d => d.supervisorId === filterSupervisor);
    const supervisorDelegateIds = supervisorDelegates.map(d => d.userId);
    filteredVotes = filteredVotes.filter(v => supervisorDelegateIds.includes(v.delegateUserId));
    filteredDelegates = supervisorDelegates;
  }

  let filteredVoters = allVoters || [];
  if (filterCenter) {
    filteredVoters = filteredVoters.filter(v => v.center === filterCenter);
  }
  if (filterSupervisor) {
    const supervisorDelegates = filteredDelegates.filter(d => d.supervisorId === filterSupervisor);
    const supervisorVillages = supervisorDelegates.map(d => d.village);
    filteredVoters = filteredVoters.filter(v => supervisorVillages.includes(v.village));
  }
  
  const filteredTotals = computeStats(filteredVotes, filteredVoters);
  const centerStats = CENTERS.map(center => ({
    center,
    totalVoted: filteredTotals.centers[center]?.totalVoted || 0,
    totalVoters: filteredTotals.centers[center]?.totalVoters || 0
  }));

  const stats = {
    totalVoters: filteredTotals.overall.totalVoters,
    totalVoted: filteredTotals.overall.totalVoted,
    remaining: filteredTotals.overall.remaining,
    progressPercent: filteredTotals.overall.progressPercent
  };

  const delegateStats = computeDelegateStats(filteredDelegates, votes, allVoters);
  const supervisorStats = computeSupervisorStats(filteredSupervisors, delegates, votes, allVoters);

  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>لوحة التحكم - النائب علاء سليمان الحديوي</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    :root {
      --primary: #667eea;
      --primary-dark: #5568d3;
      --secondary: #764ba2;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --info: #3b82f6;
      --dark: #1e293b;
      --darker: #0f172a;
      --light: #f8fafc;
      --border: #e2e8f0;
      --text: #334155;
      --text-light: #64748b;
      --sidebar-width: 280px;
    }
    
    body {
      font-family: 'Cairo', sans-serif;
      background: #f1f5f9;
      color: var(--text);
      line-height: 1.6;
    }
    
    /* Sidebar */
    .sidebar {
      position: fixed;
      right: 0;
      top: 0;
      width: var(--sidebar-width);
      height: 100vh;
      background: linear-gradient(180deg, var(--darker) 0%, var(--dark) 100%);
      padding: 30px 20px;
      overflow-y: auto;
      z-index: 1000;
      box-shadow: -5px 0 20px rgba(0, 0, 0, 0.1);
    }
    
    .logo {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .logo-icon {
      width: 70px;
      height: 70px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 15px;
      font-size: 32px;
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    }
    
    .logo h1 {
      color: white;
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .logo p {
      color: rgba(255, 255, 255, 0.7);
      font-size: 13px;
    }
    
    .nav-menu {
      list-style: none;
    }
    
    .nav-item {
      margin-bottom: 10px;
    }
    
    .nav-link {
      display: flex;
      align-items: center;
      padding: 12px 15px;
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      border-radius: 10px;
      transition: all 0.3s ease;
      font-weight: 500;
    }
    
    .nav-link:hover,
    .nav-link.active {
      background: rgba(102, 126, 234, 0.2);
      color: white;
    }
    
    .nav-icon {
      margin-left: 12px;
      font-size: 20px;
    }
    
    .user-section {
      margin-top: auto;
      padding-top: 30px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .user-info {
      display: flex;
      align-items: center;
      padding: 15px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      margin-bottom: 15px;
    }
    
    .user-avatar {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 12px;
      font-size: 18px;
    }
    
    .user-details h4 {
      color: white;
      font-size: 14px;
      font-weight: 600;
    }
    
    .user-details p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
    }
    
    .logout-btn {
      width: 100%;
      padding: 12px;
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 10px;
      cursor: pointer;
      font-family: 'Cairo', sans-serif;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    
    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.3);
      color: white;
    }
    
    /* Main Content */
    .main-content {
      margin-right: var(--sidebar-width);
      padding: 30px;
      min-height: 100vh;
    }
    
    /* Header */
    .header {
      background: white;
      padding: 25px 30px;
      border-radius: 15px;
      margin-bottom: 30px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header h2 {
      color: var(--dark);
      font-size: 28px;
      font-weight: 700;
    }
    
    .header-actions {
      display: flex;
      gap: 15px;
    }
    
    .btn {
      padding: 12px 24px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      font-family: 'Cairo', sans-serif;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }
    
    .btn-secondary {
      background: white;
      color: var(--text);
      border: 2px solid var(--border);
    }
    
    .btn-secondary:hover {
      border-color: var(--primary);
      color: var(--primary);
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 25px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 15px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
    }
    
    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }
    
    .stat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .stat-title {
      color: var(--text-light);
      font-size: 14px;
      font-weight: 600;
    }
    
    .stat-icon {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    
    .stat-value {
      font-size: 36px;
      font-weight: 900;
      color: var(--dark);
      margin-bottom: 10px;
    }
    
    .stat-change {
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--text-light);
      font-size: 13px;
    }
    
    /* Cards */
    .card {
      background: white;
      padding: 25px;
      border-radius: 15px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      margin-bottom: 25px;
    }
    
    .card h3 {
      color: var(--dark);
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    /* Chart */
    .chart-container {
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      margin-bottom: 30px;
    }
    
    .chart-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--dark);
      margin-bottom: 25px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    thead {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
    }
    
    th, td {
      padding: 15px;
      text-align: right;
      border-bottom: 1px solid var(--border);
    }
    
    th {
      font-weight: 700;
      font-size: 14px;
    }
    
    tbody tr {
      transition: all 0.3s ease;
    }
    
    tbody tr:hover {
      background: var(--light);
    }
    
    /* Forms */
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-row {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    
    input, select {
      padding: 12px 15px;
      border: 2px solid var(--border);
      border-radius: 10px;
      font-family: 'Cairo', sans-serif;
      font-size: 14px;
      transition: all 0.3s ease;
      flex: 1;
      min-width: 150px;
    }
    
    input:focus, select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    /* Badges */
    .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 5px;
    }
    
    .badge-success {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success);
    }
    
    .badge-warning {
      background: rgba(245, 158, 11, 0.1);
      color: var(--warning);
    }
    
    .badge-danger {
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger);
    }
    
    /* Alerts */
    .alert {
      padding: 15px 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
    }
    
    .alert-error {
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger);
      border-right: 4px solid var(--danger);
    }
    
    .alert-success {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success);
      border-right: 4px solid var(--success);
    }
    
    /* Grid */
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 25px;
    }
    
    /* Responsive */
    @media (max-width: 1024px) {
      .sidebar {
        transform: translateX(100%);
      }
      
      .main-content {
        margin-right: 0;
      }
    }
    
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      .grid-2 {
        grid-template-columns: 1fr;
      }
      
      .header {
        flex-direction: column;
        gap: 15px;
        text-align: center;
      }
      
      .header-actions {
        flex-direction: column;
        width: 100%;
      }
      
      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="logo">
      <div class="logo-icon">🗳️</div>
      <h1>لوحة تحكم التصويت</h1>
      <p>النائب علاء سليمان الحديوي</p>
    </div>
    
    <ul class="nav-menu">
      <li class="nav-item">
        <a href="/" class="nav-link active">
          <span class="nav-icon">📊</span>
          <span>لوحة الإحصائيات</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="#delegates" class="nav-link">
          <span class="nav-icon">👥</span>
          <span>المندوبون</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="#supervisors" class="nav-link">
          <span class="nav-icon">👔</span>
          <span>المشرفون</span>
        </a>
      </li>
      <li class="nav-item">
        <a href="#filters" class="nav-link">
          <span class="nav-icon">🔍</span>
          <span>الفلاتر</span>
        </a>
      </li>
    </ul>
    
    <div class="user-section">
      <div class="user-info">
        <div class="user-avatar">👤</div>
        <div class="user-details">
          <h4>المسؤول</h4>
          <p>مدير النظام</p>
        </div>
      </div>
      <button class="logout-btn" onclick="location.href='/logout'">🚪 تسجيل الخروج</button>
    </div>
  </div>
  
  <!-- Main Content -->
  <div class="main-content">
    <!-- Header -->
    <div class="header">
      <h2>📈 لوحة الإحصائيات الرئيسية</h2>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="location.href='/export/votes.csv'">
          📥 تصدير CSV
        </button>
        <button class="btn btn-secondary" onclick="location.reload()">
          🔄 تحديث
        </button>
      </div>
    </div>
    
    ${loadError ? `
    <div class="alert alert-error">
      <span>❌</span>
      <div>
        <strong>خطأ في الاتصال:</strong> ${loadError}
        <a href="/setup-help" style="color: var(--danger); text-decoration: underline; margin-right: 10px;">دليل الإعداد</a>
      </div>
    </div>
    ` : ''}
    
    ${error ? `<div class="alert alert-error">❌ ${error === 'delegate_exists' ? 'المندوب موجود بالفعل' : error === 'supervisor_exists' ? 'المشرف موجود بالفعل' : error === 'missing_fields' ? 'يرجى ملء جميع الحقول' : 'فشل في الإضافة'}</div>` : ''}
    ${success ? `<div class="alert alert-success">✅ ${success === 'delegate_added' ? 'تم إضافة المندوب بنجاح' : 'تم إضافة المشرف بنجاح'}</div>` : ''}
    
    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">إجمالي الناخبين</span>
          <div class="stat-icon" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">👥</div>
        </div>
        <div class="stat-value">${stats.totalVoters.toLocaleString('ar-EG')}</div>
        <div class="stat-change">
          📋 مسجلين في النظام
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">إجمالي المصوتين</span>
          <div class="stat-icon" style="background: linear-gradient(135deg, #10b981, #059669);">🗳️</div>
        </div>
        <div class="stat-value">${stats.totalVoted.toLocaleString('ar-EG')}</div>
        <div class="stat-change">
          📈 ${stats.progressPercent}% من الإجمالي
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">الأصوات المتبقية</span>
          <div class="stat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">⏳</div>
        </div>
        <div class="stat-value">${stats.remaining.toLocaleString('ar-EG')}</div>
        <div class="stat-change">
          ⏰ لم يتم التصويت بعد
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">نسبة الإنجاز</span>
          <div class="stat-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">📊</div>
        </div>
        <div class="stat-value">${stats.progressPercent}%</div>
        <div class="stat-change">
          ✨ من إجمالي الناخبين
        </div>
      </div>
    </div>
    
    <!-- Chart -->
    <div class="chart-container">
      <div class="chart-title">📊 إحصائيات التصويت حسب المركز</div>
      <canvas id="votingChart"></canvas>
    </div>
    
    <!-- Filters -->
    <div class="card" id="filters">
      <h3>🔍 فلترة البيانات</h3>
      <form method="get" class="form-row">
        <select name="center">
          <option value="">جميع المراكز</option>
          ${CENTERS.map(c => `<option value="${c}" ${filterCenter === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <select name="supervisor">
          <option value="">جميع المشرفين</option>
          ${filteredSupervisors.map(s => `<option value="${s.userId}" ${filterSupervisor === s.userId ? 'selected' : ''}>${s.name} (${s.center})</option>`).join('')}
        </select>
        <button type="submit" class="btn btn-primary">تطبيق الفلترة</button>
        ${filterCenter || filterSupervisor ? '<a href="/" class="btn btn-secondary">إزالة الفلترة</a>' : ''}
      </form>
    </div>
    
    <!-- Center Stats -->
    <div class="grid-2">
      ${CENTERS.map(c => `
      <div class="card">
        <h3>📍 ${c}</h3>
        <div style="margin-bottom: 15px;">
          <p style="color: var(--text-light); margin-bottom: 8px;">📋 إجمالي الناخبين: <strong>${(filteredTotals.centers[c]?.totalVoters || 0).toLocaleString('ar-EG')}</strong></p>
          <p style="color: var(--text-light); margin-bottom: 8px;">🗳️ إجمالي المصوتين: <strong>${(filteredTotals.centers[c]?.totalVoted || 0).toLocaleString('ar-EG')}</strong></p>
          <p style="color: var(--text-light); margin-bottom: 8px;">⏳ الأصوات المتبقية: <strong>${(filteredTotals.centers[c]?.remaining || 0).toLocaleString('ar-EG')}</strong></p>
          <p style="color: var(--text-light); margin-bottom: 15px;">📈 نسبة الإنجاز: <strong>${filteredTotals.centers[c]?.progressPercent || 0}%</strong></p>
        </div>
        <div>
          <span class="badge badge-success">✅ تم: ${filteredTotals.centers[c]?.voted || 0}</span>
          <span class="badge badge-warning">❌ لم يتم: ${filteredTotals.centers[c]?.not || 0}</span>
          <span class="badge badge-danger">⚠️ باطل: ${filteredTotals.centers[c]?.invalid || 0}</span>
        </div>
      </div>
      `).join('')}
    </div>
    
    <!-- Add Delegates & Supervisors -->
    <div class="card">
      <h3>➕ إضافة مندوب</h3>
      <form method="post" action="/delegates/add" class="form-row">
        <input name="userId" placeholder="User ID" required />
        <input name="name" placeholder="الاسم" required />
        <select name="center" required>
          ${CENTERS.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <input name="village" placeholder="القرية/النجع" required />
        <input name="supervisorId" placeholder="User ID المشرف" />
        <button type="submit" class="btn btn-primary">إضافة مندوب</button>
      </form>
    </div>
    
    <div class="card">
      <h3>➕ إضافة مشرف</h3>
      <form method="post" action="/supervisors/add" class="form-row">
        <input name="userId" placeholder="User ID" required />
        <input name="name" placeholder="الاسم" required />
        <select name="center" required>
          ${CENTERS.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <button type="submit" class="btn btn-primary">إضافة مشرف</button>
      </form>
    </div>
    
    <!-- Delegates & Supervisors Tables -->
    <div class="grid-2" id="delegates">
      <div class="card">
        <h3>👥 المندوبون (${filteredDelegates.length})</h3>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المركز</th>
                <th>القرية</th>
                <th>الناخبين</th>
                <th>تم</th>
                <th>باطل</th>
                <th>لم يتم</th>
                <th>المتبقي</th>
                <th>النسبة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${filteredDelegates.map(d => {
                const dStats = delegateStats.get(d.userId) || { totalVoters: 0, voted: 0, invalid: 0, notVoted: 0, remaining: 0, progressPercent: 0 };
                return `
                <tr>
                  <td><strong>${d.name}</strong><br><small style="color: #94a3b8;">${d.userId}</small></td>
                  <td>${d.center}</td>
                  <td>${d.village}</td>
                  <td><strong style="color: #3b82f6;">${dStats.totalVoters}</strong></td>
                  <td><span class="badge badge-success">${dStats.voted}</span></td>
                  <td><span class="badge badge-danger">${dStats.invalid}</span></td>
                  <td><span class="badge badge-warning">${dStats.notVoted}</span></td>
                  <td><strong style="color: #f59e0b;">${dStats.remaining}</strong></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <div style="flex: 1; background: #e5e7eb; border-radius: 8px; height: 8px; overflow: hidden;">
                        <div style="width: ${dStats.progressPercent}%; background: linear-gradient(90deg, #10b981, #059669); height: 100%; border-radius: 8px;"></div>
                      </div>
                      <strong style="color: #10b981; min-width: 40px;">${dStats.progressPercent}%</strong>
                    </div>
                  </td>
                  <td>
                    <form method="post" action="/delegates/delete" style="display: inline;">
                      <input type="hidden" name="userId" value="${d.userId}" />
                      <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="return confirm('هل تريد حذف ${d.name}؟')">حذف</button>
                    </form>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="card" id="supervisors">
        <h3>👔 المشرفون (${filteredSupervisors.length})</h3>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المركز</th>
                <th>المندوبين</th>
                <th>الناخبين</th>
                <th>تم</th>
                <th>باطل</th>
                <th>لم يتم</th>
                <th>المتبقي</th>
                <th>النسبة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSupervisors.map(s => {
                const sStats = supervisorStats.get(s.userId) || { totalVoters: 0, voted: 0, invalid: 0, notVoted: 0, remaining: 0, progressPercent: 0, delegatesCount: 0 };
                return `
                <tr>
                  <td><strong>${s.name}</strong><br><small style="color: #94a3b8;">${s.userId}</small></td>
                  <td>${s.center}</td>
                  <td><span class="badge badge-success">${sStats.delegatesCount}</span></td>
                  <td><strong style="color: #3b82f6;">${sStats.totalVoters}</strong></td>
                  <td><span class="badge badge-success">${sStats.voted}</span></td>
                  <td><span class="badge badge-danger">${sStats.invalid}</span></td>
                  <td><span class="badge badge-warning">${sStats.notVoted}</span></td>
                  <td><strong style="color: #f59e0b;">${sStats.remaining}</strong></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <div style="flex: 1; background: #e5e7eb; border-radius: 8px; height: 8px; overflow: hidden;">
                        <div style="width: ${sStats.progressPercent}%; background: linear-gradient(90deg, #10b981, #059669); height: 100%; border-radius: 8px;"></div>
                      </div>
                      <strong style="color: #10b981; min-width: 40px;">${sStats.progressPercent}%</strong>
                    </div>
                  </td>
                  <td>
                    <a href="/supervisors/${encodeURIComponent(s.userId)}" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; margin-left: 5px;">تفاصيل</a>
                    <form method="post" action="/supervisors/delete" style="display: inline;">
                      <input type="hidden" name="userId" value="${s.userId}" />
                      <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="return confirm('هل تريد حذف ${s.name}؟')">حذف</button>
                    </form>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding: 30px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 15px;">
      <h3 style="color: var(--primary); font-size: 24px; margin-bottom: 10px;">منكم وبكم</h3>
      <p style="color: var(--text-light); font-size: 16px;">نستكمل مسيرة العطاء</p>
    </div>
  </div>
  
  <script>
    // Chart.js Configuration
    const ctx = document.getElementById('votingChart');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(centerStats.map(c => c.center))},
        datasets: [{
          label: 'المصوتين',
          data: ${JSON.stringify(centerStats.map(c => c.totalVoted))},
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: 'rgb(102, 126, 234)',
          borderWidth: 2,
          borderRadius: 8
        }, {
          label: 'إجمالي الناخبين',
          data: ${JSON.stringify(centerStats.map(c => c.totalVoters))},
          backgroundColor: 'rgba(118, 75, 162, 0.3)',
          borderColor: 'rgb(118, 75, 162)',
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: {
                family: 'Cairo',
                size: 14,
                weight: 600
              },
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              family: 'Cairo',
              size: 14,
              weight: 700
            },
            bodyFont: {
              family: 'Cairo',
              size: 13
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              font: {
                family: 'Cairo',
                size: 12
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            ticks: {
              font: {
                family: 'Cairo',
                size: 13,
                weight: 600
              }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
    
    // Auto refresh every 30 seconds
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>`);
});

app.post('/delegates/add', requireAuth, async (req, res) => {
  const { userId, name, center, village, supervisorId } = req.body || {};
  
  if (!userId || !name || !center || !village) {
    return res.redirect('/?error=missing_fields');
  }
  
  try {
    const existingDelegates = await listDelegates();
    const existing = existingDelegates.find(d => d.userId === userId);
    
    if (existing) {
      return res.redirect('/?error=delegate_exists');
    }
    
    await addDelegate({ userId, name, center, village, supervisorId });
    res.redirect('/?success=delegate_added');
  } catch (e) {
    console.error('Error adding delegate:', e);
    res.redirect('/?error=add_failed');
  }
});

app.post('/delegates/delete', requireAuth, async (req, res) => {
  const userId = (req.body || {}).userId;
  if (userId) await deleteDelegateByUserId(userId);
  res.redirect('/');
});

app.post('/supervisors/add', requireAuth, async (req, res) => {
  const { userId, name, center } = req.body || {};
  
  if (!userId || !name || !center) {
    return res.redirect('/?error=missing_fields');
  }
  
  try {
    const existingSupervisors = await listSupervisors();
    const existing = existingSupervisors.find(s => s.userId === userId);
    
    if (existing) {
      return res.redirect('/?error=supervisor_exists');
    }
    
    await addSupervisor({ userId, name, center });
    res.redirect('/?success=supervisor_added');
  } catch (e) {
    console.error('Error adding supervisor:', e);
    res.redirect('/?error=add_failed');
  }
});

app.post('/supervisors/delete', requireAuth, async (req, res) => {
  const userId = (req.body || {}).userId;
  if (userId) await deleteSupervisorByUserId(userId);
  res.redirect('/');
});

app.get('/supervisors/:userId', requireAuth, async (req, res) => {
  const userId = req.params.userId;
  const supervisors = await listSupervisors();
  const supervisor = supervisors.find(s => s.userId === userId);
  if (!supervisor) return res.status(404).send('مشرف غير موجود');
  const delegates = (await listDelegates()).filter(d => d.supervisorId === userId);
  const votes = (await listVotes()).filter(v => delegates.some(d => d.userId === v.delegateUserId));
  const breakdown = computeDelegateBreakdown(votes, delegates);
  const total = votes.length;
  const voted = votes.filter(v => v.status === 'VOTED').length;
  const not = votes.filter(v => v.status === 'NOT_VOTED').length;
  const invalid = votes.filter(v => v.status === 'INVALID').length;

  res.send(`<!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>تفاصيل المشرف - ${supervisor.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Cairo', sans-serif;
        background: #f1f5f9;
        padding: 30px;
        color: #334155;
      }
      .container { max-width: 1200px; margin: 0 auto; }
      .card {
        background: white;
        border-radius: 15px;
        padding: 30px;
        margin-bottom: 25px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      }
      h2, h3 { color: #1e293b; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      thead { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
      th, td { padding: 15px; text-align: right; border-bottom: 1px solid #e2e8f0; }
      .badge {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        margin-left: 5px;
      }
      .badge-success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
      .badge-warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
      .badge-danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      a {
        color: #667eea;
        text-decoration: none;
        font-weight: 600;
      }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h2>👔 المشرف: ${supervisor.name} — المركز: ${supervisor.center}</h2>
        <div style="margin-bottom: 15px;">
          <span class="badge badge-success">✅ تم: ${voted}</span>
          <span class="badge badge-warning">❌ لم يتم: ${not}</span>
          <span class="badge badge-danger">⚠️ باطل: ${invalid}</span>
          <span class="badge badge-success">📊 إجمالي: ${total}</span>
        </div>
        <a href="/">← عودة للوحة الرئيسية</a>
      </div>
      
      <div class="card">
        <h3>👥 مناديب المشرف (${delegates.length})</h3>
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>User ID</th>
              <th>القرية</th>
              <th>تم</th>
              <th>لم يتم</th>
              <th>باطل</th>
              <th>إجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${breakdown.map(r => `
            <tr>
              <td>${r.delegate.name}</td>
              <td>${r.delegate.userId}</td>
              <td>${r.delegate.village}</td>
              <td>${r.voted}</td>
              <td>${r.not}</td>
              <td>${r.invalid}</td>
              <td><strong>${r.total}</strong></td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </body>
  </html>`);
});

function toCsvRow(fields) {
  return fields.map(f => {
    const s = String(f ?? '');
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',');
}

app.get('/export/votes.csv', requireAuth, async (req, res) => {
  const votes = await listVotes();
  const filterCenter = req.query.center || '';
  const filterSupervisor = req.query.supervisor || '';
  
  let filteredVotes = votes;
  if (filterCenter) {
    filteredVotes = votes.filter(v => v.center === filterCenter);
  }
  if (filterSupervisor) {
    const delegates = await listDelegates();
    const supervisorDelegates = delegates.filter(d => d.supervisorId === filterSupervisor);
    const supervisorDelegateIds = supervisorDelegates.map(d => d.userId);
    filteredVotes = filteredVotes.filter(v => supervisorDelegateIds.includes(v.delegateUserId));
  }
  
  const header = ['timestamp','delegateUserId','voterNationalId','status','center','village'];
  const rows = [toCsvRow(header), ...filteredVotes.map(v => toCsvRow([v.timestamp, v.delegateUserId, v.voterNationalId, v.status, v.center, v.village]))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="votes.csv"');
  res.send('\uFEFF' + rows.join('\n'));
});

app.get('/export/supervisor/:userId.csv', requireAuth, async (req, res) => {
  const userId = req.params.userId;
  const delegates = (await listDelegates()).filter(d => d.supervisorId === userId);
  const votes = (await listVotes()).filter(v => delegates.some(d => d.userId === v.delegateUserId));
  const header = ['timestamp','delegateUserId','voterNationalId','status','center','village'];
  const rows = [toCsvRow(header), ...votes.map(v => toCsvRow([v.timestamp, v.delegateUserId, v.voterNationalId, v.status, v.center, v.village]))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="supervisor_${userId}.csv"`);
  res.send('\uFEFF' + rows.join('\n'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard running on http://0.0.0.0:${PORT}`);
});
