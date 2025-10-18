import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import basicAuth from 'express-basic-auth';
import { readKeyValueSettings, setKeyValueSetting, listDelegates, deleteDelegateByUserId, listSupervisors, deleteSupervisorByUserId, listVotes, addDelegate, addSupervisor, listVoters } from './sheets.js';
import { readRange } from './sheets.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

// Prevent unhandled promise rejections from crashing the server
process.on('unhandledRejection', (err) => {
  console.error('UnhandledRejection:', err);
});

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/auth-test', (req, res) => {
  res.json({ 
    user: ADMIN_USER, 
    pass: ADMIN_PASS,
    env_user: process.env.DASHBOARD_USER,
    env_pass: process.env.DASHBOARD_PASS
  });
});

app.get('/debug/sheets', async (req, res) => {
  try {
    const delegates = await listDelegates();
    const supervisors = await listSupervisors();
    const voters = await readRange('Voters!A:E').catch(() => []);
    const votes = await listVotes();
    res.json({
      ok: true,
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '(env missing)',
      delegatesCount: delegates.length,
      supervisorsCount: supervisors.length,
      votersRows: voters.length || 0,
      votesCount: votes.length
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: String(e && e.message ? e.message : e), stack: (e && e.stack) || '' });
  }
});

const ADMIN_USER = process.env.DASHBOARD_USER || 'admin';
const ADMIN_PASS = process.env.DASHBOARD_PASS || 'admin';

console.log('Dashboard Auth - User:', ADMIN_USER, 'Pass:', ADMIN_PASS);

app.use(basicAuth({ 
  users: { [ADMIN_USER]: ADMIN_PASS }, 
  challenge: true,
  realm: 'Dashboard Access'
}));

const CENTERS = ['طما', 'طهطا', 'جهينه'];

