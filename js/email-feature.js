// ============================================================
// 送信メール機能（2026/05/06追加）
// ・応募者一覧の📧アイコン → 採用コア内メール作成画面
// ・テンプレ選択で件名・本文を変数展開
// ・「Gmailで送信」で Gmail compose URL を新規タブで開く
// ・送信内容をタイムラインに記録（events）
// ・マスター管理「📧 送信メールテンプレ」タブで CRUD
// ============================================================

let emailTemplates = [];        // 読み込み済みテンプレ
let currentEmailComposerApplicant = null; // 編集中の応募者
let currentEmailTemplate = null; // 編集中のテンプレ
let editingEmailTemplateId = null;

// 利用可能な変数定義
const EMAIL_VARS = [
  { key: 'name',         label: '氏名',          desc: '応募者氏名' },
  { key: 'kana',         label: 'ふりがな',      desc: 'ふりがな' },
  { key: 'email',        label: 'メール',        desc: 'メールアドレス' },
  { key: 'tel',          label: '電話',          desc: '電話番号' },
  { key: 'job_name',     label: '求人名',        desc: '応募求人の名称' },
  { key: 'job_no',       label: '求人番号',      desc: '応募求人の番号' },
  { key: 'job_type',     label: '職種',          desc: '応募職種' },
  { key: 'dept',         label: '部署',          desc: '配属予定部署' },
  { key: 'media',        label: '媒体',          desc: '応募媒体' },
  { key: 'status',       label: 'ステータス',    desc: '現在の選考ステータス' },
  { key: 'app_date',     label: '応募日',        desc: '応募日（YYYY-MM-DD）' },
  { key: 'staff_name',   label: '担当者名',      desc: '現在ログイン中の担当者' },
  { key: 'client_name',  label: 'クライアント名', desc: 'クライアント名' }
];

// ============================================================
// テンプレ読み込み
// ============================================================
async function loadEmailTemplates() {
  if (typeof sb === 'undefined' || !sb) return;
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  if (!cid) { emailTemplates = []; return; }
  try {
    const { data, error } = await sb.from('email_templates').select('*').eq('client_id', cid).order('ord', { ascending: true });
    if (error) { console.warn('[loadEmailTemplates]', error); emailTemplates = []; return; }
    emailTemplates = data || [];
  } catch (e) {
    console.warn('[loadEmailTemplates] exception', e);
    emailTemplates = [];
  }
}

// ============================================================
// 変数展開
// ============================================================
function buildVariableContext(applicant) {
  // 担当者名取得
  let staffName = '';
  try {
    if (typeof currentStaff !== 'undefined' && currentStaff && currentStaff.name) {
      staffName = currentStaff.name;
    } else if (typeof selectedStaffId !== 'undefined' && selectedStaffId && typeof staffList !== 'undefined') {
      const s = (staffList || []).find(x => x.id === selectedStaffId);
      if (s) staffName = s.name || '';
    }
  } catch (e) {}
  // クライアント名
  let clientName = '';
  try {
    if (typeof currentClientName !== 'undefined' && currentClientName) {
      clientName = currentClientName;
    } else if (typeof currentClientId !== 'undefined' && currentClientId) {
      clientName = currentClientId;
    }
  } catch (e) {}
  return {
    name: applicant?.name || '',
    kana: applicant?.kana || '',
    email: applicant?.email || '',
    tel: applicant?.tel || '',
    job_name: applicant?.jobName || '',
    job_no: applicant?.jobNo || '',
    job_type: applicant?.jobType || '',
    dept: applicant?.dept || '',
    media: applicant?.media || '',
    status: applicant?.status || '',
    app_date: applicant?.appDate || '',
    staff_name: staffName,
    client_name: clientName
  };
}

function expandVariables(template, ctx) {
  if (!template) return '';
  return String(template).replace(/\{([a-zA-Z_]+)\}/g, (m, key) => {
    return (ctx && ctx[key] !== undefined && ctx[key] !== null) ? ctx[key] : m;
  });
}

// ============================================================
// メール作成画面の起動
// ============================================================
async function openEmailComposer(applicantId) {
  // 応募者を取得
  const a = (typeof applicants !== 'undefined' && applicants) ? applicants.find(x => x.id === applicantId) : null;
  if (!a) { alert('応募者が見つかりません'); return; }
  if (!a.email) { alert('この応募者にはメールアドレスが登録されていません'); return; }
  currentEmailComposerApplicant = a;
  // テンプレ読み込み
  await loadEmailTemplates();
  // モーダル表示
  const modal = document.getElementById('emailComposerModal');
  if (!modal) return;
  modal.style.display = 'flex';
  // 宛先・受信者表示
  document.getElementById('ecRecipientInfo').textContent = `宛先：${a.name}さん（${a.email}）`;
  document.getElementById('ecToInput').value = a.email;
  document.getElementById('ecSubjectInput').value = '';
  document.getElementById('ecBodyInput').value = '';
  // テンプレセレクト構築
  const sel = document.getElementById('ecTemplateSelect');
  sel.innerHTML = '<option value="">— テンプレなし（手書き） —</option>';
  emailTemplates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
  sel.value = '';
}

