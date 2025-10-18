import dotenv from 'dotenv';
dotenv.config();
import TelegramBot from 'node-telegram-bot-api';
import { listDelegates, listSupervisors, listVoters, recordVote } from './sheets.js';

const token = process.env.TELEGRAM_BOT_TOKEN || '';
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is missing');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

function isArabic(text) { return /[\u0600-\u06FF]/.test(text); }

function buildVoterButtons(voters) {
  const stateButtons = voters.map(v => [{ text: v.name, callback_data: `v:${v.nationalId}` }]);
  return { inline_keyboard: stateButtons };
}

function buildVoteActionButtons(voter) {
  const name = voter?.name || 'الناخب';
  return {
    inline_keyboard: [[
      { text: 'تم التصويت', callback_data: `a:${voter.nationalId}:VOTED` },
      { text: 'لم يتم', callback_data: `a:${voter.nationalId}:NOT_VOTED` },
      { text: 'صوت باطل', callback_data: `a:${voter.nationalId}:INVALID` }
    ], [
      { text: `رجوع للقائمة`, callback_data: `back` }
    ]]
  };
}

// In-memory per-session state (no DB)
const userState = new Map();
const pinnedMessages = new Map(); // userId -> { messageId, role }

function getUser(id) {
  return userState.get(id) || {};
}

function setUser(id, state) {
  userState.set(id, { ...(userState.get(id) || {}), ...state });
}

function filterVotersForDelegate(allVoters, delegate) {
  return allVoters.filter(v => v.center === delegate.center && v.village === delegate.village);
}

// Placeholder: you will load voters from pre-uploaded sheets tabs named Voters_<village>
async function loadAllVoters() {
  return await listVoters();
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id || '');
  let delegates = [];
  let supervisors = [];
  try {
    delegates = await listDelegates();
    supervisors = await listSupervisors();
  } catch (e) {
    console.error('Error loading delegates/supervisors:', e.message);
    await bot.sendMessage(chatId, 'خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.');
    return;
  }
  const isDelegate = delegates.find(d => d.userId === userId);
  const isSupervisor = supervisors.find(s => s.userId === userId);

  if (!isDelegate && !isSupervisor) {
    await bot.sendMessage(chatId, 'عذراً، هذا البوت مخصص للمندوبين والمشرفين فقط.');
    return;
  }

  if (isDelegate) {
    setUser(userId, { role: 'delegate', profile: isDelegate });
    await ensurePinnedStatusMessage(chatId, userId, 'delegate');
    await bot.sendMessage(chatId, `مرحباً ${isDelegate.name}!\nالمركز: ${isDelegate.center}\nالقرية/النجع: ${isDelegate.village}`, { reply_markup: { inline_keyboard: [[{ text: 'فتح قائمة الناخبين', callback_data: 'open_list' }],[{ text: 'نسبة تقدمي', callback_data: 'my_progress' }]] } });
    return;
  }

  if (isSupervisor) {
    setUser(userId, { role: 'supervisor', profile: isSupervisor });
    await ensurePinnedStatusMessage(chatId, userId, 'supervisor');
    await bot.sendMessage(chatId, `مرحباً ${isSupervisor.name}!`, { reply_markup: { inline_keyboard: [[{ text: 'عرض التقدم', callback_data: 'progress' }]] } });
  }
});

