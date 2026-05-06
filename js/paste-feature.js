// ============================================================
// AIペースト機能（2026/05/05追加）
// 採用コア：登録方法選択 → AIペースト → 解析・確認 → 一括登録
// テンプレ管理：マッピングルールで媒体メールを正規化登録
// ============================================================

// グローバル状態
let pasteBoxes = [];           // [{id, text}]
let parsedResults = [];        // 解析結果配列
let pasteTemplates = [];       // 読み込み済みテンプレ
let currentTemplate = null;    // 編集中のテンプレ
let editingTemplateId = null;  // 編集対象テンプレID

// 採用コアのフィールド一覧（マッピングのターゲット）
const TARGET_FIELDS = [
  { key: 'name',       label: '氏名（必須）' },
  { key: 'kana',       label: 'ふりがな（必須）' },
  { key: 'tel',        label: '電話番号（必須・自動ハイフン付与）' },
  { key: 'email',      label: 'メール（必須）' },
  { key: 'address',    label: '住所' },
  { key: 'birthdate',  label: '生年月日（年齢自動計算）' },
  { key: 'job_name',   label: '求人名称' },
  { key: 'job_no',     label: '求人番号' },
  { key: 'job_type',   label: '応募職種（必須）' },
  { key: 'gender',     label: '性別（必須）' },
  { key: 'media',      label: '媒体（必須）' },
  { key: 'status',     label: '詳細ステータス（必須）' },
  { key: 'dept',       label: '部署' },
  { key: 'agency',     label: '人材紹介会社' },
  { key: 'memo',       label: 'メモ' },
  { key: 'app_date',   label: '応募日' },
  { key: 'location',   label: '勤務地' }
];

// マッピング種別
// extract: ラベル抽出（"お名前：金子" → "金子"）
// split:   分割抽出（"〇〇/13888" の/前後）
// fixed:   固定値（媒体「JOBこあ」を自動セット）
// auto:    自動値（部署マスタ最上位、今日の日付など）
const MAPPING_KINDS = {
  extract: { label: '取得', cls: 'extract', desc: '本文の特定パターンから値を抽出' },
  split:   { label: '分割', cls: 'split',   desc: '区切り文字で分割して片方を採用' },
  fixed:   { label: '固定', cls: 'fixed',   desc: '常に同じ値をセット' },
  auto:    { label: '自動', cls: 'auto',    desc: 'システムが自動で値を決定（部署マスタ最上位、今日の日付など）' }
};

// ============================================================
// 画面遷移
// ============================================================
function goAddChoice() {
  if (typeof showSec === 'function') showSec('add-choice');
}

function goPasteRegister() {
  showSec('add-paste');
  // 状態リセット
  pasteBoxes = [];
  parsedResults = [];
  showPasteStep(1);
  // テンプレ読み込み
  loadPasteTemplates().then(() => {
    populatePasteTemplateSelect();
    // 1件目の枠を初期表示
    addPasteBox();
  });
}

function goManualRegister() {
  // 既存の手動登録に飛ぶ
  if (typeof goNewApplicantForm === 'function') goNewApplicantForm();
}

function showPasteStep(step) {
  document.getElementById('pasteStep1').style.display = (step === 1) ? '' : 'none';
  document.getElementById('pasteStep2').style.display = (step === 2) ? '' : 'none';
  document.querySelectorAll('.paste-step').forEach(el => {
    const n = parseInt(el.dataset.step, 10);
    if (n <= step) {
      el.style.background = '#534AB7';
      el.style.color = '#fff';
      el.style.border = 'none';
    } else {
      el.style.background = '#fff';
      el.style.color = '#888';
      el.style.border = '0.5px solid #e0e0e0';
    }
  });
}

function backToPasteStep1() {
  showPasteStep(1);
}

// ============================================================
// テンプレ読み込み
// ============================================================
async function loadPasteTemplates() {
  if (typeof sb === 'undefined' || !sb) return;
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  if (!cid) {
    pasteTemplates = [];
    return;
  }
  try {
    const { data, error } = await sb.from('paste_templates').select('*').eq('client_id', cid).order('ord', { ascending: true });
    if (error) {
      console.warn('[loadPasteTemplates]', error);
      pasteTemplates = [];
      return;
    }
    pasteTemplates = data || [];

    // テンプレが0件で、かつクライアントなら、JOBこあのデフォルトテンプレを自動投入
    if (pasteTemplates.length === 0 && cid !== 'admin') {
      const defTemplate = buildDefaultJobKoaTemplate(cid);
      const { data: insData, error: insErr } = await sb.from('paste_templates').insert(defTemplate).select().single();
      if (!insErr && insData) {
        pasteTemplates = [insData];
      }
    }
  } catch (e) {
    console.warn('[loadPasteTemplates] exception', e);
    pasteTemplates = [];
  }
}