function computeStats(votes, allVoters = []) {
  const totals = { overall: { total: 0, voted: 0, not: 0, invalid: 0, totalVoters: 0, totalVoted: 0, remaining: 0, progressPercent: 0 }, centers: {} };
  for (const c of CENTERS) totals.centers[c] = { total: 0, voted: 0, not: 0, invalid: 0, totalVoters: 0, totalVoted: 0, remaining: 0, progressPercent: 0 };
  
  // حساب إجمالي الناخبين المسجلين لكل مركز
  for (const voter of allVoters) {
    const center = voter.center || 'غير محدد';
    if (!totals.centers[center]) totals.centers[center] = { total: 0, voted: 0, not: 0, invalid: 0, totalVoters: 0, totalVoted: 0, remaining: 0, progressPercent: 0 };
    totals.centers[center].totalVoters += 1;
    totals.overall.totalVoters += 1;
  }
  
  // حساب الأصوات المسجلة
  for (const v of votes) {
    const center = v.center || 'غير محدد';
    if (!totals.centers[center]) totals.centers[center] = { total: 0, voted: 0, not: 0, invalid: 0, totalVoters: 0, totalVoted: 0, remaining: 0, progressPercent: 0 };
    totals.centers[center].total += 1;
    totals.overall.total += 1;
    if (v.status === 'VOTED') { totals.centers[center].voted += 1; totals.overall.voted += 1; }
    else if (v.status === 'NOT_VOTED') { totals.centers[center].not += 1; totals.overall.not += 1; }
    else if (v.status === 'INVALID') { totals.centers[center].invalid += 1; totals.overall.invalid += 1; }
  }
  
  // حساب الإحصائيات الإضافية
  for (const c of CENTERS) {
    const center = totals.centers[c];
    center.totalVoted = center.voted + center.invalid; // إجمالي المصوتين (تم + باطل)
    center.remaining = center.totalVoters - center.totalVoted; // الأصوات المتبقية
    center.progressPercent = center.totalVoters > 0 ? Math.round((center.totalVoted / center.totalVoters) * 100) : 0; // نسبة الإنجاز
  }
  
  // حساب الإجمالي العام
  totals.overall.totalVoted = totals.overall.voted + totals.overall.invalid; // إجمالي المصوتين
  totals.overall.remaining = totals.overall.totalVoters - totals.overall.totalVoted; // الأصوات المتبقية
  totals.overall.progressPercent = totals.overall.totalVoters > 0 ? Math.round((totals.overall.totalVoted / totals.overall.totalVoters) * 100) : 0; // نسبة الإنجاز
  
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

app.get('/', async (req, res) => {
  let settings = new Map(); let delegates = []; let supervisors = []; let votes = []; let allVoters = []; let totals = { overall: { total: 0, voted: 0, not: 0, invalid: 0 }, centers: {} };
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
    loadError = 'تعذر الاتصال بـ Google Sheets. يُفضّل استخدام Node 18 LTS أو ضبط NODE_OPTIONS=--openssl-legacy-provider.';
    console.error('Sheets load error:', e);
  }

  // Apply filters from query params
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

  // تطبيق نفس الفلاتر على الناخبين
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

  res.send(`<!doctype html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>لوحة التحكم - النائب علاء سليمان الحديوي</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
      body{
        font-family:'Cairo',sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color:#ffffff;margin:0;padding:24px;min-height:100vh
      }
      .container{max-width:1200px;margin:0 auto;background:rgba(255, 255, 255, 0.05);border-radius:20px;padding:30px;backdrop-filter:blur(1px);box-shadow:0 0 20px rgba(0,0,0,0.2)}
      h1{margin:0 0 16px 0;font-size:32px;color:#ffffff;text-shadow:2px 2px 4px rgba(0,0,0,0.5)}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      .card{background:rgba(255, 255, 255, 0.05);border:1px solid rgba(59, 130, 246, 0.3);border-radius:12px;padding:16px;backdrop-filter:blur(1px);box-shadow:0 4px 6px rgba(0,0,0,0.1)}
      .muted{color:#64748b}
      table{width:100%;border-collapse:collapse}
      th,td{border-bottom:1px solid rgba(59, 130, 246, 0.2);padding:8px;text-align:right}
      input,select,button{background:rgba(255, 255, 255, 0.9);border:1px solid rgba(59, 130, 246, 0.3);color:#1e293b;border-radius:8px;padding:8px;backdrop-filter:blur(5px)}
      .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;background:rgba(59, 130, 246, 0.02);padding:16px;border-radius:12px;backdrop-filter:blur(1px)}
      .row{display:flex;gap:8px;align-items:center}
      .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:bold;text-shadow:1px 1px 2px rgba(0,0,0,0.1)}
      .bg-green{background:linear-gradient(135deg, #10b981, #059669);color:#ffffff;box-shadow:0 2px 4px rgba(16, 185, 129, 0.3)}
      .bg-yellow{background:linear-gradient(135deg, #f59e0b, #d97706);color:#ffffff;box-shadow:0 2px 4px rgba(245, 158, 11, 0.3)}
      .bg-red{background:linear-gradient(135deg, #ef4444, #dc2626);color:#ffffff;box-shadow:0 2px 4px rgba(239, 68, 68, 0.3)}
      .form-success{animation:fadeOut 3s ease-in-out forwards}
      @keyframes fadeOut{0%{opacity:1}100%{opacity:0}}
      .candidate-name{color:#1e40af;font-weight:bold;text-shadow:1px 1px 2px rgba(0,0,0,0.1)}
    </style>
    <script>
      // مسح الحقول بعد الإضافة الناجحة
      if (window.location.search.includes('success=')) {
        setTimeout(() => {
          document.getElementById('delegateForm')?.reset();
          document.getElementById('supervisorForm')?.reset();
        }, 1000);
      }
    </script>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div>
          <h1>🏛️ لوحة التحكم الانتخابية</h1>
          <div class="candidate-name" style="font-size:24px;margin-top:8px">النائب علاء سليمان الحديوي</div>
          <div class="muted" style="margin-top:4px">انتخابات مجلس النواب ٢٠٢٥ - محافظة سوهاج</div>
        </div>
        <div style="text-align:left">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <div style="width:40px;height:40px;background:linear-gradient(135deg, #dc2626, #b91c1c);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px">🔥</div>
            <div>
              <div style="color:#dc2626;font-weight:bold;font-size:14px">حماة الوطن</div>
              <div class="muted" style="font-size:12px">KUNAT AL-WATAN PARTY</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin:8px 0">
            <div style="width:30px;height:20px;background:linear-gradient(135deg, #1e40af, #3b82f6);border-radius:4px;display:flex;align-items:center;justify-content:center;color:white;font-size:12px">🏛️</div>
            <div class="muted" style="font-size:12px">مجلس النواب 2025</div>
          </div>
          <div class="muted">الدائرة الرابعة</div>
          <div class="muted">مراكز الدائرة: طما، طهطا، جهينه</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <h3>فلترة البيانات</h3>
        <form method="get" class="row">
          <select name="center">
            <option value="">جميع المراكز</option>
            ${CENTERS.map(c => `<option value="${c}" ${filterCenter === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <select name="supervisor">
            <option value="">جميع المشرفين</option>
            ${filteredSupervisors.map(s => `<option value="${s.userId}" ${filterSupervisor === s.userId ? 'selected' : ''}>${s.name} (${s.center})</option>`).join('')}
          </select>
          <button type="submit">تطبيق الفلترة</button>
          <a href="/" style="margin-right:8px">إزالة الفلترة</a>
        </form>
        ${filterCenter || filterSupervisor ? `
        <div style="margin-top:8px">
          <div class="muted">📋 إجمالي الناخبين: ${filteredTotals.overall.totalVoters || 0}</div>
          <div class="muted">🗳️ إجمالي المصوتين: ${filteredTotals.overall.totalVoted || 0}</div>
          <div class="muted">📈 نسبة الإنجاز: ${filteredTotals.overall.progressPercent || 0}%</div>
          <span class="badge bg-green">✅ تم: ${filteredTotals.overall.voted}</span>
          <span class="badge bg-yellow">❌ لم يتم: ${filteredTotals.overall.not}</span>
          <span class="badge bg-red">⚠️ باطل: ${filteredTotals.overall.invalid}</span>
          <span class="muted">(النتائج المفلترة)</span>
        </div>
        ` : ''}
      </div>
      ${loadError ? `<div class=\"card\" style=\"margin-bottom:16px;color:#fecaca;background:#581c1c\">${loadError}</div>` : ''}
      
      ${error === 'delegate_exists' ? `<div class=\"card\" style=\"margin-bottom:16px;color:#fecaca;background:#581c1c\">خطأ: المندوب بهذا User ID موجود بالفعل</div>` : ''}
      ${error === 'supervisor_exists' ? `<div class=\"card\" style=\"margin-bottom:16px;color:#fecaca;background:#581c1c\">خطأ: المشرف بهذا User ID موجود بالفعل</div>` : ''}
      ${error === 'missing_fields' ? `<div class=\"card\" style=\"margin-bottom:16px;color:#fecaca;background:#581c1c\">خطأ: يرجى ملء جميع الحقول المطلوبة</div>` : ''}
      ${error === 'add_failed' ? `<div class=\"card\" style=\"margin-bottom:16px;color:#fecaca;background:#581c1c\">خطأ: فشل في الإضافة</div>` : ''}
      
      ${success === 'delegate_added' ? `<div class=\"card\" style=\"margin-bottom:16px;color:#a7f3d0;background:#064e3b\">تم إضافة المندوب بنجاح</div>` : ''}
      ${success === 'supervisor_added' ? `<div class=\"card\" style=\"margin-bottom:16px;color:#a7f3d0;background:#064e3b\">تم إضافة المشرف بنجاح</div>` : ''}
      
      <div class="grid">
        <div class="card">
          <h3>النسبة الإجمالية</h3>
          <div class="muted">📋 إجمالي الناخبين المسجلين: ${filteredTotals.overall.totalVoters || 0}</div>
          <div class="muted">🗳️ إجمالي المصوتين: ${filteredTotals.overall.totalVoted || 0}</div>
          <div class="muted">⏳ الأصوات المتبقية: ${filteredTotals.overall.remaining || 0}</div>
          <div class="muted">📈 نسبة الإنجاز: ${filteredTotals.overall.progressPercent || 0}%</div>
          <div style="margin-top:8px">
            <span class="badge bg-green">✅ تم: ${filteredTotals.overall.voted}</span>
            <span class="badge bg-yellow">❌ لم يتم: ${filteredTotals.overall.not}</span>
            <span class="badge bg-red">⚠️ باطل: ${filteredTotals.overall.invalid}</span>
          </div>
        </div>
        ${CENTERS.map(c => `
        <div class="card">
          <h3>${c}</h3>
          <div class="muted">📋 إجمالي الناخبين: ${filteredTotals.centers[c]?.totalVoters || 0}</div>
          <div class="muted">🗳️ إجمالي المصوتين: ${filteredTotals.centers[c]?.totalVoted || 0}</div>
          <div class="muted">⏳ الأصوات المتبقية: ${filteredTotals.centers[c]?.remaining || 0}</div>
          <div class="muted">📈 نسبة الإنجاز: ${filteredTotals.centers[c]?.progressPercent || 0}%</div>
          <div style="margin-top:8px">
            <span class="badge bg-green">✅ تم: ${filteredTotals.centers[c]?.voted || 0}</span>
            <span class="badge bg-yellow">❌ لم يتم: ${filteredTotals.centers[c]?.not || 0}</span>
            <span class="badge bg-red">⚠️ باطل: ${filteredTotals.centers[c]?.invalid || 0}</span>
          </div>
        </div>`).join('')}
      </div>

      <div class="card" style="margin-top:16px">
        <h3>المديريات</h3>
        <div class="row">
          <form method="post" action="/delegates/add" class="row" id="delegateForm">
            <input name="userId" placeholder="User ID" required />
            <input name="name" placeholder="الاسم" required />
            <select name="center">${CENTERS.map(c=>`<option>${c}</option>`).join('')}</select>
            <input name="village" placeholder="القرية/النجع" required />
            <input name="supervisorId" placeholder="User ID المشرف" />
            <button type="submit">إضافة مندوب</button>
          </form>
        </div>
        <div style="margin-top:12px" class="row">
          <form method="post" action="/supervisors/add" class="row" id="supervisorForm">
            <input name="userId" placeholder="User ID" required />
            <input name="name" placeholder="الاسم" required />
            <select name="center">${CENTERS.map(c=>`<option>${c}</option>`).join('')}</select>
            <button type="submit">إضافة مشرف</button>
          </form>
        </div>
      </div>

      <div class="grid" style="margin-top:16px">
        <div class="card">
          <h3>المندوبون</h3>
          <div>
            <a href="/export/votes.csv${filterCenter || filterSupervisor ? `?center=${encodeURIComponent(filterCenter)}&supervisor=${encodeURIComponent(filterSupervisor)}` : ''}">تصدير الأصوات (CSV)</a>
          </div>
          <table>
            <thead><tr><th>الاسم</th><th>User ID</th><th>المركز</th><th>القرية</th><th>المشرف</th></tr></thead>
            <tbody>
              ${filteredDelegates.map(d=>`<tr><td>${d.name}</td><td>${d.userId}</td><td>${d.center}</td><td>${d.village}</td><td>${d.supervisorId}</td><td>
              <form method="post" action="/delegates/delete" style="display:inline">
                <input type="hidden" name="userId" value="${d.userId}" />
                <button>حذف</button>
              </form>
              </td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="card">
          <h3>المشرفون</h3>
          <table>
            <thead><tr><th>الاسم</th><th>User ID</th><th>المركز</th><th>إجراءات</th></tr></thead>
            <tbody>
              ${filteredSupervisors.map(s=>`<tr><td>${s.name}</td><td>${s.userId}</td><td>${s.center}</td><td>
              <a href="/supervisors/${encodeURIComponent(s.userId)}">تفاصيل</a>
              | <a href="/export/supervisor/${encodeURIComponent(s.userId)}.csv">تصدير CSV</a>
              <form method="post" action="/supervisors/delete" style="display:inline">
                <input type="hidden" name="userId" value="${s.userId}" />
                <button>حذف</button>
              </form>
              </td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>الإعدادات</h3>
        <div class="muted">يمكن ضبط الإعدادات من خلال هذه الصفحة (يستلزم إعادة تشغيل الخدمات لتطبيق التغييرات).</div>
        <form method="post" action="/settings/save" class="row" style="margin-top:8px">
          <input name="TELEGRAM_BOT_TOKEN" placeholder="TELEGRAM_BOT_TOKEN" value="${(settings && settings.get ? settings.get('TELEGRAM_BOT_TOKEN') : '') || ''}" />
          <input name="GOOGLE_SHEETS_SPREADSHEET_ID" placeholder="GOOGLE_SHEETS_SPREADSHEET_ID" value="${(settings && settings.get ? settings.get('GOOGLE_SHEETS_SPREADSHEET_ID') : '') || ''}" />
          <button>حفظ الإعدادات</button>
        </form>
        <div style="margin-top:8px" class="muted">الحالي (بيئة التشغيل): TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'مُعين' : 'غير معين'}, SHEET: ${process.env.GOOGLE_SHEETS_SPREADSHEET_ID ? 'مُعين' : 'غير معين'}</div>
      </div>

      <div style="text-align:center;margin-top:32px;padding:16px;background:rgba(59, 130, 246, 0.1);border-radius:12px;backdrop-filter:blur(5px)">
        <div style="color:#1e40af;font-size:18px;font-weight:bold;margin-bottom:8px">منكم وبكم</div>
        <div style="color:#64748b;font-size:14px">نستكمل مسيرة العطاء</div>
      </div>

    </div>
  </body>
  </html>`);
});

app.post('/delegates/add', async (req, res) => {
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

app.post('/delegates/delete', async (req, res) => {
  const userId = (req.body || {}).userId;
  if (userId) await deleteDelegateByUserId(userId);
  res.redirect('/');
});

app.post('/supervisors/add', async (req, res) => {
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

app.post('/supervisors/delete', async (req, res) => {
  const userId = (req.body || {}).userId;
  if (userId) await deleteSupervisorByUserId(userId);
  res.redirect('/');
});

app.post('/settings/save', async (req, res) => {
  const body = req.body || {};
  if (typeof body.TELEGRAM_BOT_TOKEN === 'string') {
    await setKeyValueSetting('TELEGRAM_BOT_TOKEN', body.TELEGRAM_BOT_TOKEN);
  }
  if (typeof body.GOOGLE_SHEETS_SPREADSHEET_ID === 'string') {
    await setKeyValueSetting('GOOGLE_SHEETS_SPREADSHEET_ID', body.GOOGLE_SHEETS_SPREADSHEET_ID);
  }
  res.redirect('/');
});

app.get('/supervisors/:userId', async (req, res) => {
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

  res.send(`<!doctype html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>تفاصيل المشرف - ${supervisor.name}</title>
    <style>
      body{font-family:'Cairo',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}
      .container{max-width:1100px;margin:0 auto}
      a{color:#93c5fd}
      .card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th,td{border-bottom:1px solid #1f2937;padding:8px;text-align:right}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h2>المشرف: ${supervisor.name} — المركز: ${supervisor.center}</h2>
        <div>إجمالي السجلات: ${total} | تم: ${voted} | لم يتم: ${not} | باطل: ${invalid}</div>
        <div><a href="/">عودة</a></div>
      </div>
      <div class="card">
        <h3>مناديب المشرف</h3>
        <table>
          <thead><tr><th>الاسم</th><th>User ID</th><th>القرية</th><th>تم</th><th>لم يتم</th><th>باطل</th><th>إجمالي</th></tr></thead>
          <tbody>
            ${breakdown.map(r=>`<tr>
              <td>${r.delegate.name}</td>
              <td>${r.delegate.userId}</td>
              <td>${r.delegate.village}</td>
              <td>${r.voted}</td>
              <td>${r.not}</td>
              <td>${r.invalid}</td>
              <td>${r.total}</td>
            </tr>`).join('')}
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

app.get('/export/votes.csv', async (req, res) => {
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

app.get('/export/supervisor/:userId.csv', async (req, res) => {
  const userId = req.params.userId;
  const delegates = (await listDelegates()).filter(d => d.supervisorId === userId);
  const votes = (await listVotes()).filter(v => delegates.some(d => d.userId === v.delegateUserId));
  const header = ['timestamp','delegateUserId','voterNationalId','status','center','village'];
  const rows = [toCsvRow(header), ...votes.map(v => toCsvRow([v.timestamp, v.delegateUserId, v.voterNationalId, v.status, v.center, v.village]))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="supervisor_${userId}.csv"`);
  res.send('\uFEFF' + rows.join('\n'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});