function closeEmailComposer() {
  const modal = document.getElementById('emailComposerModal');
  if (modal) modal.style.display = 'none';
  currentEmailComposerApplicant = null;
}

// テンプレ選択時、件名・本文を変数展開して反映
function onEmailTemplateApply() {
  const sel = document.getElementById('ecTemplateSelect');
  if (!sel) return;
  const tid = sel.value;
  if (!tid) {
    // テンプレなしを選んだ場合は本文を空に（ただし既存入力があれば確認）
    const subj = document.getElementById('ecSubjectInput').value;
    const body = document.getElementById('ecBodyInput').value;
    if (subj || body) {
      if (!confirm('現在の入力内容をクリアしますか？')) return;
    }
    document.getElementById('ecSubjectInput').value = '';
    document.getElementById('ecBodyInput').value = '';
    return;
  }
  const t = emailTemplates.find(x => x.id === tid);
  if (!t) return;
  // 既存入力があれば確認
  const subjEl = document.getElementById('ecSubjectInput');
  const bodyEl = document.getElementById('ecBodyInput');
  if ((subjEl.value || bodyEl.value)) {
    if (!confirm('現在の入力内容を上書きします。よろしいですか？')) {
      // 元に戻す
      sel.value = '';
      return;
    }
  }
  const ctx = buildVariableContext(currentEmailComposerApplicant);
  subjEl.value = expandVariables(t.subject || '', ctx);
  bodyEl.value = expandVariables(t.body || '', ctx);
}

// ============================================================
// Gmail起動 + タイムライン記録
// ============================================================
async function sendEmailViaGmail() {
  const to = document.getElementById('ecToInput').value.trim();
  const subj = document.getElementById('ecSubjectInput').value;
  const body = document.getElementById('ecBodyInput').value;
  const recordTimeline = document.getElementById('ecRecordTimeline').checked;
  if (!to) { alert('宛先（TO）を入力してください'); return; }
  // Gmail compose URL を構築
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: to
  });
  if (subj) params.set('su', subj);
  if (body) params.set('body', body);
  const url = 'https://mail.google.com/mail/?' + params.toString();
  // 新規タブで開く
  window.open(url, '_blank', 'noopener');
  // タイムラインに記録
  if (recordTimeline && currentEmailComposerApplicant) {
    try {
      if (typeof recordEvent === 'function') {
        const summary = `📧 メール送信：${subj || '（件名なし）'}`;
        const detail = `宛先: ${to}\n\n${body}`.substring(0, 2000);
        await recordEvent(currentEmailComposerApplicant.id, 'email_sent', summary, detail, null);
      }
    } catch (e) {
      console.warn('[sendEmailViaGmail] timeline record failed', e);
    }
  }
  // モーダル閉じる
  closeEmailComposer();
  // 完了通知
  const msg = recordTimeline ? '✓ Gmail を開きました（タイムラインに記録済み）' : '✓ Gmail を開きました';
  if (typeof showToast === 'function') showToast(msg);
  else alert(msg);
}