function buildDefaultJobKoaTemplate(cid) {
  return {
    client_id: cid,
    name: 'JOBこあ',
    sample_text: `件名：【JOBこあ】エントリーがありました
差出人：lc-hp@link-core.co.jp
本文：
※自動送信メールです。

求人にエントリーがありました。

-----------------------------------
お名前：金子壱誠
ふりがな：かねこいっせい
電話番号：08050091862
メールアドレス：issei0225k@gmail.com
住所：埼玉県新座市本多1-1-34
生年月日：1995年2月25日
その他希望事項など：今現在宮古島でリゾートバイトしています。
応募求人タイトル：【不動産賃貸保証の債権管理・家賃アドバイザー】意欲・人柄重視の採用スタイル/13888

応募求人URL：https://link-core.co.jp/jobcore/job-openings/200010/`,
    mappings: [
      { kind: 'extract', config: { label: 'お名前' },          target: 'name'      },
      { kind: 'extract', config: { label: 'ふりがな' },        target: 'kana'      },
      { kind: 'extract', config: { label: '電話番号' },        target: 'tel'       },
      { kind: 'extract', config: { label: 'メールアドレス' },   target: 'email'     },
      { kind: 'extract', config: { label: '住所' },            target: 'address'   },
      { kind: 'extract', config: { label: '生年月日' },        target: 'birthdate' },
      { kind: 'split',   config: { label: '応募求人タイトル', sep: '/', side: 'before' }, target: 'job_name' },
      { kind: 'split',   config: { label: '応募求人タイトル', sep: '/', side: 'after'  }, target: 'job_no'   },
      { kind: 'extract', config: { label: 'その他希望事項など' }, target: 'memo'    },
      { kind: 'fixed',   config: { value: 'JOBこあ' },          target: 'media'     },
      { kind: 'fixed',   config: { value: '応募' },             target: 'status'    },
      { kind: 'auto',    config: { source: 'dept_top' },       target: 'dept'      },
      { kind: 'auto',    config: { source: 'today' },          target: 'app_date'  }
    ],
    is_default: true,
    ord: 0
  };
}

// ============================================================
// テンプレセレクトの再描画
// ============================================================
function populatePasteTemplateSelect() {
  const sel = document.getElementById('pasteTemplateSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">— テンプレを選択 —</option>';
  pasteTemplates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name + (t.is_default ? '（デフォルト）' : '');
    sel.appendChild(opt);
  });
  // デフォルトテンプレがあれば自動選択
  const def = pasteTemplates.find(t => t.is_default);
  if (def) {
    sel.value = def.id;
    onPasteTemplateChange();
  }
}

function onPasteTemplateChange() {
  const sel = document.getElementById('pasteTemplateSelect');
  const info = document.getElementById('pasteTemplateInfo');
  if (!sel || !info) return;
  const tid = sel.value;
  if (!tid) {
    info.style.display = 'none';
    return;
  }
  const t = pasteTemplates.find(x => x.id === tid);
  if (!t) { info.style.display = 'none'; return; }
  const cnt = (t.mappings || []).length;
  info.style.display = '';
  info.textContent = `✓ テンプレ「${t.name}」を読み込みました（${cnt}項目のマッピング設定済み）`;
}

// ============================================================
// ペースト枠の管理
// ============================================================
function addPasteBox() {
  const id = 'pb_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
  pasteBoxes.push({ id, text: '' });
  renderPasteBoxes();
  // 最後の枠にフォーカス
  setTimeout(() => {
    const ta = document.querySelector(`[data-pb-id="${id}"] textarea`);
    if (ta) ta.focus();
  }, 50);
}

function removePasteBox(id) {
  if (pasteBoxes.length <= 1) {
    alert('ペースト枠は最低1つ必要です');
    return;
  }
  pasteBoxes = pasteBoxes.filter(b => b.id !== id);
  renderPasteBoxes();
}

function clearAllPasteBoxes() {
  if (!confirm('すべてのペースト内容をクリアしますか？')) return;
  pasteBoxes = [];
  addPasteBox();
}

function onPasteBoxInput(id, val) {
  const b = pasteBoxes.find(x => x.id === id);
  if (b) {
    b.text = val;
    // 空かどうかでクラス切り替え
    const wrap = document.querySelector(`[data-pb-id="${id}"]`);
    if (wrap) {
      if (val.trim()) {
        wrap.classList.remove('empty');
        wrap.querySelector('.paste-box-num').classList.remove('empty');
      } else {
        wrap.classList.add('empty');
        wrap.querySelector('.paste-box-num').classList.add('empty');
      }
    }
  }
}

