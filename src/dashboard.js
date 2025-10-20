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

app.get('/check-credentials', (req, res) => {
  const user = process.env.DASHBOARD_USER || 'admin';
  const pass = process.env.DASHBOARD_PASS || 'admin';
  res.send(`
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial; padding: 20px; background: #f5f5f5; }
        .box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        code { background: #e0e0e0; padding: 2px 8px; border-radius: 4px; font-family: monospace; }
      </style>
    </head>
    <body>
      <h1>معلومات تسجيل الدخول</h1>
      <div class="box">
        <h3>اسم المستخدم:</h3>
        <p><code>${user}</code></p>
        <p>الطول: ${user.length} حرف</p>
      </div>
      <div class="box">
        <h3>كلمة المرور:</h3>
        <p><code>${pass}</code></p>
        <p>الطول: ${pass.length} حرف</p>
      </div>
      <div class="box">
        <p><strong>ملاحظة:</strong> استخدم هذه القيم بالضبط كما هي موضحة أعلاه</p>
        <p><a href="/">الذهاب لصفحة تسجيل الدخول</a></p>
      </div>
    </body>
    </html>
  `);
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

console.log('Dashboard Auth configured');

app.use(basicAuth({ 
  users: { [ADMIN_USER]: ADMIN_PASS }, 
  challenge: true,
  realm: 'Dashboard Access',
  authorizer: (username, password) => {
    const userMatches = basicAuth.safeCompare(username, ADMIN_USER);
    const passwordMatches = basicAuth.safeCompare(password, ADMIN_PASS);
    console.log('Auth attempt - User match:', userMatches, 'Pass match:', passwordMatches);
    return userMatches && passwordMatches;
  },
  authorizeAsync: false
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

  // إنشاء إحصائيات المراكز للرسم البياني
  const centerStats = CENTERS.map(center => ({
    center,
    totalVoted: filteredTotals.centers[center]?.totalVoted || 0,
    totalVoters: filteredTotals.centers[center]?.totalVoters || 0
  }));

  // متغيرات الإحصائيات للعرض
  const stats = {
    totalVoters: filteredTotals.overall.totalVoters,
    totalVoted: filteredTotals.overall.totalVoted,
    remaining: filteredTotals.overall.remaining,
    progressPercent: filteredTotals.overall.progressPercent
  };

  res.send(`<!doctype html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>لوحة التحكم - النائب علاء سليمان الحديوي</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{
        font-family:'Cairo',sans-serif;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        color:#ffffff;margin:0;padding:0;min-height:100vh;
        overflow-x:hidden
      }
      .navbar{
        background:rgba(255,255,255,0.1);
        backdrop-filter:blur(10px);
        border-bottom:1px solid rgba(255,255,255,0.2);
        padding:1rem 2rem;
        position:fixed;
        top:0;
        left:0;
        right:0;
        z-index:1000;
        display:flex;
        justify-content:space-between;
        align-items:center
      }
      .navbar h1{
        font-size:1.5rem;
        font-weight:700;
        color:#ffffff;
        text-shadow:0 2px 4px rgba(0,0,0,0.3)
      }
      .navbar .logo{
        display:flex;
        align-items:center;
        gap:0.5rem
      }
      .main-content{
        margin-top:80px;
        padding:2rem;
        max-width:1400px;
        margin-left:auto;
        margin-right:auto
      }
      .stats-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));
        gap:1.5rem;
        margin-bottom:2rem
      }
      .stat-card{
        background:rgba(255,255,255,0.1);
        backdrop-filter:blur(10px);
        border:1px solid rgba(255,255,255,0.2);
        border-radius:16px;
        padding:1.5rem;
        box-shadow:0 8px 32px rgba(0,0,0,0.1);
        transition:all 0.3s ease;
        position:relative;
        overflow:hidden
      }
      .stat-card:hover{
        transform:translateY(-5px);
        box-shadow:0 12px 40px rgba(0,0,0,0.2)
      }
      .stat-card::before{
        content:'';
        position:absolute;
        top:0;
        left:0;
        right:0;
        height:4px;
        background:linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899);
        border-radius:16px 16px 0 0
      }
      .stat-header{
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:1rem
      }
      .stat-title{
        font-size:0.9rem;
        color:rgba(255,255,255,0.8);
        font-weight:500
      }
      .stat-icon{
        width:40px;
        height:40px;
        border-radius:12px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:1.2rem;
        color:#ffffff
      }
      .stat-value{
        font-size:2.5rem;
        font-weight:700;
        color:#ffffff;
        margin-bottom:0.5rem;
        text-shadow:0 2px 4px rgba(0,0,0,0.3)
      }
      .stat-change{
        display:flex;
        align-items:center;
        gap:0.5rem;
        font-size:0.9rem;
        font-weight:500
      }
      .chart-container{
        background:rgba(255,255,255,0.1);
        backdrop-filter:blur(10px);
        border:1px solid rgba(255,255,255,0.2);
        border-radius:16px;
        padding:1.5rem;
        margin-bottom:2rem;
        box-shadow:0 8px 32px rgba(0,0,0,0.1)
      }
      .chart-title{
        font-size:1.2rem;
        font-weight:600;
        color:#ffffff;
        margin-bottom:1rem;
        display:flex;
        align-items:center;
        gap:0.5rem
      }
      .controls-section{
        background:rgba(255,255,255,0.1);
        backdrop-filter:blur(10px);
        border:1px solid rgba(255,255,255,0.2);
        border-radius:16px;
        padding:1.5rem;
        margin-bottom:2rem;
        box-shadow:0 8px 32px rgba(0,0,0,0.1)
      }
      .section-title{
        font-size:1.2rem;
        font-weight:600;
        color:#ffffff;
        margin-bottom:1rem;
        display:flex;
        align-items:center;
        gap:0.5rem
      }
      .form-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));
        gap:1rem;
        margin-bottom:1rem
      }
      .form-group{
        display:flex;
        flex-direction:column;
        gap:0.5rem
      }
      .form-label{
        font-size:0.9rem;
        color:rgba(255,255,255,0.8);
        font-weight:500
      }
      .form-input{
        background:rgba(255,255,255,0.1);
        border:1px solid rgba(255,255,255,0.2);
        border-radius:8px;
        padding:0.75rem;
        color:#ffffff;
        font-size:0.9rem;
        transition:all 0.3s ease
      }
      .form-input:focus{
        outline:none;
        border-color:#4f46e5;
        box-shadow:0 0 0 3px rgba(79, 70, 229, 0.1)
      }
      .form-input::placeholder{
        color:rgba(255,255,255,0.5)
      }
      .btn{
        background:linear-gradient(135deg, #4f46e5, #7c3aed);
        border:none;
        border-radius:8px;
        padding:0.75rem 1.5rem;
        color:#ffffff;
        font-weight:600;
        cursor:pointer;
        transition:all 0.3s ease;
        display:inline-flex;
        align-items:center;
        gap:0.5rem;
        text-decoration:none;
        font-size:0.9rem
      }
      .btn:hover{
        transform:translateY(-2px);
        box-shadow:0 8px 25px rgba(79, 70, 229, 0.3)
      }
      .btn-danger{
        background:linear-gradient(135deg, #ef4444, #dc2626)
      }
      .btn-success{
        background:linear-gradient(135deg, #10b981, #059669)
      }
      .btn-warning{
        background:linear-gradient(135deg, #f59e0b, #d97706)
      }
      .table-container{
        background:rgba(255,255,255,0.1);
        backdrop-filter:blur(10px);
        border:1px solid rgba(255,255,255,0.2);
        border-radius:16px;
        padding:1.5rem;
        margin-bottom:2rem;
        box-shadow:0 8px 32px rgba(0,0,0,0.1);
        overflow-x:auto
      }
      .table{
        width:100%;
        border-collapse:collapse;
        color:#ffffff
      }
      .table th{
        background:rgba(255,255,255,0.1);
        padding:1rem;
        text-align:right;
        font-weight:600;
        color:#ffffff;
        border-bottom:1px solid rgba(255,255,255,0.2)
      }
      .table td{
        padding:1rem;
        border-bottom:1px solid rgba(255,255,255,0.1);
        color:rgba(255,255,255,0.9)
      }
      .table tr:hover{
        background:rgba(255,255,255,0.05)
      }
      .badge{
        display:inline-flex;
        align-items:center;
        gap:0.25rem;
        padding:0.25rem 0.75rem;
        border-radius:20px;
        font-size:0.8rem;
        font-weight:600;
        text-transform:uppercase;
        letter-spacing:0.5px
      }
      .badge-success{
        background:linear-gradient(135deg, #10b981, #059669);
        color:#ffffff;
        box-shadow:0 2px 8px rgba(16, 185, 129, 0.3)
      }
      .badge-warning{
        background:linear-gradient(135deg, #f59e0b, #d97706);
        color:#ffffff;
        box-shadow:0 2px 8px rgba(245, 158, 11, 0.3)
      }
      .badge-danger{
        background:linear-gradient(135deg, #ef4444, #dc2626);
        color:#ffffff;
        box-shadow:0 2px 8px rgba(239, 68, 68, 0.3)
      }
      .badge-info{
        background:linear-gradient(135deg, #3b82f6, #1d4ed8);
        color:#ffffff;
        box-shadow:0 2px 8px rgba(59, 130, 246, 0.3)
      }
      .loading{
        display:flex;
        justify-content:center;
        align-items:center;
        padding:2rem;
        color:rgba(255,255,255,0.7)
      }
      .error{
        background:rgba(239, 68, 68, 0.1);
        border:1px solid rgba(239, 68, 68, 0.3);
        border-radius:8px;
        padding:1rem;
        color:#fca5a5;
        margin:1rem 0
      }
      .success{
        background:rgba(16, 185, 129, 0.1);
        border:1px solid rgba(16, 185, 129, 0.3);
        border-radius:8px;
        padding:1rem;
        color:#6ee7b7;
        margin:1rem 0
      }
      @media (max-width: 768px) {
        .main-content{padding:1rem}
        .stats-grid{grid-template-columns:1fr}
        .form-grid{grid-template-columns:1fr}
        .navbar{padding:1rem}
        .navbar h1{font-size:1.2rem}
      }
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

      // إنشاء الرسم البياني
      document.addEventListener('DOMContentLoaded', function() {
        const ctx = document.getElementById('votingChart');
        if (ctx) {
          const centerStats = ${JSON.stringify(centerStats || [])};
          
          new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: centerStats.map(c => c.center),
              datasets: [{
                data: centerStats.map(c => c.totalVoted),
                backgroundColor: [
                  'rgba(59, 130, 246, 0.8)',
                  'rgba(16, 185, 129, 0.8)',
                  'rgba(245, 158, 11, 0.8)'
                ],
                borderColor: [
                  'rgba(59, 130, 246, 1)',
                  'rgba(16, 185, 129, 1)',
                  'rgba(245, 158, 11, 1)'
                ],
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    color: '#ffffff',
                    font: {
                      family: 'Cairo',
                      size: 14
                    }
                  }
                },
                tooltip: {
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  titleColor: '#ffffff',
                  bodyColor: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  borderWidth: 1
                }
              }
            }
          });
        }
      });

      // تحديث الإحصائيات كل 30 ثانية
      setInterval(() => {
        location.reload();
      }, 30000);
    </script>
  </head>
  <body>
    <nav class="navbar">
      <div class="logo">
        <i class="fas fa-chart-line"></i>
        <h1>لوحة التحكم - النائب علاء سليمان الحديوي</h1>
      </div>
      <div class="navbar-actions">
        <button onclick="exportCSV()" class="btn">
          <i class="fas fa-download"></i>
          تصدير CSV
        </button>
        <button onclick="location.reload()" class="btn">
          <i class="fas fa-sync-alt"></i>
          تحديث
        </button>
      </div>
    </nav>

    <div class="main-content">
      <!-- إحصائيات عامة -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">إجمالي الناخبين</span>
            <div class="stat-icon" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">
              <i class="fas fa-users"></i>
            </div>
          </div>
          <div class="stat-value">${stats.totalVoters}</div>
          <div class="stat-change">
            <i class="fas fa-arrow-up" style="color: #10b981;"></i>
            <span>مسجلين في النظام</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">إجمالي المصوتين</span>
            <div class="stat-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
              <i class="fas fa-vote-yea"></i>
            </div>
          </div>
          <div class="stat-value">${stats.totalVoted}</div>
          <div class="stat-change">
            <i class="fas fa-arrow-up" style="color: #10b981;"></i>
            <span>${stats.progressPercent}% من الإجمالي</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">الأصوات المتبقية</span>
            <div class="stat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
              <i class="fas fa-clock"></i>
            </div>
          </div>
          <div class="stat-value">${stats.remaining}</div>
          <div class="stat-change">
            <i class="fas fa-arrow-down" style="color: #f59e0b;"></i>
            <span>لم يتم التصويت بعد</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">نسبة الإنجاز</span>
            <div class="stat-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
              <i class="fas fa-percentage"></i>
            </div>
          </div>
          <div class="stat-value">${stats.progressPercent}%</div>
          <div class="stat-change">
            <i class="fas fa-chart-line" style="color: #8b5cf6;"></i>
            <span>من إجمالي الناخبين</span>
          </div>
        </div>
      </div>

      <!-- الرسم البياني -->
      <div class="chart-container">
        <div class="chart-title">
          <i class="fas fa-chart-pie"></i>
          إحصائيات التصويت حسب المركز
        </div>
        <canvas id="votingChart" width="400" height="200"></canvas>
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard running on http://0.0.0.0:${PORT}`);
});