bot.on('callback_query', async (query) => {
  const userId = String(query.from.id);
  const chatId = query.message.chat.id;
  const data = query.data || '';
  const state = getUser(userId);

  if (data === 'open_list') {
    const allVoters = await loadAllVoters();
    const voters = filterVotersForDelegate(allVoters, state.profile || {});
    const pageSize = 20;
    setUser(userId, { voters, filtered: voters, page: 0, pageSize });
    const pageItems = voters.slice(0, pageSize);
    const nav = buildPaginationButtons(0, pageSize, voters.length);
    const delegate = state.profile || {};
    const title = `قائمة الناخبين - ${delegate.village}\nالمركز: ${delegate.center}\nعدد الناخبين: ${voters.length}`;
    await bot.editMessageText(title, { chat_id: chatId, message_id: query.message.message_id, reply_markup: mergeKeyboards(buildVoterButtons(pageItems), nav) });
    return bot.answerCallbackQuery(query.id);
  }

  if (data === 'back') {
    // Rebuild the voter list with remaining voters
    const all = (state.filtered || []).filter(x => !x._done);
    const page = state.page || 0;
    const size = state.pageSize || 20;
    const start = page * size;
    const pageItems = all.slice(start, start + size);
    const nav = buildPaginationButtons(page, size, all.length);
    const delegate = state.profile || {};
    const title = `قائمة الناخبين - ${delegate.village}\nالمركز: ${delegate.center}\nعدد الناخبين المتبقيين: ${all.length}`;
    await bot.editMessageText(title, { chat_id: chatId, message_id: query.message.message_id, reply_markup: mergeKeyboards(buildVoterButtons(pageItems), nav) });
    return bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith('v:')) {
    const nationalId = data.split(':')[1];
    const voter = (state.filtered || []).find(x => x.nationalId === nationalId);
    if (!voter) {
      await bot.answerCallbackQuery(query.id, { text: 'الناخب غير موجود', show_alert: true });
      return;
    }
    setUser(userId, { selectedVoter: voter });
    const voterInfo = `الناخب: ${voter.name}\nالرقم القومي: ${voter.nationalId}\nرقم الناخب: ${voter.voterNumber}\nالقرية/النجع: ${voter.village}\nالمركز: ${voter.center}\n\nاختر الحالة:`;
    await bot.editMessageText(voterInfo, { chat_id: chatId, message_id: query.message.message_id, reply_markup: buildVoteActionButtons(voter) });
    return bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith('a:')) {
    const [, nationalId, status] = data.split(':');
    const voter = (state.filtered || []).find(x => x.nationalId === nationalId);
    if (!voter) {
      await bot.answerCallbackQuery(query.id, { text: 'الناخب غير موجود', show_alert: true });
      return;
    }
    await recordVote({
      delegateUserId: userId,
      voterNationalId: nationalId,
      status,
      center: voter.center,
      village: voter.village
    });
    // mark as done locally so it disappears from list
    voter._done = true;
    // update pinned message for this delegate
    await updatePinnedStatusMessage(chatId, userId);
    
    const statusText = status === 'VOTED' ? 'تم التصويت' : status === 'NOT_VOTED' ? 'لم يتم التصويت' : 'صوت باطل';
    const confirmMessage = `✅ تم حفظ الحالة بنجاح\nالناخب: ${voter.name}\nالحالة: ${statusText}\n\nالرجوع للقائمة:`;
    await bot.editMessageText(confirmMessage, { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: [[{ text: 'رجوع للقائمة', callback_data: 'back' }]] } });
    return bot.answerCallbackQuery(query.id, { text: 'تم حفظ الحالة بنجاح' });
  }

  if (data === 'progress') {
    await bot.answerCallbackQuery(query.id);
    try {
      const center = (state.profile || {}).center || '';
      const votes = await import('./sheets.js').then(m => m.listVotes());
      const allVoters = await loadAllVoters();
      const centerVoters = allVoters.filter(v => v.center === center);
      const centerVotes = votes.filter(v => v.center === center);
      
      const totalVoters = centerVoters.length; // إجمالي الناخبين المسجلين
      const totalVoted = centerVotes.filter(v => v.status === 'VOTED' || v.status === 'INVALID').length; // إجمالي المصوتين
      const voted = centerVotes.filter(v => v.status === 'VOTED').length; // تم التصويت
      const invalid = centerVotes.filter(v => v.status === 'INVALID').length; // صوت باطل
      const notVoted = centerVotes.filter(v => v.status === 'NOT_VOTED').length; // لم يتم التصويت
      const remaining = totalVoters - totalVoted; // الأصوات المتبقية
      const progressPercent = totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0; // نسبة الإنجاز
      
      const progressText = `📊 تقرير المشرف\n\nالمركز: ${center}\n\n📋 إجمالي الناخبين المسجلين: ${totalVoters}\n🗳️ إجمالي المصوتين: ${totalVoted}\n  ✅ تم التصويت: ${voted}\n  ⚠️ صوت باطل: ${invalid}\n❌ لم يتم التصويت: ${notVoted}\n⏳ الأصوات المتبقية: ${remaining}\n\n📈 نسبة الإنجاز: ${progressPercent}%`;
      await bot.sendMessage(chatId, progressText);
    } catch (e) {
      await bot.sendMessage(chatId, 'تعذر عرض التقدم الآن.');
    }
  }
  if (data === 'my_progress') {
    await bot.answerCallbackQuery(query.id);
    try {
      const votes = await import('./sheets.js').then(m => m.listVotes());
      const allVoters = await loadAllVoters();
      const delegate = state.profile || {};
      const myVoters = allVoters.filter(v => v.center === delegate.center && v.village === delegate.village);
      const myVotes = votes.filter(v => v.delegateUserId === userId);
      
      const totalVoters = myVoters.length; // إجمالي الناخبين المسجلين
      const totalVoted = myVotes.filter(v => v.status === 'VOTED' || v.status === 'INVALID').length; // إجمالي المصوتين (تم + باطل)
      const voted = myVotes.filter(v => v.status === 'VOTED').length; // تم التصويت
      const invalid = myVotes.filter(v => v.status === 'INVALID').length; // صوت باطل
      const notVoted = myVotes.filter(v => v.status === 'NOT_VOTED').length; // لم يتم التصويت
      const remaining = totalVoters - totalVoted; // الأصوات المتبقية
      const progressPercent = totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0; // نسبة الإنجاز
      
      const progressText = `📊 نسبة تقدمي\n\nالمركز: ${delegate.center}\nالقرية/النجع: ${delegate.village}\n\n📋 إجمالي الناخبين المسجلين: ${totalVoters}\n🗳️ إجمالي المصوتين: ${totalVoted}\n  ✅ تم التصويت: ${voted}\n  ⚠️ صوت باطل: ${invalid}\n❌ لم يتم التصويت: ${notVoted}\n⏳ الأصوات المتبقية: ${remaining}\n\n📈 نسبة الإنجاز: ${progressPercent}%`;
      await bot.sendMessage(chatId, progressText);
    } catch (e) {
      await bot.sendMessage(chatId, 'تعذر عرض النسبة حالياً.');
    }
  }
});