// ============================================================
// マスター管理「送信メールテンプレ」タブの描画
// ============================================================
async function renderEmailTemplateMaster() {
  await loadEmailTemplates();
  const host = document.getElementById('etList');
  const cntEl = document.getElementById('mmCountEmailTemplate');
  if (cntEl) cntEl.textContent = emailTemplates.length;
  if (!host) return;
  host.innerHTML = '';
  if (emailTemplates.length === 0) {
    host.innerHTML = '<div style="padding:16px;text-align:center;color:#aaa;font-size:12px;font-style:italic;background:#fafafa;border-radius:7px;">テンプレがまだ登録されていません<br><span style="font-size:10.5px;">下の「＋ 新しいテンプレを追加」から作成できます</span></div>';
    return;
  }
  emailTemplates.forEach(t => {
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border:0.5px solid #e0e0e0;border-radius:8px;padding:12px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
    card.innerHTML = `
      <span style="font-size:18px;">📧</span>
      <div style="flex:1;min-width:200px;">
        <div style="font-size:13px;font-weight:600;">${escHtml(t.name)}</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">件名: ${escHtml((t.subject || '').substring(0, 50))}${(t.subject || '').length > 50 ? '…' : ''}</div>
      </div>
      <button onclick="openEmailTemplateEditorById('${t.id}')" style="padding:6px 12px;background:#fff;border:0.5px solid #185FA5;border-radius:6px;font-size:11px;cursor:pointer;color:#185FA5;font-family:inherit;font-weight:500;">⚙ 編集</button>
      <button onclick="deleteEmailTemplateById('${t.id}')" style="padding:6px 10px;background:#fff;border:0.5px solid #993C1D;border-radius:6px;font-size:11px;cursor:pointer;color:#993C1D;font-family:inherit;">削除</button>
    `;
    host.appendChild(card);
  });
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// 送信メールテンプレ編集モーダル
// ============================================================
function openEmailTemplateEditorForNew() {
  const modal = document.getElementById('emailTemplateEditorModal');
  if (!modal) return;
  modal.style.display = 'flex';
  populateEmailTemplateEditorSelect();
  const sel = document.getElementById('eteTemplateSelect');
  if (sel) sel.value = '__new__';
  onEmailTemplateSelect();
  renderVarChips();
}

function openEmailTemplateEditorById(tid) {
  const modal = document.getElementById('emailTemplateEditorModal');
  if (!modal) return;
  modal.style.display = 'flex';
  populateEmailTemplateEditorSelect();
  const sel = document.getElementById('eteTemplateSelect');
  if (sel) sel.value = tid;
  onEmailTemplateSelect();
  renderVarChips();
}

function closeEmailTemplateEditor() {
  const modal = document.getElementById('emailTemplateEditorModal');
  if (modal) modal.style.display = 'none';
}

function populateEmailTemplateEditorSelect() {
  const sel = document.getElementById('eteTemplateSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="__new__">＋ 新規作成…</option>';
  emailTemplates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
}

function onEmailTemplateSelect() {
  const sel = document.getElementById('eteTemplateSelect');
  if (!sel) return;
  const tid = sel.value;
  if (tid === '__new__') {
    editingEmailTemplateId = null;
    currentEmailTemplate = { name: '', subject: '', body: '' };
  } else {
    const t = emailTemplates.find(x => x.id === tid);
    if (!t) return;
    editingEmailTemplateId = t.id;
    currentEmailTemplate = JSON.parse(JSON.stringify(t));
  }
  document.getElementById('eteTemplateName').value = currentEmailTemplate.name || '';
  document.getElementById('eteSubject').value = currentEmailTemplate.subject || '';
  document.getElementById('eteBody').value = currentEmailTemplate.body || '';
}

function renderVarChips() {
  const host = document.getElementById('eteVarChips');
  if (!host) return;
  host.innerHTML = '';
  EMAIL_VARS.forEach(v => {
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:5px 10px;background:#fff;border:0.5px solid #e0e0e0;border-radius:14px;font-size:10.5px;cursor:pointer;font-family:inherit;color:#444441;line-height:1.3;display:inline-flex;align-items:center;gap:5px;';
    btn.innerHTML = `${escHtml(v.label)} <span style="color:#888;font-size:9.5px;font-family:Menlo,Consolas,monospace;">{${v.key}}</span>`;
    btn.title = v.desc;
    btn.onmouseover = () => { btn.style.borderColor = '#534AB7'; btn.style.color = '#534AB7'; };
    btn.onmouseout = () => { btn.style.borderColor = '#e0e0e0'; btn.style.color = '#444441'; };
    btn.onclick = () => insertVarAtCursor(v.key);
    host.appendChild(btn);
  });
}

function insertVarAtCursor(varKey) {
  // どっちのフィールドにフォーカスがあるかで挿入先を決定
  const subjEl = document.getElementById('eteSubject');
  const bodyEl = document.getElementById('eteBody');
  const target = (document.activeElement === subjEl) ? subjEl : bodyEl;
  const varStr = `{${varKey}}`;
  const start = target.selectionStart || 0;
  const end = target.selectionEnd || 0;
  const before = target.value.substring(0, start);
  const after = target.value.substring(end);
  target.value = before + varStr + after;
  // カーソル位置を末尾に
  target.focus();
  const newPos = start + varStr.length;
  target.setSelectionRange(newPos, newPos);
}

async function saveEmailTemplate() {
  const name = document.getElementById('eteTemplateName').value.trim();
  const subject = document.getElementById('eteSubject').value;
  const body = document.getElementById('eteBody').value;
  if (!name) { alert('テンプレ名を入力してください'); return; }
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  if (!cid) { alert('クライアントが特定できません'); return; }
  try {
    if (editingEmailTemplateId) {
      const { error } = await sb.from('email_templates').update({
        name, subject, body, updated_at: new Date().toISOString()
      }).eq('id', editingEmailTemplateId);
      if (error) { alert('保存失敗: ' + error.message); return; }
    } else {
      const ord = emailTemplates.length;
      const { data, error } = await sb.from('email_templates').insert({
        client_id: cid, name, subject, body, ord
      }).select().single();
      if (error) { alert('保存失敗: ' + error.message); return; }
      editingEmailTemplateId = data.id;
    }
    alert('✓ テンプレを保存しました');
    await loadEmailTemplates();
    populateEmailTemplateEditorSelect();
    const sel = document.getElementById('eteTemplateSelect');
    if (sel && editingEmailTemplateId) sel.value = editingEmailTemplateId;
    // マスター管理画面が開いていれば再描画
    renderEmailTemplateMaster();
  } catch (e) {
    alert('保存エラー: ' + e.message);
  }
}

async function deleteEmailTemplateFromEditor() {
  if (!editingEmailTemplateId) { alert('削除対象のテンプレがありません'); return; }
  await deleteEmailTemplateById(editingEmailTemplateId);
  // 削除後は新規モードへ
  editingEmailTemplateId = null;
  const sel = document.getElementById('eteTemplateSelect');
  if (sel) sel.value = '__new__';
  onEmailTemplateSelect();
}

async function deleteEmailTemplateById(tid) {
  const t = emailTemplates.find(x => x.id === tid);
  if (!t) return;
  if (!confirm(`テンプレ「${t.name}」を削除します。よろしいですか？`)) return;
  try {
    const { error } = await sb.from('email_templates').delete().eq('id', tid);
    if (error) { alert('削除失敗: ' + error.message); return; }
    await loadEmailTemplates();
    renderEmailTemplateMaster();
    populateEmailTemplateEditorSelect();
  } catch (e) {
    alert('削除エラー: ' + e.message);
  }
}

async function duplicateEmailTemplate() {
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  if (!cid) { alert('クライアントが特定できません'); return; }
  try {
    const ord = emailTemplates.length;
    const { data, error } = await sb.from('email_templates').insert({
      client_id: cid,
      name: (currentEmailTemplate.name || 'コピー') + ' のコピー',
      subject: document.getElementById('eteSubject').value,
      body: document.getElementById('eteBody').value,
      ord
    }).select().single();
    if (error) { alert('複製失敗: ' + error.message); return; }
    alert('✓ テンプレを複製しました');
    await loadEmailTemplates();
    populateEmailTemplateEditorSelect();
    const sel = document.getElementById('eteTemplateSelect');
    if (sel) sel.value = data.id;
    editingEmailTemplateId = data.id;
    onEmailTemplateSelect();
    renderEmailTemplateMaster();
  } catch (e) {
    alert('複製エラー: ' + e.message);
  }
}

// ============================================================
// switchMmTab フック：送信メールテンプレタブで描画
// ============================================================
(function hookSwitchMmTabForEmailTemplate() {
  const orig = window.switchMmTab;
  if (typeof orig !== 'function') return;
  window.switchMmTab = function(tab) {
    const ret = orig.apply(this, arguments);
    if (tab === 'email-template') {
      renderEmailTemplateMaster();
    }
    return ret;
  };
})();

// renderManageフック：マスター管理開いたとき件数バッジ更新
(function hookRenderManageForEmailTemplate() {
  const orig = window.renderManage;
  if (typeof orig !== 'function') return;
  window.renderManage = function() {
    const ret = orig.apply(this, arguments);
    loadEmailTemplates().then(() => {
      const cntEl = document.getElementById('mmCountEmailTemplate');
      if (cntEl) cntEl.textContent = emailTemplates.length;
    });
    return ret;
  };
})();

// ============================================================
// グローバル公開
// ============================================================
if (typeof window !== 'undefined') {
  window.openEmailComposer = openEmailComposer;
  window.closeEmailComposer = closeEmailComposer;
  window.onEmailTemplateApply = onEmailTemplateApply;
  window.sendEmailViaGmail = sendEmailViaGmail;
  window.renderEmailTemplateMaster = renderEmailTemplateMaster;
  window.openEmailTemplateEditorForNew = openEmailTemplateEditorForNew;
  window.openEmailTemplateEditorById = openEmailTemplateEditorById;
  window.closeEmailTemplateEditor = closeEmailTemplateEditor;
  window.onEmailTemplateSelect = onEmailTemplateSelect;
  window.insertVarAtCursor = insertVarAtCursor;
  window.saveEmailTemplate = saveEmailTemplate;
  window.deleteEmailTemplateFromEditor = deleteEmailTemplateFromEditor;
  window.deleteEmailTemplateById = deleteEmailTemplateById;
  window.duplicateEmailTemplate = duplicateEmailTemplate;
}

console.log('[email-feature] 読み込み完了');