function renderPasteBoxes() {
  const host = document.getElementById('pasteBoxList');
  if (!host) return;
  host.innerHTML = '';
  pasteBoxes.forEach((b, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'paste-box' + (b.text.trim() ? '' : ' empty');
    wrap.dataset.pbId = b.id;
    wrap.innerHTML = `
      <div class="paste-box-head">
        <span class="paste-box-num${b.text.trim() ? '' : ' empty'}">#${i + 1}</span>
        <span class="paste-box-label">${b.text.trim() ? '応募者' + (i+1) + '人目のメール本文' : (i + 1) + '人目のメール本文を貼り付け…'}</span>
        <button class="paste-box-remove" onclick="removePasteBox('${b.id}')">✕ この枠を削除</button>
      </div>
      <textarea class="paste-textarea" placeholder="ここに${i + 1}人目のメール本文をペースト" oninput="onPasteBoxInput('${b.id}', this.value)">${escapeHtml(b.text)}</textarea>
    `;
    host.appendChild(wrap);
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// 解析エンジン（正規表現とパース、外部API不要）
// ============================================================
function parseSingleEmail(text, template) {
  const result = {
    fields: {},     // {name: '金子壱誠', tel: '...', ...}
    mapped: {},     // どの項目がマッピングからセットされたか
    errors: []      // 解析失敗項目
  };
  if (!text || !text.trim()) {
    result.errors.push('本文が空です');
    return result;
  }
  if (!template) {
    result.errors.push('テンプレが選択されていません');
    return result;
  }
  const mappings = template.mappings || [];
  for (const m of mappings) {
    try {
      const val = applyMapping(text, m);
      if (val !== null && val !== undefined && val !== '') {
        result.fields[m.target] = val;
        result.mapped[m.target] = m.kind;
      }
    } catch (e) {
      result.errors.push(`${m.target}: ${e.message}`);
    }
  }
  // 後処理（電話ハイフン付与、生年月日 → 年齢計算）
  postProcessFields(result.fields);
  return result;
}

function applyMapping(text, mapping) {
  const { kind, config, target } = mapping;
  switch (kind) {
    case 'extract':
      return extractByLabel(text, config.label);
    case 'split': {
      const raw = extractByLabel(text, config.label);
      if (!raw) return null;
      return splitValue(raw, config.sep, config.side);
    }
    case 'fixed':
      return config.value;
    case 'auto':
      return resolveAutoValue(config.source);
    default:
      return null;
  }
}

function extractByLabel(text, label) {
  if (!label) return null;
  // 正規表現で「ラベル：」のあとを抜き出す
  // 全角コロン／半角コロン、余白を許容
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*[:：]\\s*([^\\n]+)', 'i');
  const m = text.match(re);
  if (!m) return null;
  return (m[1] || '').trim();
}

function splitValue(value, sep, side) {
  if (!value) return null;
  const idx = value.lastIndexOf(sep);   // 末尾のセパレータで分割
  if (idx < 0) return value;
  if (side === 'before') return value.substring(0, idx).trim();
  if (side === 'after')  return value.substring(idx + sep.length).trim();
  return value;
}

function resolveAutoValue(source) {
  switch (source) {
    case 'today':
      return formatDateYMD(new Date());
    case 'dept_top':
      // クライアントの部署マスタ最上位
      if (typeof masters !== 'undefined' && masters && masters.dept && masters.dept.length) {
        return masters.dept[0];
      }
      return null;
    case 'now':
      return new Date().toISOString();
    default:
      return null;
  }
}

function formatDateYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function postProcessFields(fields) {
  // 電話番号のハイフン付与
  if (fields.tel) {
    fields.tel = formatPhone(fields.tel);
  }
  // 生年月日のフォーマット統一＋年齢自動計算
  if (fields.birthdate) {
    const parsed = parseBirthdate(fields.birthdate);
    if (parsed) {
      fields.birthdate = parsed.formatted;
      fields.birth_year = parsed.year;
      fields.birth_month = parsed.month;
      fields.birth_day = parsed.day;
      fields.age = parsed.age;
    }
  }
  // メールアドレスは小文字化
  if (fields.email) {
    fields.email = String(fields.email).trim().toLowerCase();
  }
  // 名前のトリム
  if (fields.name) {
    fields.name = String(fields.name).replace(/\s+/g, ' ').trim();
  }
}

function formatPhone(tel) {
  if (!tel) return tel;
  const digits = String(tel).replace(/[^\d]/g, '');
  // 携帯（11桁）：080-XXXX-XXXX
  if (digits.length === 11 && /^0[789]0/.test(digits)) {
    return digits.substring(0, 3) + '-' + digits.substring(3, 7) + '-' + digits.substring(7);
  }
  // 固定（10桁）：03-XXXX-XXXX or 0X-XXXX-XXXX
  if (digits.length === 10) {
    if (/^03|^06/.test(digits)) {
      return digits.substring(0, 2) + '-' + digits.substring(2, 6) + '-' + digits.substring(6);
    }
    return digits.substring(0, 3) + '-' + digits.substring(3, 6) + '-' + digits.substring(6);
  }
  return tel; // フォーマット不明はそのまま
}

function parseBirthdate(s) {
  if (!s) return null;
  // 「1995年2月25日」「1995/2/25」「1995-02-25」を許容
  let m = s.match(/(\d{4})\s*[年/\-]\s*(\d{1,2})\s*[月/\-]\s*(\d{1,2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const formatted = `${y}年${mo}月${d}日`;
  // 年齢計算
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return { year: y, month: mo, day: d, formatted, age };
}

// ============================================================
// 解析実行（複数のペースト枠をまとめて処理）
// ============================================================
function analyzePastes() {
  // テンプレ取得
  const sel = document.getElementById('pasteTemplateSelect');
  const tid = sel ? sel.value : '';
  if (!tid) { alert('テンプレを選択してください'); return; }
  const template = pasteTemplates.find(t => t.id === tid);
  if (!template) { alert('テンプレが見つかりません'); return; }
  // 空の枠を除外
  const targets = pasteBoxes.filter(b => b.text && b.text.trim());
  if (targets.length === 0) {
    alert('ペースト内容が空です。1件以上貼ってください。');
    return;
  }
  // 各枠を解析
  parsedResults = targets.map((b, i) => {
    const r = parseSingleEmail(b.text, template);
    return {
      ...r,
      pbId: b.id,
      index: i + 1,
      include: true   // チェックボックス：登録対象
    };
  });
  // ステップ2へ
  showPasteStep(2);
  renderParseResults();
}

function renderParseResults() {
  const host = document.getElementById('pasteResultList');
  const headline = document.getElementById('pasteStep2Headline');
  const counter = document.getElementById('pasteStep2Counter');
  const finalCount = document.getElementById('pasteFinalCount');
  if (!host) return;

  host.innerHTML = '';
  let okCount = 0, ngCount = 0;
  parsedResults.forEach(r => {
    const fieldCnt = Object.keys(r.fields).length;
    const hasName = !!r.fields.name;
    const hasTel = !!r.fields.tel;
    const hasEmail = !!r.fields.email;
    const requiredOK = hasName && (hasTel || hasEmail);
    if (requiredOK) okCount++; else ngCount++;
    const card = document.createElement('div');
    card.className = 'parse-card' + (requiredOK ? '' : ' has-error');
    card.dataset.idx = parsedResults.indexOf(r);
    card.innerHTML = `
      <div class="parse-card-head">
        <input type="checkbox" ${r.include ? 'checked' : ''} onchange="toggleParseInclude(${parsedResults.indexOf(r)}, this.checked)" style="accent-color:#5aaa8e;width:16px;height:16px;">
        <span class="parse-card-num">#${r.index}</span>
        <span class="parse-card-name">${escapeHtml(r.fields.name || '（氏名なし）')}</span>
        ${r.fields.kana ? `<span class="parse-card-kana">${escapeHtml(r.fields.kana)}</span>` : ''}
        <span class="parse-card-stat">${fieldCnt}項目取得 ${requiredOK ? '✓' : '⚠ 必須不足'}</span>
      </div>
      ${renderParseFields(parsedResults.indexOf(r), r)}
      <div class="parse-card-actions">
        <button class="parse-card-btn" onclick="toggleParseExpand(${parsedResults.indexOf(r)})">${r._expanded ? '▲ 閉じる' : '▼ 編集する'}</button>
        <button class="parse-card-btn danger" onclick="excludeParseResult(${parsedResults.indexOf(r)})">✕ 除外</button>
      </div>
    `;
    host.appendChild(card);
  });

  if (ngCount > 0) {
    headline.innerHTML = `解析完了！${okCount}件OK、${ngCount}件は必須項目（氏名＋電話/メール）が不足`;
  } else {
    headline.textContent = `解析完了！${okCount}件すべて読み取れました🎉`;
  }
  counter.innerHTML = `<span style="color:#0F6E56;font-weight:600;">${okCount}</span> / ${parsedResults.length} 件 OK`;
  updateFinalCount();
}

function renderParseFields(idx, r) {
  const f = r.fields;
  const expanded = !!r._expanded;
  if (!expanded) {
    // サマリー表示（編集なし）
    const items = [];
    const summaryFields = ['tel','email','address','birthdate','job_name','job_no','media','status','dept'];
    summaryFields.forEach(k => {
      if (f[k] !== undefined && f[k] !== null && f[k] !== '') {
        items.push(`<div class="parse-field"><span class="parse-field-label">${labelOf(k)}：</span><span class="parse-field-value">${escapeHtml(String(f[k]))}</span></div>`);
      }
    });
    return `<div class="parse-fields">${items.join('')}</div>`;
  }
  // 展開：全フィールド編集可
  const rows = TARGET_FIELDS.map(tf => {
    const val = f[tf.key] !== undefined ? f[tf.key] : '';
    return `
      <div class="parse-field">
        <span class="parse-field-label">${tf.label}</span>
        <input class="parse-field-input" data-idx="${idx}" data-key="${tf.key}" value="${escapeHtml(String(val || ''))}" oninput="updateParseField(${idx}, '${tf.key}', this.value)">
      </div>
    `;
  }).join('');
  return `<div class="parse-fields">${rows}</div>`;
}

function labelOf(key) {
  const map = {
    name: '氏名', kana: 'ふりがな', tel: '電話', email: 'メール',
    address: '住所', birthdate: '生年月日', job_name: '求人名',
    job_no: '求人番号', job_type: '職種', gender: '性別',
    media: '媒体', status: 'ステータス', dept: '部署',
    agency: '紹介会社', memo: 'メモ', app_date: '応募日', location: '勤務地'
  };
  return map[key] || key;
}

function toggleParseInclude(idx, checked) {
  if (parsedResults[idx]) {
    parsedResults[idx].include = checked;
    updateFinalCount();
  }
}

function toggleParseExpand(idx) {
  if (parsedResults[idx]) {
    parsedResults[idx]._expanded = !parsedResults[idx]._expanded;
    renderParseResults();
  }
}

function excludeParseResult(idx) {
  if (!confirm('この応募者を登録対象から除外しますか？')) return;
  parsedResults.splice(idx, 1);
  // 番号ふり直し
  parsedResults.forEach((r, i) => r.index = i + 1);
  renderParseResults();
}

function updateParseField(idx, key, val) {
  if (!parsedResults[idx]) return;
  parsedResults[idx].fields[key] = val;
  // 生年月日の編集時は年齢を再計算
  if (key === 'birthdate') {
    const p = parseBirthdate(val);
    if (p) {
      parsedResults[idx].fields.birth_year = p.year;
      parsedResults[idx].fields.birth_month = p.month;
      parsedResults[idx].fields.birth_day = p.day;
      parsedResults[idx].fields.age = p.age;
    }
  }
}

function updateFinalCount() {
  const finalCount = document.getElementById('pasteFinalCount');
  const btn = document.getElementById('pasteSaveBtn');
  if (!finalCount) return;
  const includes = parsedResults.filter(r => r.include);
  finalCount.innerHTML = `<span style="color:#0F6E56;font-weight:600;">${includes.length}名</span>を応募者として登録します`;
  if (btn) {
    btn.disabled = includes.length === 0;
    btn.style.opacity = includes.length === 0 ? '0.5' : '1';
  }
}

// ============================================================
// 一括登録
// ============================================================
async function saveAllParsedApplicants() {
  const includes = parsedResults.filter(r => r.include);
  if (includes.length === 0) { alert('登録対象がありません'); return; }
  // バリデーション
  const errs = [];
  includes.forEach((r, i) => {
    if (!r.fields.name) errs.push(`#${r.index}: 氏名が未入力`);
    if (!r.fields.tel && !r.fields.email) errs.push(`#${r.index}: 電話番号またはメールが必要`);
  });
  if (errs.length) {
    alert('登録できません：\n' + errs.slice(0, 5).join('\n') + (errs.length > 5 ? `\n他${errs.length - 5}件` : ''));
    return;
  }
  if (!confirm(`${includes.length}名を応募者として登録します。よろしいですか？`)) return;

  // クライアントID判定
  let cid;
  if (typeof isAdmin !== 'undefined' && isAdmin) {
    alert('管理者は応募者を新規登録できません。\nクライアントアカウントでログインしてください。');
    return;
  } else {
    cid = currentClientId;
  }
  if (!cid) { alert('クライアントが特定できません。再ログインしてください。'); return; }

  // 各応募者をrow化
  const today = formatDateYMD(new Date());
  const rows = includes.map(r => {
    const f = r.fields;
    return {
      client_id: cid,
      app_date: f.app_date || today,
      job_type: f.job_type || '',
      job_no: f.job_no || '',
      job_name: f.job_name || '',
      location: f.location || '',
      name: f.name || '',
      kana: f.kana || '',
      email: f.email || '',
      tel: f.tel || '',
      gender: f.gender || '',
      age: f.age || null,
      media: f.media || '',
      agency: f.agency || '',
      status: f.status || '',
      contact_date: null,
      resign_date: null,
      memo: f.memo || '',
      birth_year: f.birth_year || null,
      birth_month: f.birth_month || null,
      birth_day: f.birth_day || null,
      birthdate: f.birthdate || null,
      docs: [],
      dept: f.dept || '',
      hire_status: '',
      address: f.address || ''
    };
  });

  const btn = document.getElementById('pasteSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = '登録中...'; }

  try {
    const { data: insData, error } = await sb.from('applicants').insert(rows).select('id, name');
    if (error) {
      alert('登録に失敗しました: ' + error.message);
      if (btn) { btn.disabled = false; btn.textContent = '✓ まとめて登録'; }
      return;
    }
    // イベントログ記録（個別）
    if (typeof recordEvent === 'function' && Array.isArray(insData)) {
      for (let i = 0; i < insData.length; i++) {
        const r = insData[i];
        const row = rows[i];
        try {
          await recordEvent(r.id, 'applicant_created', '応募受付', `${row.name || ''}さんの応募を受け付けました（AIペースト一括登録）`, null);
          if (row.status) {
            await recordEvent(r.id, 'status_change', `ステータス：${row.status}`, null, { old: '', new: row.status });
          }
        } catch (e) { /* イベント記録失敗は無視 */ }
      }
    }
    alert(`✓ ${rows.length}名の応募者を登録しました🎉`);
    // 一覧に戻す
    if (typeof loadApplicants === 'function') await loadApplicants();
    if (typeof showSec === 'function') showSec('list');
    if (typeof renderList === 'function') renderList();
  } catch (e) {
    alert('登録時にエラーが発生しました: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '✓ まとめて登録'; }
  }
}

// ============================================================
// テンプレ編集モーダル
// ============================================================
function openTemplateEditor() {
  const modal = document.getElementById('templateEditorModal');
  if (!modal) return;
  modal.style.display = 'flex';
  populateTemplateEditorSelect();
  // 現在選択中のテンプレを開く（なければ新規）
  const currentSel = document.getElementById('pasteTemplateSelect');
  const tid = currentSel ? currentSel.value : '';
  const sel = document.getElementById('teTemplateSelect');
  if (sel) {
    sel.value = tid && pasteTemplates.find(t => t.id === tid) ? tid : '__new__';
  }
  onTemplateSelect();
}

function closeTemplateEditor() {
  const modal = document.getElementById('templateEditorModal');
  if (modal) modal.style.display = 'none';
}

function populateTemplateEditorSelect() {
  const sel = document.getElementById('teTemplateSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="__new__">＋ 新規作成…</option>';
  pasteTemplates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name + (t.is_default ? '（デフォルト）' : '');
    sel.appendChild(opt);
  });
}

function onTemplateSelect() {
  const sel = document.getElementById('teTemplateSelect');
  if (!sel) return;
  const tid = sel.value;
  if (tid === '__new__') {
    editingTemplateId = null;
    currentTemplate = {
      name: '',
      sample_text: '',
      mappings: [],
      is_default: false
    };
  } else {
    const t = pasteTemplates.find(x => x.id === tid);
    if (!t) return;
    editingTemplateId = t.id;
    currentTemplate = JSON.parse(JSON.stringify(t)); // ディープコピー
  }
  document.getElementById('teTemplateName').value = currentTemplate.name || '';
  document.getElementById('teSampleText').value = currentTemplate.sample_text || '';
  renderMappingList();
  // プレビューエリアは閉じる
  const pa = document.getElementById('tePreviewArea');
  if (pa) pa.style.display = 'none';
}

function renderMappingList() {
  const host = document.getElementById('teMappingList');
  const cnt = document.getElementById('teMappingCount');
  if (!host) return;
  host.innerHTML = '';
  const mappings = currentTemplate.mappings || [];
  mappings.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'te-mapping-row kind-' + m.kind;
    row.innerHTML = `
      <span class="te-kind-badge ${m.kind}">${MAPPING_KINDS[m.kind]?.label || m.kind}</span>
      ${renderMappingConfig(idx, m)}
      <span class="te-arrow">→</span>
      <select class="te-target-select" onchange="updateMapping(${idx}, 'target', this.value)">
        ${TARGET_FIELDS.map(tf => `<option value="${tf.key}" ${m.target === tf.key ? 'selected' : ''}>${tf.label}</option>`).join('')}
      </select>
      <button class="te-row-del" onclick="removeMapping(${idx})">✕</button>
    `;
    host.appendChild(row);
  });
  if (cnt) cnt.textContent = `${mappings.length} 個`;
}

function renderMappingConfig(idx, m) {
  if (m.kind === 'extract') {
    return `<input class="te-config-input" placeholder="ラベル（例：お名前）" value="${escapeHtml(m.config?.label || '')}" oninput="updateMappingConfig(${idx}, 'label', this.value)">`;
  }
  if (m.kind === 'split') {
    return `<div style="display:flex;gap:3px;">
      <input class="te-config-input" style="flex:2;" placeholder="ラベル" value="${escapeHtml(m.config?.label || '')}" oninput="updateMappingConfig(${idx}, 'label', this.value)">
      <input class="te-config-input" style="width:30px;" placeholder="/" value="${escapeHtml(m.config?.sep || '/')}" oninput="updateMappingConfig(${idx}, 'sep', this.value)">
      <select class="te-target-select" style="width:60px;" onchange="updateMappingConfig(${idx}, 'side', this.value)">
        <option value="before" ${m.config?.side === 'before' ? 'selected' : ''}>前</option>
        <option value="after" ${m.config?.side === 'after' ? 'selected' : ''}>後</option>
      </select>
    </div>`;
  }
  if (m.kind === 'fixed') {
    // 媒体・ステータスは select、それ以外は text
    if (m.target === 'media' && typeof masters !== 'undefined' && masters?.media?.length) {
      return `<select class="te-target-select" onchange="updateMappingConfig(${idx}, 'value', this.value)">
        <option value="">— 媒体マスタから選択 —</option>
        ${masters.media.map(v => `<option value="${escapeHtml(v)}" ${m.config?.value === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
      </select>`;
    }
    if (m.target === 'status' && typeof masters !== 'undefined' && masters?.status?.length) {
      return `<select class="te-target-select" onchange="updateMappingConfig(${idx}, 'value', this.value)">
        <option value="">— ステータスから選択 —</option>
        ${masters.status.map(v => `<option value="${escapeHtml(v)}" ${m.config?.value === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
      </select>`;
    }
    return `<input class="te-config-input" placeholder="固定値" value="${escapeHtml(m.config?.value || '')}" oninput="updateMappingConfig(${idx}, 'value', this.value)">`;
  }
  if (m.kind === 'auto') {
    return `<select class="te-target-select" onchange="updateMappingConfig(${idx}, 'source', this.value)">
      <option value="dept_top" ${m.config?.source === 'dept_top' ? 'selected' : ''}>部署マスタ最上位</option>
      <option value="today" ${m.config?.source === 'today' ? 'selected' : ''}>今日の日付</option>
    </select>`;
  }
  return '';
}

function updateMapping(idx, field, val) {
  if (!currentTemplate.mappings[idx]) return;
  currentTemplate.mappings[idx][field] = val;
  // ターゲット変更時、固定値の選択肢が変わるので再描画
  if (field === 'target') renderMappingList();
}

function updateMappingConfig(idx, key, val) {
  if (!currentTemplate.mappings[idx]) return;
  if (!currentTemplate.mappings[idx].config) currentTemplate.mappings[idx].config = {};
  currentTemplate.mappings[idx].config[key] = val;
}

function addMappingRow() {
  if (!currentTemplate.mappings) currentTemplate.mappings = [];
  // 種別は選択肢付きで提示
  const kind = prompt('マッピング種別を入力:\n  1: extract（取得：ラベル抽出）\n  2: split（分割：「/」前後）\n  3: fixed（固定値）\n  4: auto（自動値）\n\n番号または文字を入力:', '1');
  if (!kind) return;
  const map = { '1': 'extract', '2': 'split', '3': 'fixed', '4': 'auto', 'extract': 'extract', 'split': 'split', 'fixed': 'fixed', 'auto': 'auto' };
  const k = map[kind.trim().toLowerCase()];
  if (!k) { alert('不明な種別です'); return; }
  currentTemplate.mappings.push({
    kind: k,
    config: k === 'split' ? { sep: '/', side: 'before' } : {},
    target: 'name'
  });
  renderMappingList();
}

function removeMapping(idx) {
  if (!confirm('このマッピングを削除しますか？')) return;
  currentTemplate.mappings.splice(idx, 1);
  renderMappingList();
}

function previewTemplate() {
  const sample = document.getElementById('teSampleText').value;
  if (!sample.trim()) { alert('サンプル本文を入れてください'); return; }
  // 一旦保存せずプレビュー
  currentTemplate.sample_text = sample;
  const result = parseSingleEmail(sample, currentTemplate);
  const host = document.getElementById('tePreviewArea');
  const out = document.getElementById('tePreviewResult');
  if (!host || !out) return;
  host.style.display = '';
  if (result.errors.length) {
    out.innerHTML = `<div style="color:#993C1D;font-weight:600;margin-bottom:4px;">⚠ 解析エラー</div>${result.errors.map(e => `<div>${escapeHtml(e)}</div>`).join('')}`;
    return;
  }
  const fields = result.fields;
  const items = TARGET_FIELDS.filter(tf => fields[tf.key] !== undefined && fields[tf.key] !== '').map(tf => {
    return `<div><span style="color:#888;">${labelOf(tf.key)}：</span><span style="font-weight:600;">${escapeHtml(String(fields[tf.key]))}</span></div>`;
  });
  out.innerHTML = items.length ? items.join('') : '<div style="color:#993C1D;">⚠ 何も抽出できませんでした。マッピング設定を確認してください。</div>';
}

async function saveTemplate() {
  currentTemplate.name = document.getElementById('teTemplateName').value.trim();
  currentTemplate.sample_text = document.getElementById('teSampleText').value;
  if (!currentTemplate.name) { alert('テンプレ名を入力してください'); return; }
  if (!currentTemplate.mappings || currentTemplate.mappings.length === 0) {
    if (!confirm('マッピングが0件です。このまま保存しますか？')) return;
  }
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  if (!cid) { alert('クライアントが特定できません'); return; }
  try {
    if (editingTemplateId) {
      const { error } = await sb.from('paste_templates').update({
        name: currentTemplate.name,
        sample_text: currentTemplate.sample_text,
        mappings: currentTemplate.mappings,
        updated_at: new Date().toISOString()
      }).eq('id', editingTemplateId);
      if (error) { alert('保存失敗: ' + error.message); return; }
    } else {
      const ord = pasteTemplates.length;
      const { data, error } = await sb.from('paste_templates').insert({
        client_id: cid,
        name: currentTemplate.name,
        sample_text: currentTemplate.sample_text,
        mappings: currentTemplate.mappings,
        ord: ord,
        is_default: pasteTemplates.length === 0
      }).select().single();
      if (error) { alert('保存失敗: ' + error.message); return; }
      editingTemplateId = data.id;
    }
    alert('✓ テンプレを保存しました');
    await loadPasteTemplates();
    populateTemplateEditorSelect();
    populatePasteTemplateSelect();
    // 編集中のテンプレを保ったまま再選択
    const sel = document.getElementById('teTemplateSelect');
    if (sel && editingTemplateId) sel.value = editingTemplateId;
  } catch (e) {
    alert('保存エラー: ' + e.message);
  }
}

async function deleteTemplate() {
  if (!editingTemplateId) { alert('削除対象のテンプレがありません'); return; }
  if (!confirm('このテンプレを削除します。よろしいですか？')) return;
  try {
    const { error } = await sb.from('paste_templates').delete().eq('id', editingTemplateId);
    if (error) { alert('削除失敗: ' + error.message); return; }
    editingTemplateId = null;
    await loadPasteTemplates();
    populateTemplateEditorSelect();
    populatePasteTemplateSelect();
    // 新規モードに戻す
    const sel = document.getElementById('teTemplateSelect');
    if (sel) sel.value = '__new__';
    onTemplateSelect();
  } catch (e) {
    alert('削除エラー: ' + e.message);
  }
}

async function duplicateTemplate() {
  if (!editingTemplateId && !currentTemplate.name) { alert('複製元のテンプレを選択してください'); return; }
  // 編集中の内容を「コピー」として保存
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  if (!cid) { alert('クライアントが特定できません'); return; }
  try {
    const ord = pasteTemplates.length;
    const { data, error } = await sb.from('paste_templates').insert({
      client_id: cid,
      name: (currentTemplate.name || 'コピー') + ' のコピー',
      sample_text: document.getElementById('teSampleText').value,
      mappings: currentTemplate.mappings || [],
      ord: ord,
      is_default: false
    }).select().single();
    if (error) { alert('複製失敗: ' + error.message); return; }
    alert('✓ テンプレを複製しました');
    await loadPasteTemplates();
    populateTemplateEditorSelect();
    populatePasteTemplateSelect();
    const sel = document.getElementById('teTemplateSelect');
    if (sel) sel.value = data.id;
    editingTemplateId = data.id;
    onTemplateSelect();
  } catch (e) {
    alert('複製エラー: ' + e.message);
  }
}

// ============================================================
// 既存編集モーダルへの住所欄連携
// ============================================================
// app.js の saveApp は直接編集して address を含むようにしたので、ここではeditAppのフックのみ。
(function setupAddressFieldHook() {
  const orig = window.resetForm;
  if (typeof orig === 'function') {
    window.resetForm = function() {
      orig.apply(this, arguments);
      const ad = document.getElementById('fAddr');
      if (ad) ad.value = '';
    };
  }
})();

// 編集モーダルを開いた時に fAddr に値を入れる
(function hookEditAppForAddress() {
  const orig = window.editApp;
  if (typeof orig === 'function') {
    window.editApp = function(id) {
      const ret = orig.apply(this, arguments);
      try {
        const a = (typeof applicants !== 'undefined' && applicants) ? applicants.find(x => x.id === id) : null;
        const ad = document.getElementById('fAddr');
        if (ad) ad.value = (a && a.address) ? a.address : '';
      } catch (e) {}
      return ret;
    };
  }
})();

// ============================================================
// マスター管理「メールテンプレ」タブの描画
// ============================================================
async function renderPasteTemplateMaster() {
  await loadPasteTemplates();
  const host = document.getElementById('ptList');
  const cntEl = document.getElementById('mmCountPasteTemplate');
  if (cntEl) cntEl.textContent = pasteTemplates.length;
  if (!host) return;
  host.innerHTML = '';
  if (pasteTemplates.length === 0) {
    host.innerHTML = '<div style="padding:16px;text-align:center;color:#aaa;font-size:12px;font-style:italic;background:#fafafa;border-radius:7px;">テンプレがまだ登録されていません<br><span style="font-size:10.5px;">下の「＋ 新しいテンプレを追加」から作成できます</span></div>';
    return;
  }
  pasteTemplates.forEach(t => {
    const cnt = (t.mappings || []).length;
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border:0.5px solid #e0e0e0;border-radius:8px;padding:12px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
    card.innerHTML = `
      <span style="font-size:18px;">📨</span>
      <div style="flex:1;min-width:160px;">
        <div style="font-size:13px;font-weight:600;">${escapeHtml(t.name)} ${t.is_default ? '<span style="font-size:9px;background:#534AB7;color:#fff;padding:1px 6px;border-radius:3px;margin-left:4px;font-weight:500;">デフォルト</span>' : ''}</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">${cnt}項目のマッピング設定</div>
      </div>
      <button onclick="openTemplateEditorById('${t.id}')" style="padding:6px 12px;background:#fff;border:0.5px solid #534AB7;border-radius:6px;font-size:11px;cursor:pointer;color:#534AB7;font-family:inherit;font-weight:500;">⚙ 編集</button>
      <button onclick="setDefaultTemplate('${t.id}')" style="padding:6px 12px;background:#fff;border:0.5px solid #e0e0e0;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;${t.is_default ? 'opacity:0.5;cursor:not-allowed;' : ''}">${t.is_default ? '✓ デフォルト中' : 'デフォルトにする'}</button>
      <button onclick="deleteTemplateById('${t.id}')" style="padding:6px 10px;background:#fff;border:0.5px solid #993C1D;border-radius:6px;font-size:11px;cursor:pointer;color:#993C1D;font-family:inherit;">削除</button>
    `;
    host.appendChild(card);
  });
}

function openTemplateEditorForNew() {
  // モーダルを開いて新規モードに
  const modal = document.getElementById('templateEditorModal');
  if (!modal) return;
  modal.style.display = 'flex';
  populateTemplateEditorSelect();
  const sel = document.getElementById('teTemplateSelect');
  if (sel) sel.value = '__new__';
  onTemplateSelect();
}

function openTemplateEditorById(tid) {
  const modal = document.getElementById('templateEditorModal');
  if (!modal) return;
  modal.style.display = 'flex';
  populateTemplateEditorSelect();
  const sel = document.getElementById('teTemplateSelect');
  if (sel) sel.value = tid;
  onTemplateSelect();
}

async function setDefaultTemplate(tid) {
  const t = pasteTemplates.find(x => x.id === tid);
  if (!t) return;
  if (t.is_default) return;
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  try {
    // 全テンプレの is_default を false に
    await sb.from('paste_templates').update({ is_default: false }).eq('client_id', cid);
    // 対象だけ true に
    await sb.from('paste_templates').update({ is_default: true }).eq('id', tid);
    await renderPasteTemplateMaster();
  } catch (e) {
    alert('デフォルト切り替えに失敗: ' + e.message);
  }
}

async function deleteTemplateById(tid) {
  const t = pasteTemplates.find(x => x.id === tid);
  if (!t) return;
  if (!confirm(`テンプレ「${t.name}」を削除します。よろしいですか？`)) return;
  try {
    const { error } = await sb.from('paste_templates').delete().eq('id', tid);
    if (error) { alert('削除失敗: ' + error.message); return; }
    await renderPasteTemplateMaster();
    populatePasteTemplateSelect();
  } catch (e) {
    alert('削除エラー: ' + e.message);
  }
}

// switchMmTab をフックして、メールテンプレタブが選ばれたら描画
(function hookSwitchMmTabForPasteTemplate() {
  const orig = window.switchMmTab;
  if (typeof orig !== 'function') return;
  window.switchMmTab = function(tab) {
    const ret = orig.apply(this, arguments);
    if (tab === 'paste-template') {
      renderPasteTemplateMaster();
    }
    return ret;
  };
})();

// （旧：showSecフックでlist-pageクラス付与していたが、1600px統一に伴い削除）

// 初回描画時に件数バッジも更新（renderManage呼び出しタイミングでloadPasteTemplatesを実行）
(function hookRenderManageForPasteTemplate() {
  const orig = window.renderManage;
  if (typeof orig !== 'function') return;
  window.renderManage = function() {
    const ret = orig.apply(this, arguments);
    // バッジ更新（軽め）
    loadPasteTemplates().then(() => {
      const cntEl = document.getElementById('mmCountPasteTemplate');
      if (cntEl) cntEl.textContent = pasteTemplates.length;
    });
    return ret;
  };
})();

// ============================================================
// グローバル公開
// ============================================================
if (typeof window !== 'undefined') {
  window.goAddChoice = goAddChoice;
  window.goPasteRegister = goPasteRegister;
  window.goManualRegister = goManualRegister;
  window.addPasteBox = addPasteBox;
  window.removePasteBox = removePasteBox;
  window.clearAllPasteBoxes = clearAllPasteBoxes;
  window.onPasteBoxInput = onPasteBoxInput;
  window.onPasteTemplateChange = onPasteTemplateChange;
  window.analyzePastes = analyzePastes;
  window.backToPasteStep1 = backToPasteStep1;
  window.toggleParseInclude = toggleParseInclude;
  window.toggleParseExpand = toggleParseExpand;
  window.excludeParseResult = excludeParseResult;
  window.updateParseField = updateParseField;
  window.saveAllParsedApplicants = saveAllParsedApplicants;
  window.openTemplateEditor = openTemplateEditor;
  window.closeTemplateEditor = closeTemplateEditor;
  window.onTemplateSelect = onTemplateSelect;
  window.updateMapping = updateMapping;
  window.updateMappingConfig = updateMappingConfig;
  window.addMappingRow = addMappingRow;
  window.removeMapping = removeMapping;
  window.previewTemplate = previewTemplate;
  window.saveTemplate = saveTemplate;
  window.deleteTemplate = deleteTemplate;
  window.duplicateTemplate = duplicateTemplate;
  window.renderPasteTemplateMaster = renderPasteTemplateMaster;
  window.openTemplateEditorForNew = openTemplateEditorForNew;
  window.openTemplateEditorById = openTemplateEditorById;
  window.setDefaultTemplate = setDefaultTemplate;
  window.deleteTemplateById = deleteTemplateById;
}

console.log('[paste-feature] 読み込み完了');