function buildPaginationButtons(page, size, total) {
  const maxPage = Math.max(0, Math.ceil(total / size) - 1);
  const canPrev = page > 0;
  const canNext = page < maxPage;
  const navRow = [];
  if (canPrev) navRow.push({ text: '⟵ السابق', callback_data: 'pg:prev' });
  navRow.push({ text: `${page + 1}/${maxPage + 1}`, callback_data: 'noop' });
  if (canNext) navRow.push({ text: 'التالي ⟶', callback_data: 'pg:next' });
  return { inline_keyboard: navRow.length ? [navRow] : [] };
}

function mergeKeyboards(a, b) {
  return { inline_keyboard: [...(a.inline_keyboard || []), ...(b.inline_keyboard || [])] };
}

bot.on('callback_query', async (query) => {
  const userId = String(query.from.id);
  const chatId = query.message.chat.id;
  const data = query.data || '';
  const state = getUser(userId);
  if (data === 'pg:prev' || data === 'pg:next') {
    const all = (state.filtered || []).filter(x => !x._done);
    const size = state.pageSize || 20;
    let page = state.page || 0;
    page = data === 'pg:prev' ? Math.max(0, page - 1) : Math.min(Math.ceil(all.length / size) - 1, page + 1);
    setUser(userId, { page });
    const start = page * size;
    const pageItems = all.slice(start, start + size);
    const nav = buildPaginationButtons(page, size, all.length);
    const delegate = state.profile || {};
    const title = `قائمة الناخبين - ${delegate.village}\nالمركز: ${delegate.center}\nعدد الناخبين المتبقيين: ${all.length}`;
    await bot.editMessageText(title, { chat_id: chatId, message_id: query.message.message_id, reply_markup: mergeKeyboards(buildVoterButtons(pageItems), nav) });
    return bot.answerCallbackQuery(query.id);
  }
});

