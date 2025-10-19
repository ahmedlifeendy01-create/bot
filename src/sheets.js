process.env.TZ = "UTC";

import { google } from 'googleapis';

const REQUIRED_ENV = [
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'GOOGLE_APPLICATION_CREDENTIALS'
];

export function assertSheetsEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k] || process.env[k].trim() === '');
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

function getAuth() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  
  // محاولة استخدام JSON string مباشرة من Environment Variable
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsJson && credentialsJson.trim() !== '') {
    try {
      // محاولة تحليل JSON string
      const credentials = JSON.parse(credentialsJson);
      console.log('استخدام JSON credentials من Environment Variable');
      const auth = new google.auth.GoogleAuth({ 
        credentials,
        scopes 
      });
      return auth;
    } catch (parseError) {
      console.log('محاولة استخدام ملف JSON:', credentialsJson);
      // إذا فشل التحليل، جرب كملف
      try {
        const auth = new google.auth.GoogleAuth({ 
          keyFile: credentialsJson, 
          scopes 
        });
        return auth;
      } catch (fileError) {
        console.error('خطأ في استخدام JSON credentials:', parseError.message);
        console.error('خطأ في استخدام ملف JSON:', fileError.message);
        
        // محاولة استخدام متغيرات البيئة القديمة كخيار احتياطي
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
        
        if (email && privateKey) {
          console.log('استخدام متغيرات البيئة القديمة كخيار احتياطي');
          const auth = new google.auth.GoogleAuth({
            credentials: {
              type: 'service_account',
              project_id: process.env.GOOGLE_PROJECT_ID || 'default-project',
              private_key_id: 'default-key-id',
              private_key: privateKey.replace(/\\n/g, '\n'),
              client_email: email,
              client_id: 'default-client-id',
              auth_uri: 'https://accounts.google.com/o/oauth2/auth',
              token_uri: 'https://oauth2.googleapis.com/token',
              auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
              client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${email}`
            },
            scopes
          });
          return auth;
        }
        
        throw new Error(`تعذر تحميل JSON credentials: ${parseError.message}`);
      }
    }
  }
  
  throw new Error('JSON credentials غير محدد. يرجى تعيين GOOGLE_APPLICATION_CREDENTIALS');
}

export function getSheetsClient() {
  assertSheetsEnv();
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return { sheets, spreadsheetId };
}

export async function readRange(range) {
  try {
    const { sheets, spreadsheetId } = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  } catch (error) {
    console.error('خطأ في قراءة Google Sheets:', error.message);
    throw new Error(`تعذر الاتصال بـ Google Sheets: ${error.message}`);
  }
}

export async function writeRange(range, values) {
  try {
    const { sheets, spreadsheetId } = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values }
    });
  } catch (error) {
    console.error('خطأ في كتابة Google Sheets:', error.message);
    throw new Error(`تعذر الكتابة في Google Sheets: ${error.message}`);
  }
}

export async function appendRows(range, values) {
  const { sheets, spreadsheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });
}

// Data schema (Sheets tabs):
// Settings: key, value
// Delegates: userId, name, center, village, supervisorId
// Supervisors: userId, name, center
// Voters_*: name, nationalId, rollNumber, center, village, status (optional)
// Votes: timestamp, delegateUserId, voterNationalId, status (VOTED|NOT_VOTED|INVALID), center, village

export async function readKeyValueSettings() {
  const rows = await readRange('Settings!A:B');
  const map = new Map();
  for (const row of rows) {
    if (row[0]) map.set(row[0], row[1] || '');
  }
  return map;
}

export async function setKeyValueSetting(key, value) {
  const rows = await readRange('Settings!A:B');
  let found = false;
  const newRows = rows.map((r) => {
    if ((r[0] || '') === key) {
      found = true;
      return [key, value];
    }
    return r;
  });
  if (!found) newRows.push([key, value]);
  await writeRange('Settings!A:B', newRows);
}

export async function listDelegates() {
  const rows = await readRange('Delegates!A:E');
  const [header, ...data] = rows;
  const idx = indexHeader(header, ['userId', 'name', 'center', 'village', 'supervisorId']);
  return data.filter(r => r.length > 0).map(r => ({
    userId: r[idx.userId] || '',
    name: r[idx.name] || '',
    center: r[idx.center] || '',
    village: r[idx.village] || '',
    supervisorId: r[idx.supervisorId] || ''
  }));
}

export async function deleteDelegateByUserId(targetUserId) {
  const rows = await readRange('Delegates!A:E');
  if (!rows.length) return;
  const [header, ...data] = rows;
  const idx = indexHeader(header, ['userId', 'name', 'center', 'village', 'supervisorId']);
  const filtered = data.filter(r => (r[idx.userId] || '') !== String(targetUserId));
  const newValues = [header, ...filtered];
  await writeRange('Delegates!A:E', newValues);
}

export async function listSupervisors() {
  const rows = await readRange('Supervisors!A:C');
  const [header, ...data] = rows;
  const idx = indexHeader(header, ['userId', 'name', 'center']);
  return data.filter(r => r.length > 0).map(r => ({
    userId: r[idx.userId] || '',
    name: r[idx.name] || '',
    center: r[idx.center] || ''
  }));
}

export async function deleteSupervisorByUserId(targetUserId) {
  const rows = await readRange('Supervisors!A:C');
  if (!rows.length) return;
  const [header, ...data] = rows;
  const idx = indexHeader(header, ['userId', 'name', 'center']);
  const filtered = data.filter(r => (r[idx.userId] || '') !== String(targetUserId));
  const newValues = [header, ...filtered];
  await writeRange('Supervisors!A:C', newValues);
}

export async function addDelegate(record) {
  await appendRows('Delegates!A:E', [[
    String(record.userId || ''),
    String(record.name || ''),
    String(record.center || ''),
    String(record.village || ''),
    String(record.supervisorId || '')
  ]]);
}

export async function addSupervisor(record) {
  await appendRows('Supervisors!A:C', [[
    String(record.userId || ''),
    String(record.name || ''),
    String(record.center || '')
  ]]);
}

export async function recordVote(entry) {
  const timestamp = new Date().toISOString();
  await appendRows('Votes!A:F', [[
    timestamp,
    String(entry.delegateUserId || ''),
    String(entry.voterNationalId || ''),
    String(entry.status || ''),
    String(entry.center || ''),
    String(entry.village || '')
  ]]);
}

export async function listVotes() {
  const rows = await readRange('Votes!A:F');
  const [header, ...data] = rows;
  const idx = indexHeader(header, ['timestamp', 'delegateUserId', 'voterNationalId', 'status', 'center', 'village']);
  return data.filter(r => r.length > 0).map(r => ({
    timestamp: r[idx.timestamp] || '',
    delegateUserId: r[idx.delegateUserId] || '',
    voterNationalId: r[idx.voterNationalId] || '',
    status: r[idx.status] || '',
    center: r[idx.center] || '',
    village: r[idx.village] || ''
  }));
}

function indexHeader(header = [], keys = []) {
  const map = {};
  keys.forEach((k) => { map[k] = header.indexOf(k); });
  return map;
}

// Read-only voters list (pre-uploaded once)
// Expected columns in Voters sheet: name, nationalId, rollNumber, center, village
export async function listVoters() {
  const rows = await readRange('Voters!A:E');
  const [header, ...data] = rows;
  const idx = indexHeader(header, ['name', 'nationalId', 'rollNumber', 'center', 'village']);
  return data.filter(r => r.length > 0).map(r => ({
    name: r[idx.name] || '',
    nationalId: r[idx.nationalId] || '',
    rollNumber: r[idx.rollNumber] || '',
    center: r[idx.center] || '',
    village: r[idx.village] || ''
  }));
}