async function ensurePinnedStatusMessage(chatId, userId, role) {
  try {
    const text = await generateStatusText(userId, role);
    const sent = await bot.sendMessage(chatId, text, { disable_web_page_preview: true });
    try { await bot.pinChatMessage(chatId, sent.message_id); } catch { /* ignore if not permitted */ }
    pinnedMessages.set(userId, { messageId: sent.message_id, role });
  } catch (e) {
    // ignore
  }
}

async function updatePinnedStatusMessage(chatId, userId) {
  const pinned = pinnedMessages.get(userId);
  if (!pinned) return;
  const state = getUser(userId);
  const role = pinned.role || state.role || 'delegate';
  try {
    const text = await generateStatusText(userId, role);
    await bot.editMessageText(text, { chat_id: chatId, message_id: pinned.messageId, disable_web_page_preview: true });
  } catch (e) {
    // ignore edit errors
  }
}

async function generateStatusText(userId, role) {
  const votes = await import('./sheets.js').then(m => m.listVotes());
  if (role === 'delegate') {
    const state = getUser(userId);
    const delegate = state.profile || {};
    const allVoters = await loadAllVoters();
    const myVoters = allVoters.filter(v => v.center === delegate.center && v.village === delegate.village);
    const myVotes = votes.filter(v => v.delegateUserId === userId);
    
    const totalVoters = myVoters.length; // إجمالي الناخبين المسجلين
    const totalVoted = myVotes.filter(v => v.status === 'VOTED' || v.status === 'INVALID').length; // إجمالي المصوتين
    const voted = myVotes.filter(v => v.status === 'VOTED').length; // تم التصويت
    const invalid = myVotes.filter(v => v.status === 'INVALID').length; // صوت باطل
    const notVoted = myVotes.filter(v => v.status === 'NOT_VOTED').length; // لم يتم التصويت
    const remaining = totalVoters - totalVoted; // الأصوات المتبقية
    const progress = totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0; // نسبة الإنجاز
    
    return `📌 رسالة مثبّتة — تقدّم المندوب\n\nالمركز: ${delegate.center}\nالقرية/النجع: ${delegate.village}\n\n📋 إجمالي الناخبين: ${totalVoters}\n🗳️ إجمالي المصوتين: ${totalVoted}\n  ✅ تم: ${voted} | ⚠️ باطل: ${invalid}\n❌ لم يتم: ${notVoted}\n⏳ متبقي: ${remaining}\n\n📈 نسبة الإنجاز: ${progress}%`;
  }
  // supervisor: show center totals
  const state = getUser(userId);
  const center = (state.profile || {}).center || '';
  const allVoters = await loadAllVoters();
  const centerVoters = allVoters.filter(v => v.center === center);
  const centerVotes = votes.filter(v => v.center === center);
  
  const totalVoters = centerVoters.length; // إجمالي الناخبين المسجلين
  const totalVoted = centerVotes.filter(v => v.status === 'VOTED' || v.status === 'INVALID').length; // إجمالي المصوتين
  const voted = centerVotes.filter(v => v.status === 'VOTED').length; // تم التصويت
  const invalid = centerVotes.filter(v => v.status === 'INVALID').length; // صوت باطل
  const notVoted = centerVotes.filter(v => v.status === 'NOT_VOTED').length; // لم يتم التصويت
  const remaining = totalVoters - totalVoted; // الأصوات المتبقية
  const progress = totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0; // نسبة الإنجاز
  
  return `📌 رسالة مثبّتة — تقرير المشرف\n\nالمركز: ${center}\n\n📋 إجمالي الناخبين: ${totalVoters}\n🗳️ إجمالي المصوتين: ${totalVoted}\n  ✅ تم: ${voted} | ⚠️ باطل: ${invalid}\n❌ لم يتم: ${notVoted}\n⏳ متبقي: ${remaining}\n\n📈 نسبة الإنجاز: ${progress}%`;
}

// periodic refresh every 5 minutes
setInterval(async () => {
  for (const [userId, meta] of pinnedMessages.entries()) {
    const state = getUser(userId);
    const chatId = Number(state?.profile ? state.profile.userId : userId); // for private chat, chat id == user id
    await updatePinnedStatusMessage(chatId, userId);
  }
}, 5 * 60 * 1000);

console.log('Telegram bot running...');


