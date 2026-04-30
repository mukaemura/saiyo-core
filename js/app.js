/* ===== 採用コア アプリケーション ===== */
console.log('[app.js] 読み込み開始');

// ===== Supabase設定 =====
const SUPABASE_URL = 'https://jhnxvcqgwpidkfteqkdr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impobnh2Y3Fnd3BpZGtmdGVxa2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjU2ODgsImV4cCI6MjA5Mjk0MTY4OH0.oWHIJOQM-ktOlHayj19OiC2lEqP47keTl4q3CS4zUlY';

// ===== メインアプリケーション =====
// ========================================
// Supabase 初期化
// ========================================
let sb;
try {
  if (typeof supabase === 'undefined') {
    throw new Error('Supabase SDKが読み込まれていません');
  }
  const { createClient } = supabase;
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('[app.js] Supabase初期化成功');
} catch (e) {
  console.error('[app.js] Supabase初期化失敗', e);
  // ログイン画面が表示された後に警告を出す
  window.addEventListener('DOMContentLoaded', function() {
    var err = document.getElementById('loginErr');
    if (err) {
      err.textContent = 'システム初期化エラー: ' + e.message;
      err.style.display = 'block';
    }
  });
}


// ========================================
// コアステータスマスター（固定定義）
// ========================================
const CORE_STATUS = [
  { id: 'applied',     name: '応募',   ord: 1, color: '#378ADD' },
  { id: 'in_progress', name: '対応中', ord: 2, color: '#EF9F27' },
  { id: 'interview',   name: '面接',   ord: 3, color: '#9B59B6' },
  { id: 'hired',       name: '採用',   ord: 4, color: '#27AE60' },
  { id: 'joined',      name: '入社',   ord: 5, color: '#1D9E75' },
  { id: 'resigned',    name: '退職',   ord: 6, color: '#95A5A6' },
  { id: 'other',       name: 'その他', ord: 7, color: '#BDC3C7' },
];

// 新体系ステータス→core_status_idのマッピング（hiredの詳細指示は後で受領、当面は内定承諾=hired）
const STATUS_TO_CORE = {
  // 対応中グループ
  '書類依頼中':  'in_progress',
  '書類到着':    'in_progress',
  '面接調整中':  'in_progress',
  '面接確定':    'in_progress',
  // 面接グループ
  '1次面接':     'interview',
  '2次面接':     'interview',
  '選考通過':    'interview',
  '採用':        'hired',
  '不採用':      'interview',
  '不来場':      'interview',
  // 採用グループ
  '内定':        'hired',
  '内定辞退':    'other',
  '内定承諾':    'hired',
  // その他グループ
  '連絡不通':    'other',
  'キャンセル':  'other',
  // 最終グループ
  '入社':        'joined',
  '退職':        'resigned',
};

// 旧ステータス→新ステータスへの自動マッピング（既存86件のデータ用）
const LEGACY_STATUS_MIGRATE = {
  '未対応':      '書類依頼中',
  '書類選考中':  '書類到着',
  '1次面接調整': '面接調整中',
  '1次面接済':   '1次面接',
  '2次面接調整': '面接調整中',
  '2次面接済':   '2次面接',
  '最終選考':    '選考通過',
  '辞退':        'キャンセル',  // 旧「辞退」→「キャンセル」（その他グループ）
};

// 旧ステータスを新ステータスに変換（読み取り時の変換用）
function migrateLegacyStatus(s) {
  if (!s) return s;
  return LEGACY_STATUS_MIGRATE[s] || s;
}

// 新体系の詳細ステータス（グループ表示用）
const STATUS_GROUPS = [
  { label: '対応中', items: ['書類依頼中','書類到着','面接調整中','面接確定'] },
  { label: '面接',   items: ['1次面接','2次面接','選考通過','採用','不採用','不来場'] },
  { label: '採用',   items: ['内定','内定辞退','内定承諾'] },
  { label: 'その他', items: ['連絡不通','キャンセル'] },
  { label: '最終',   items: ['入社','退職'] },
];

// デフォルト詳細ステータス（新規クライアント用）
const DEFAULT_DETAIL_STATUS = [
  // 対応中
  { name: '書類依頼中',  core_status_id: 'in_progress', ord: 1 },
  { name: '書類到着',    core_status_id: 'in_progress', ord: 2 },
  { name: '面接調整中',  core_status_id: 'in_progress', ord: 3 },
  { name: '面接確定',    core_status_id: 'in_progress', ord: 4 },
  // 面接
  { name: '1次面接',     core_status_id: 'interview',   ord: 5 },
  { name: '2次面接',     core_status_id: 'interview',   ord: 6 },
  { name: '選考通過',    core_status_id: 'interview',   ord: 7 },
  { name: '採用',        core_status_id: 'hired',       ord: 8 },
  { name: '不採用',      core_status_id: 'interview',   ord: 9 },
  { name: '不来場',      core_status_id: 'interview',   ord: 10 },
  // 採用
  { name: '内定',        core_status_id: 'hired',       ord: 11 },
  { name: '内定辞退',    core_status_id: 'other',       ord: 12 },
  { name: '内定承諾',    core_status_id: 'hired',       ord: 13 },
  // その他
  { name: '連絡不通',    core_status_id: 'other',       ord: 14 },
  { name: 'キャンセル',  core_status_id: 'other',       ord: 15 },
  // 最終
  { name: '入社',        core_status_id: 'joined',      ord: 16 },
  { name: '退職',        core_status_id: 'resigned',    ord: 17 },
];

let detailStatuses = []; // 現クライアントの詳細ステータス一覧

// 詳細ステータス→コアステータスを取得
function getCoreStatusId(detailStatusName) {
  const ds = detailStatuses.find(d => d.name === detailStatusName);
  if (ds) return ds.core_status_id;
  return STATUS_TO_CORE[detailStatusName] || 'applied';
}

function getCoreStatusName(coreId) {
  const cs = CORE_STATUS.find(c => c.id === coreId);
  return cs ? cs.name : coreId;
}

function getCoreStatusColor(coreId) {
  const cs = CORE_STATUS.find(c => c.id === coreId);
  return cs ? cs.color : '#999';
}

// 詳細ステータスを読み込む（Supabaseまたはlocalcache）
async function loadDetailStatuses() {
  try {
    let query = sb.from('detail_status_master').select('*').order('ord');
    if (!isAdmin) query = query.eq('client_id', currentClientId);
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      detailStatuses = data;
    } else {
      // テーブル未作成またはデータなし → デフォルトを使用
      detailStatuses = DEFAULT_DETAIL_STATUS.map((d, i) => ({
        ...d, id: 'default_' + i, client_id: currentClientId
      }));
    }
  } catch(e) {
    detailStatuses = DEFAULT_DETAIL_STATUS.map((d, i) => ({
      ...d, id: 'default_' + i, client_id: currentClientId
    }));
  }
}

// 詳細ステータス選択時にコアステータスを自動設定
function onDetailStatusChange(detailStatusName) {
  return getCoreStatusId(detailStatusName);
}


// ========================================
// 累積型ファネル集計
// ========================================
const FUNNEL_ORDER = ['applied','in_progress','interview','hired','joined','resigned'];

// ========================================
// 担当者バッジ：色分けロジック
// ========================================
// 名前ハッシュで5色パレットの中から1つを選ぶ（決定論的）
function getOwnerBadgeClass(name) {
  if (!name) return 'bgr'; // 未設定はグレー
  const trimmed = String(name).trim();
  // 既存値の特別扱い
  if (trimmed === 'LinkCore') return 'bb'; // 青
  if (trimmed === 'クライアント') return 'ba'; // オレンジ
  // それ以外は5色パレットから自動選択（名前のハッシュ値）
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const palette = ['bo1', 'bo2', 'bo3', 'bo4', 'bo5'];
  return palette[Math.abs(hash) % palette.length];
}

// owner名 + 必要ならクライアント名併記でバッジHTMLを返す
function renderOwnerBadge(owner, taskClientId) {
  const safeOwner = String(owner || '未設定');
  const cls = getOwnerBadgeClass(safeOwner);
  let suffix = '';
  // adminログイン時のみクライアント名を併記
  if (isAdmin && taskClientId && taskClientId !== 'admin') {
    const c = (clients || []).find(x => x.client_id === taskClientId);
    const cname = c ? c.name : taskClientId;
    suffix = `<span class="owner-suffix">（${escapeOwnerHtml(cname)}）</span>`;
  }
  return `<span class="badge ${cls}">${escapeOwnerHtml(safeOwner)}</span>${suffix}`;
}

// owner用の軽いescape（escapeHtmlが定義前の場所でも使えるように独立定義）
function escapeOwnerHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 応募者のコアステータスランクを取得
function getCoreRank(a) {
  const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
  const idx = FUNNEL_ORDER.indexOf(cid);
  return idx >= 0 ? idx : 0;
}

// 累積型ファネル集計（そのステップ以上に到達した人数）
function calcFunnelCumulative(data) {
  const ranks = data.map(a => getCoreRank(a));
  const result = {};
  FUNNEL_ORDER.forEach((id, stepIdx) => {
    // そのステップ以上に到達した人数
    result[id] = ranks.filter(r => r >= stepIdx).length;
  });
  // 退職は特別：resignedに到達した人
  result['resigned'] = ranks.filter(r => r >= FUNNEL_ORDER.indexOf('resigned')).length;
  return result;
}

// ファネル通過率（次ステップ到達数 ÷ 前ステップ到達数）
function calcThroughRate(counts, fromId, toId) {
  const from = counts[fromId] || 0;
  const to = counts[toId] || 0;
  return from > 0 ? Math.round(to/from*100) : 0;
}

// ========================================
// ファネル描画ヘルパー（統一ロジック）
// ========================================
// 主要5ステップ（応募/対応中以上/面接以上/採用/入社）+ 参考表示（その他）
const FUNNEL_STEPS = [
  { id: 'applied',     label: '応募' },
  { id: 'in_progress', label: '対応中以上' },
  { id: 'interview',   label: '面接以上' },
  { id: 'hired',       label: '採用' },
  { id: 'joined',      label: '入社' }
];

// HTMLエスケープ
function escFunnel(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 単一データ群からファネルカードのHTMLを生成
// data: 応募者配列, title: カード見出し, opts: { compact:true なら子用の小さめ }
function renderFunnelCard(data, title, opts) {
  opts = opts || {};
  const cum = calcFunnelCumulative(data);
  const total = cum['applied'] || 0;
  const otherCount = data.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return cid === 'other' || cid === 'resigned';
  }).length;

  let stepsHtml = '';
  FUNNEL_STEPS.forEach(s => {
    const cnt = cum[s.id] || 0;
    const pct = total ? Math.round(cnt/total*100) : 0;
    stepsHtml += `<div class="fstep" data-step="${s.id}">
      <div class="fstep-label">${s.label}</div>
      <div class="fstep-bar-wrap"><div class="fstep-bar" style="width:${Math.max(pct,1)}%;"></div></div>
      <div class="fstep-stat"><span class="fstep-num">${cnt}</span><span class="fstep-pct">${pct}%</span></div>
    </div>`;
  });
  // その他（参考）
  let refHtml = '';
  if (otherCount > 0) {
    const otherPct = total ? Math.round(otherCount/total*100) : 0;
    refHtml = `<div class="fstep-divider"></div>
    <div class="fstep" data-step="other" data-ref="true">
      <div class="fstep-label">その他</div>
      <div class="fstep-bar-wrap"><div class="fstep-bar" style="width:${Math.max(otherPct,1)}%;"></div></div>
      <div class="fstep-stat"><span class="fstep-num">${otherCount}</span><span class="fstep-pct">${otherPct}%</span></div>
    </div>`;
  }
  return `<div class="funnel-card">
    <div class="funnel-card-head">
      <span class="funnel-card-title">${escFunnel(title)}</span>
      <span class="funnel-card-total">応募 ${total}件</span>
    </div>
    ${stepsHtml}
    ${refHtml}
  </div>`;
}

// 単一軸ファネル分析（媒体別/職種別 等）のHTMLを生成
// keyFn: 応募者から軸の値を取り出す関数
function renderSingleAxisFunnel(data, keyFn) {
  if (!data.length) return '<div class="empty" style="padding:1rem;text-align:center;color:#aaa;font-size:12px;">データがありません</div>';
  // グループ化
  const groups = {};
  data.forEach(a => {
    const v = keyFn(a) || '（未設定）';
    if (!groups[v]) groups[v] = [];
    groups[v].push(a);
  });
  // 応募数で降順、上位10件
  const sorted = Object.entries(groups)
    .sort((a,b) => b[1].length - a[1].length)
    .slice(0, 10);
  const cards = sorted.map(([k, arr]) => renderFunnelCard(arr, k)).join('');
  // 11件以上ある場合の注記
  const remaining = Object.keys(groups).length - 10;
  const note = remaining > 0
    ? `<div style="text-align:center;padding:8px;font-size:11px;color:#aaa;">他 ${remaining} 件は省略（応募数上位10件のみ表示）</div>`
    : '';
  return `<div class="funnel-grid">${cards}</div>${note}`;
}

// 軸キーから値を取り出す共通関数（年代グループ含む）
function getAxisValue(a, axisKey) {
  if (axisKey === 'ageGroup') {
    const age = parseInt(a.age);
    if (!age) return '（未設定）';
    if (age < 20) return '10代';
    if (age < 30) return '20代';
    if (age < 40) return '30代';
    if (age < 50) return '40代';
    if (age < 60) return '50代';
    if (age < 70) return '60代';
    return '70代以上';
  }
  return a[axisKey] || '（未設定）';
}

// 軸キーの日本語ラベル
function getAxisLabel(axisKey) {
  const m = { media:'媒体', jobType:'職種', dept:'部署', ageGroup:'年代',
              agency:'紹介会社', gender:'性別', status:'ステータス' };
  return m[axisKey] || axisKey;
}

// ========================================
// 比較ビュー（テーブル + ピックアップ詳細）
// ========================================
// セクションごとのビュー状態（'table'=テーブル比較、'card'=カード、'nest'=ネスト）
const sectionViewMode = {};
// セクションごとの選択行
const sectionSelectedRows = {};

// テーブル比較ビュー（単一軸）
function renderCompareTable(data, axisKey, secId) {
  if (!data.length) return '<div class="empty" style="padding:1rem;text-align:center;color:#aaa;font-size:12px;">データがありません</div>';

  // グループ化
  const groups = {};
  data.forEach(a => {
    const v = getAxisValue(a, axisKey);
    if (!groups[v]) groups[v] = [];
    groups[v].push(a);
  });
  // 応募数降順、上位10件
  const sorted = Object.entries(groups)
    .sort((a,b) => b[1].length - a[1].length)
    .slice(0, 10);
  const remaining = Object.keys(groups).length - 10;

  // 全体平均（％）を計算
  const overallCum = calcFunnelCumulative(data);
  const overallTotal = overallCum['applied'] || 0;
  const avgPcts = {};
  FUNNEL_STEPS.forEach(s => {
    avgPcts[s.id] = overallTotal ? (overallCum[s.id] / overallTotal * 100) : 0;
  });
  // その他平均
  const overallOther = data.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return cid === 'other' || cid === 'resigned';
  }).length;
  const avgOther = overallTotal ? (overallOther / overallTotal * 100) : 0;

  // 行を生成
  const selectedSet = sectionSelectedRows[secId] || new Set();
  const rows = sorted.map(([name, arr], idx) => {
    const cum = calcFunnelCumulative(arr);
    const total = cum['applied'] || 0;
    const otherCount = arr.filter(a => {
      const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
      return cid === 'other' || cid === 'resigned';
    }).length;

    const cells = FUNNEL_STEPS.slice(1).map(s => { // 応募(applied)はスキップ、他のステップだけ
      const cnt = cum[s.id] || 0;
      const pct = total ? Math.round(cnt/total*100) : 0;
      const heat = total < 3 ? '' : // データ少ない場合は色付けしない
        (pct > avgPcts[s.id] + 3) ? ' heat-good' :
        (pct < avgPcts[s.id] - 3) ? ' heat-bad' : '';
      return `<td class="cell-step${heat}"><span class="num">${cnt}</span><span class="pct">${pct}%</span></td>`;
    }).join('');

    const otherPct = total ? Math.round(otherCount/total*100) : 0;
    const otherCell = `<td class="cell-step"><span class="num">${otherCount}</span><span class="pct">${otherPct}%</span></td>`;

    const isSel = selectedSet.has(name);
    const safeName = escFunnel(name);
    return `<tr class="${isSel?'selected':''}" data-row-name="${safeName}">
      <td class="cell-checkbox"><input type="checkbox" class="row-check" data-sec="${secId}" data-name="${safeName}" ${isSel?'checked':''} onchange="onCompareRowCheck('${secId}', this)"></td>
      <td class="cell-name"><span class="badge-rank">${idx+1}</span>${safeName}</td>
      <td class="cell-applied">${total}</td>
      ${cells}
      ${otherCell}
    </tr>`;
  }).join('');

  // 全体平均行
  const avgPctStrs = FUNNEL_STEPS.slice(1).map(s => `<td>${Math.round(avgPcts[s.id])}%</td>`).join('');

  const note = remaining > 0
    ? `<div style="text-align:center;padding:8px;font-size:11px;color:#aaa;">他 ${remaining} 件は省略（応募数上位10件のみ表示）</div>`
    : '';

  const selCount = selectedSet.size;
  const selNames = [...selectedSet].slice(0,3).join('、') + (selCount > 3 ? ` 他${selCount-3}件` : '');

  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
    <div style="font-size:11px;color:#666;">応募 100% 基準。<strong style="color:#5aaa8e;">クリックで複数選択 → 下のボタンで詳細比較</strong></div>
    <div class="compare-legend">
      <span class="legend-item"><span class="legend-dot" style="background:#639922;"></span>平均より高い</span>
      <span class="legend-item"><span class="legend-dot" style="background:#D85A30;"></span>平均より低い</span>
    </div>
  </div>
  <div class="compare-table-wrap">
    <table class="compare-table">
      <thead><tr>
        <th></th>
        <th class="col-name">${getAxisLabel(axisKey)}</th>
        <th class="col-step">応募</th>
        <th class="col-step">対応中以上</th>
        <th class="col-step">面接以上</th>
        <th class="col-step">採用</th>
        <th class="col-step">入社</th>
        <th class="col-step">その他</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="2" class="cell-name">全体平均</td>
        <td>${overallTotal}</td>
        ${avgPctStrs}
        <td>${Math.round(avgOther)}%</td>
      </tr></tfoot>
    </table>
  </div>${note}
  <div class="compare-action-bar">
    <div class="compare-action-info" id="compare_info_${secId}">
      ${selCount > 0 ? `<strong>${selCount}件 選択中</strong>　${escFunnel(selNames)}` : '未選択（チェックして比較できます）'}
    </div>
    <button class="compare-action-btn" id="compare_btn_${secId}" onclick="showPickupDetails('${secId}')" ${selCount===0?'disabled':''}>✓ チェックしたものを比較${selCount>0?`（${selCount}件）`:''}</button>
  </div>
  <div id="pickup_${secId}"></div>`;
}

// テーブル比較ビュー（複数軸：2軸・3軸対応）
function renderCompareTableMulti(data, axes, secId) {
  if (!data.length) return '<div class="empty" style="padding:1rem;text-align:center;color:#aaa;font-size:12px;">データがありません</div>';
  if (!axes || axes.length < 2) return '<div class="empty">2軸以上を選択してください</div>';

  // 全組み合わせをキー化してグループ化
  const groups = {};
  data.forEach(a => {
    const key = axes.map(ax => getAxisValue(a, ax)).join('|||');
    if (!groups[key]) groups[key] = { axisVals: axes.map(ax => getAxisValue(a, ax)), data: [] };
    groups[key].data.push(a);
  });
  const sorted = Object.values(groups)
    .sort((a,b) => b.data.length - a.data.length)
    .slice(0, 20);
  const remaining = Object.keys(groups).length - 20;

  // 全体平均
  const overallCum = calcFunnelCumulative(data);
  const overallTotal = overallCum['applied'] || 0;
  const avgPcts = {};
  FUNNEL_STEPS.forEach(s => {
    avgPcts[s.id] = overallTotal ? (overallCum[s.id] / overallTotal * 100) : 0;
  });

  const selectedSet = sectionSelectedRows[secId] || new Set();

  // 親軸が変わるごとに区切り線を入れる
  let prevAx1 = null;
  const rows = sorted.map((g, idx) => {
    const cum = calcFunnelCumulative(g.data);
    const total = cum['applied'] || 0;

    const cells = FUNNEL_STEPS.slice(1).map(s => {
      const cnt = cum[s.id] || 0;
      const pct = total ? Math.round(cnt/total*100) : 0;
      const heat = total < 3 ? '' :
        (pct > avgPcts[s.id] + 3) ? ' heat-good' :
        (pct < avgPcts[s.id] - 3) ? ' heat-bad' : '';
      return `<td class="cell-step${heat}"><span class="num">${cnt}</span><span class="pct">${pct}%</span></td>`;
    }).join('');

    const axCells = g.axisVals.map((v, i) => {
      const styleClass = i === 0 ? '' : 'style="font-weight:500;color:#666;"';
      return `<td class="cell-name" ${styleClass}>${escFunnel(v)}</td>`;
    }).join('');

    const rowKey = g.axisVals.join(' / ');
    const isSel = selectedSet.has(rowKey);
    const isNewParent = prevAx1 !== g.axisVals[0];
    prevAx1 = g.axisVals[0];
    const borderStyle = isNewParent && idx > 0 ? 'border-top:2px solid #e4e8e7;' : '';
    const safeKey = escFunnel(rowKey);

    return `<tr class="${isSel?'selected':''}" style="${borderStyle}" data-row-name="${safeKey}">
      <td class="cell-checkbox"><input type="checkbox" class="row-check" data-sec="${secId}" data-name="${safeKey}" ${isSel?'checked':''} onchange="onCompareRowCheck('${secId}', this)"></td>
      ${axCells}
      <td class="cell-applied">${total}</td>
      ${cells}
    </tr>`;
  }).join('');

  const headerCells = axes.map(ax => `<th class="col-name">${getAxisLabel(ax)}</th>`).join('');
  const avgPctStrs = FUNNEL_STEPS.slice(1).map(s => `<td>${Math.round(avgPcts[s.id])}%</td>`).join('');

  const note = remaining > 0
    ? `<div style="text-align:center;padding:8px;font-size:11px;color:#aaa;">他 ${remaining} 件は省略（応募数上位20件のみ表示）</div>`
    : '';

  const selCount = selectedSet.size;
  const selNames = [...selectedSet].slice(0,2).join('、') + (selCount > 2 ? ` 他${selCount-2}件` : '');

  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
    <div style="font-size:11px;color:#666;">応募 100% 基準。<strong style="color:#5aaa8e;">親軸ごとに区切り線。クリックで複数選択 → 詳細比較</strong></div>
    <div class="compare-legend">
      <span class="legend-item"><span class="legend-dot" style="background:#639922;"></span>平均より高い</span>
      <span class="legend-item"><span class="legend-dot" style="background:#D85A30;"></span>平均より低い</span>
    </div>
  </div>
  <div class="compare-table-wrap">
    <table class="compare-table">
      <thead><tr>
        <th></th>
        ${headerCells}
        <th class="col-step">応募</th>
        <th class="col-step">対応中以上</th>
        <th class="col-step">面接以上</th>
        <th class="col-step">採用</th>
        <th class="col-step">入社</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="${axes.length+1}" class="cell-name">全体平均</td>
        <td>${overallTotal}</td>
        ${avgPctStrs}
      </tr></tfoot>
    </table>
  </div>${note}
  <div class="compare-action-bar">
    <div class="compare-action-info" id="compare_info_${secId}">
      ${selCount > 0 ? `<strong>${selCount}件 選択中</strong>　${escFunnel(selNames)}` : '未選択'}
    </div>
    <button class="compare-action-btn" id="compare_btn_${secId}" onclick="showPickupDetailsMulti('${secId}')" ${selCount===0?'disabled':''}>✓ チェックしたものを比較${selCount>0?`（${selCount}件）`:''}</button>
  </div>
  <div id="pickup_${secId}"></div>`;
}

// チェックボックスの変更を反映
function onCompareRowCheck(secId, checkbox) {
  if (!sectionSelectedRows[secId]) sectionSelectedRows[secId] = new Set();
  const set = sectionSelectedRows[secId];
  const name = checkbox.getAttribute('data-name');
  if (checkbox.checked) set.add(name);
  else set.delete(name);

  // 行のハイライト切替
  const tr = checkbox.closest('tr');
  if (tr) tr.classList.toggle('selected', checkbox.checked);

  // ボタンテキスト・有効状態の更新
  const btn = document.getElementById('compare_btn_' + secId);
  const info = document.getElementById('compare_info_' + secId);
  const cnt = set.size;
  if (btn) {
    btn.disabled = cnt === 0;
    btn.textContent = cnt > 0 ? `✓ チェックしたものを比較（${cnt}件）` : '✓ チェックしたものを比較';
  }
  if (info) {
    if (cnt > 0) {
      const names = [...set].slice(0,3).join('、') + (cnt > 3 ? ` 他${cnt-3}件` : '');
      info.innerHTML = `<strong>${cnt}件 選択中</strong>　${escFunnel(names)}`;
    } else {
      info.textContent = '未選択（チェックして比較できます）';
    }
  }
}

// ピックアップ詳細表示（単一軸）
function showPickupDetails(secId) {
  const set = sectionSelectedRows[secId];
  if (!set || set.size === 0) return;
  const sec = activeSections.find(s => s.id === secId);
  if (!sec) return;
  const data = getAnData();
  const axisKeyMap = {
    media: 'media', job: 'jobType', dept: 'dept', age: 'ageGroup',
    gender: 'gender', agency: 'agency', status: 'status', hire: 'hireStatus'
  };
  const axisKey = axisKeyMap[sec.type];
  if (!axisKey) return;

  const cards = [...set].map(name => {
    const filtered = data.filter(a => getAxisValue(a, axisKey) === name);
    return renderFunnelCard(filtered, name);
  }).join('');

  const target = document.getElementById('pickup_' + secId);
  if (target) {
    target.innerHTML = `<div class="pickup-details">
      <div class="pickup-details-head"><span class="check-icon">✓</span>ピックアップした${set.size}件の詳細ファネル</div>
      <div class="pickup-grid">${cards}</div>
    </div>`;
  }
}

// ピックアップ詳細表示（複数軸）
function showPickupDetailsMulti(secId) {
  const set = sectionSelectedRows[secId];
  if (!set || set.size === 0) return;
  const sec = activeSections.find(s => s.id === secId);
  if (!sec || !sec.opts || !sec.opts.axes) return;
  const data = getAnData();
  const axes = sec.opts.axes;

  const cards = [...set].map(rowKey => {
    const vals = rowKey.split(' / ');
    const filtered = data.filter(a => axes.every((ax, i) => getAxisValue(a, ax) === vals[i]));
    return renderFunnelCard(filtered, rowKey);
  }).join('');

  const target = document.getElementById('pickup_' + secId);
  if (target) {
    target.innerHTML = `<div class="pickup-details">
      <div class="pickup-details-head"><span class="check-icon">✓</span>ピックアップした${set.size}件の詳細ファネル</div>
      <div class="pickup-grid">${cards}</div>
    </div>`;
  }
}

// ビュー切替
function setSectionView(secId, mode) {
  sectionViewMode[secId] = mode;
  // 選択状態をリセット
  if (sectionSelectedRows[secId]) sectionSelectedRows[secId].clear();
  renderCustomSections();
}


// ========================================
// アプリ状態
// ========================================
let currentClientId = null;
let currentClientName = '';
let isAdmin = false;
let applicants = [];
let masters = { media: [], status: [], agency: [], hire: [], dept: [], assignee: [] };
// マルチセレクトフィルターの選択状態（{status:[], media:[], jobType:[], dept:[]}）
let multiFilterState = { status: [], media: [], jobType: [], dept: [] };
let clients = []; // 管理者用
let editId = null;
// anTab is declared below
let anChart = null;
let curId = null;
let tempDocs = [];

// ========================================
// ステータス表示
// ========================================
function setStatus(msg, type='') {
  const el = document.getElementById('statusBar');
  el.textContent = msg;
  el.className = 'status-bar' + (type ? ' ' + type : '');
  if (type === 'ok') setTimeout(() => el.textContent = '', 3000);
}

// ========================================
// ログイン
// ========================================
async function doLogin() {
  console.log('[doLogin] ログインボタンが押されました');

  const idEl = document.getElementById('loginId');
  const pwEl = document.getElementById('loginPw');
  const err = document.getElementById('loginErr');
  const btn = document.getElementById('loginBtn');

  // エラー表示用のヘルパー
  function showErr(msg) {
    if (err) {
      err.textContent = msg;
      err.style.display = 'block';
    } else {
      alert(msg);
    }
  }
  function hideErr() {
    if (err) err.style.display = 'none';
  }
  function setBtnLoading(loading) {
    if (!btn) return;
    if (loading) {
      btn.dataset.origText = btn.textContent;
      btn.textContent = '確認中...';
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.style.cursor = 'wait';
    } else {
      btn.textContent = btn.dataset.origText || 'ログイン';
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  }

  hideErr();

  const id = (idEl?.value || '').trim();
  const pw = pwEl?.value || '';
  console.log('[doLogin] 入力ID:', id, '/ パスワード長:', pw.length);

  // 入力バリデーション
  if (!id) {
    console.log('[doLogin] ID未入力');
    showErr('クライアントIDを入力してください');
    if (idEl) idEl.focus();
    return;
  }
  if (!pw) {
    console.log('[doLogin] パスワード未入力');
    showErr('パスワードを入力してください');
    if (pwEl) pwEl.focus();
    return;
  }

  // Supabase初期化済みか確認
  if (typeof sb === 'undefined' || !sb) {
    console.error('[doLogin] Supabaseクライアントが初期化されていません');
    showErr('ログイン処理でエラーが発生しました。管理者に確認してください');
    return;
  }

  setBtnLoading(true);

  try {
    console.log('[doLogin] ログイン判定開始');

    // 管理者ログイン: system_config から admin_pw を取得
    let adminPw = 'admin2024'; // デフォルト
    try {
      const { data: adminData, error: adminErr } = await sb.from('system_config')
        .select('value').eq('key', 'admin_pw').single();
      if (!adminErr && adminData?.value) {
        adminPw = adminData.value;
      }
    } catch (e) {
      console.warn('[doLogin] system_config取得失敗（デフォルトを使用）', e);
    }

    if (id === 'admin' && pw === adminPw) {
      console.log('[doLogin] 管理者ログイン成功');
      currentClientId = 'admin';
      currentClientName = '管理者（全社）';
      isAdmin = true;
      await startApp();
      return;
    }

    // クライアントログイン
    const { data: clientData, error: clientErr } = await sb.from('clients')
      .select('*').eq('client_id', id).eq('password', pw).maybeSingle();

    if (clientErr) {
      console.error('[doLogin] Supabaseエラー', clientErr);
      showErr('ログイン処理でエラーが発生しました。管理者に確認してください');
      return;
    }

    if (clientData) {
      console.log('[doLogin] クライアントログイン成功:', clientData.name);
      currentClientId = id;
      currentClientName = clientData.name;
      isAdmin = false;
      await startApp();
    } else {
      console.log('[doLogin] ログイン失敗: 該当なし');
      showErr('IDまたはパスワードが正しくありません');
    }
  } catch (e) {
    console.error('[doLogin] 例外発生', e);
    showErr('ログイン処理でエラーが発生しました。管理者に確認してください');
  } finally {
    setBtnLoading(false);
  }
}

async function startApp() {
  console.log('[startApp] 開始 (isAdmin=' + isAdmin + ', client=' + currentClientName + ')');
  try {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('clientBadge').textContent = currentClientName;
    document.getElementById('adminNavBtn').style.display = isAdmin ? 'block' : 'none';
    initFormOptions();
    await loadMasters();
    await loadDetailStatuses(); // 詳細ステータス読み込み
    await loadApplicants();
    await loadMinutesAndTasks();
    await loadBudgetData();
    updateTaskBadge();
    renderDashboard();
    console.log('[startApp] 完了');
  } catch (e) {
    console.error('[startApp] エラー発生', e);
    // ログイン画面に戻してエラー表示
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    const err = document.getElementById('loginErr');
    if (err) {
      err.textContent = 'ログイン後の初期化でエラーが発生しました: ' + (e.message || '不明なエラー');
      err.style.display = 'block';
    }
  }
}

function doLogout() {
  currentClientId = null; isAdmin = false;
  applicants = []; masters = { media: [], status: [], agency: [] };
  editId = null; curId = null; tempDocs = [];
  if (typeof anChart !== 'undefined' && anChart) { anChart.destroy(); anChart = null; }
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginId').value = '';
  document.getElementById('loginPw').value = '';
}

// ========================================
// データ読み込み
// ========================================
async function loadApplicants() {
  setStatus('データを読み込み中...');
  let query = sb.from('applicants').select('*').order('app_date', { ascending: false });
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  const { data, error } = await query;
  if (error) { setStatus('データ読み込みエラー: ' + error.message, 'err'); return; }
  applicants = (data || []).map(r => {
    // 旧ステータスを新体系に変換
    const newStatus = migrateLegacyStatus(r.status);
    return {
      id: r.id,
      appDate: r.app_date, jobType: r.job_type, location: r.location,
      jobNo: r.job_no || '', jobName: r.job_name || '',
      name: r.name, kana: r.kana, email: r.email, tel: r.tel,
      gender: r.gender, age: r.age, media: r.media, agency: r.agency,
      status: newStatus, contactDate: r.contact_date,
      int1Date: r.int1_date, int1Res: r.int1_result,
      int2Date: r.int2_date, int2Res: r.int2_result,
      resignDate: r.resign_date, memo: r.memo,
      birthYear: r.birth_year, birthMonth: r.birth_month, birthDay: r.birth_day,
      birthdate: r.birthdate,
      docs: r.docs || [],
      dept: r.dept || '',
      hireStatus: r.hire_status || '',
      clientId: r.client_id,
      // 新ステータスからcoreStatusIdを再計算（旧データもこれで正しくマッピングされる）
      coreStatusId: STATUS_TO_CORE[newStatus] || r.core_status_id || 'applied',
      detailStatusId: r.detail_status_id || null
    };
  });
  setStatus('');
}

async function loadMasters() {
  const cid = isAdmin ? 'admin' : currentClientId;
  const { data } = await sb.from('masters').select('*').eq('client_id', cid);
  if (data && data.length) {
    masters = { media: [], status: [], agency: [], hire: [], dept: [], assignee: [] };
    data.forEach(r => { if (masters[r.type] !== undefined) masters[r.type].push(r.value); });
    // assigneeが空なら初期値を投入（既存マスターはあるが担当者だけ未登録のケース）
    if (!masters.assignee.length) {
      masters.assignee = ['LinkCore', 'クライアント'];
      const aRows = masters.assignee.map(v => ({ client_id: cid, type: 'assignee', value: v }));
      try { await sb.from('masters').insert(aRows); } catch(e) {}
    }
  } else {
    // デフォルトマスター（新体系ステータス）
    masters = {
      media: ['リクナビNEXT','マイナビ転職','Indeed','LinkedIn','ハローワーク','自社HP','紹介'],
      status: ['書類依頼中','書類到着','面接調整中','面接確定','1次面接','2次面接','選考通過','採用','不採用','不来場','内定','内定辞退','内定承諾','連絡不通','キャンセル','入社','退職'],
      agency: [],
      hire: ['内定','内定承諾','採用','不採用','保留'],
      dept: [],
      assignee: ['LinkCore','クライアント']
    };
    // DBに保存
    const rows = [];
    Object.entries(masters).forEach(([type, vals]) => vals.forEach(v => rows.push({ client_id: cid, type, value: v })));
    rows.forEach(r => { if (!r.client_id) r.client_id = currentClientId; }); // マルチテナント強制付与
    if (rows.length) await sb.from('masters').insert(rows);
  }
  // ステータスは新体系を強制使用（旧体系がDBに残っていても上書き）
  // 注意：採用可否はステータスで判断する仕様に変更したため、hireも継続使用するが見えるところからは隠す
  masters.status = ['書類依頼中','書類到着','面接調整中','面接確定','1次面接','2次面接','選考通過','採用','不採用','不来場','内定','内定辞退','内定承諾','連絡不通','キャンセル','入社','退職'];
  popSelects();
}

// ========================================
// フォーム初期化
// ========================================
function initFormOptions() {
  const bm = document.getElementById('fBM');
  if (bm) {
    bm.innerHTML = '<option value="">--</option>';
    for (let i = 1; i <= 12; i++) bm.innerHTML += `<option>${i}</option>`;
  }
  const bd = document.getElementById('fBD');
  if (bd) {
    bd.innerHTML = '<option value="">--</option>';
    for (let i = 1; i <= 31; i++) bd.innerHTML += `<option>${i}</option>`;
  }
  // 年齢自動計算のセットアップ
  setupAutoAge();
}

// ===== 年齢自動計算（応募日 - 生年月日） =====
window._ageAutoOverride = false;
function setupAutoAge() {
  const yEl = document.getElementById('fBY');
  const mEl = document.getElementById('fBM');
  const dEl = document.getElementById('fBD');
  const adEl = document.getElementById('fAD');
  const ageEl = document.getElementById('fAg');
  const autoMark = document.getElementById('fAgAuto');
  if (!yEl || !mEl || !dEl || !adEl || !ageEl) return;

  // 既にイベント登録済みなら何もしない
  if (yEl.dataset.autoAgeBound) return;
  yEl.dataset.autoAgeBound = '1';

  function calcAge() {
    const y = parseInt(yEl.value);
    const m = parseInt(mEl.value);
    const d = parseInt(dEl.value);
    const ad = adEl.value;
    if (!y || !m || !d || !ad) return null;
    const birth = new Date(y, m - 1, d);
    const apply = new Date(ad);
    if (isNaN(birth.getTime()) || isNaN(apply.getTime())) return null;
    let age = apply.getFullYear() - birth.getFullYear();
    const md = (apply.getMonth() - birth.getMonth());
    if (md < 0 || (md === 0 && apply.getDate() < birth.getDate())) age--;
    if (age < 0 || age > 120) return null;
    return age;
  }
  function update() {
    if (window._ageAutoOverride) return;
    const age = calcAge();
    if (age !== null) {
      ageEl.value = age;
      if (autoMark) autoMark.style.display = 'inline';
    }
  }
  [yEl, mEl, dEl, adEl].forEach(el => {
    el.addEventListener('change', update);
    el.addEventListener('input', update);
  });
  // ユーザーが年齢を直接編集したら以後自動計算しない
  ageEl.addEventListener('input', () => {
    window._ageAutoOverride = true;
    if (autoMark) autoMark.style.display = 'none';
  });
  // 年齢欄を空にすると自動計算復帰
  ageEl.addEventListener('change', () => {
    if (!ageEl.value) {
      window._ageAutoOverride = false;
      update();
    }
  });
}

// セクションナビのクリック処理
function afJump(targetId, link) {
  const t = document.getElementById(targetId);
  if (t) t.scrollIntoView({behavior:'smooth', block:'start'});
  document.querySelectorAll('.addform-nav a').forEach(a => a.classList.remove('active'));
  if (link) link.classList.add('active');
}

function popSelects() {
  const set = (id, key, blank) => {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = `<option value="">${blank}</option>`;
    (masters[key]||[]).forEach(v => el.innerHTML += `<option>${v}</option>`);
  };
  // フォーム用（単一選択）
  set('fMed','media','選択'); set('fAg2','agency','選択'); set('fSt2','status','選択');
  set('fDept2','dept','選択'); set('fHire2','hire','選択');

  // 担当者プルダウン（議事録内タスク・タスク手動追加・タスクフィルター）
  populateOwnerSelects();

  // 一覧フィルター用（マルチセレクトUI）
  buildMultiFilter('fSt_wrap', 'status');
  buildMultiFilter('fMd_wrap', 'media');
  buildMultiFilter('fJb_wrap', 'jobType');
  buildMultiFilter('fDept_wrap', 'dept');
}

// 担当者プルダウン3箇所を動的生成
function populateOwnerSelects() {
  const assignees = masters.assignee || [];
  // 議事録内タスク追加（tOwner）
  const tOwner = document.getElementById('tOwner');
  if (tOwner) {
    const cur = tOwner.value;
    tOwner.innerHTML = assignees.length
      ? assignees.map(v => `<option value="${escapeOwnerHtml(v)}">${escapeOwnerHtml(v)}</option>`).join('')
      : '<option value="">（マスター未登録）</option>';
    if (cur && assignees.includes(cur)) tOwner.value = cur;
  }
  // タスク手動追加（mtOwner）
  const mtOwner = document.getElementById('mtOwner');
  if (mtOwner) {
    const cur = mtOwner.value;
    mtOwner.innerHTML = assignees.length
      ? assignees.map(v => `<option value="${escapeOwnerHtml(v)}">${escapeOwnerHtml(v)}</option>`).join('')
      : '<option value="">（マスター未登録）</option>';
    if (cur && assignees.includes(cur)) mtOwner.value = cur;
  }
  // タスクフィルター（taskFilter）：固定の3つ + 担当者ごと
  const taskFilter = document.getElementById('taskFilter');
  if (taskFilter) {
    const cur = taskFilter.value;
    let html = '<option value="all">全て</option>'
      + '<option value="pending">未完了のみ</option>'
      + '<option value="done">完了のみ</option>';
    if (assignees.length) {
      html += '<optgroup label="担当者で絞り込み">';
      assignees.forEach(v => {
        html += `<option value="owner:${escapeOwnerHtml(v)}">${escapeOwnerHtml(v)}担当</option>`;
      });
      html += '</optgroup>';
    }
    taskFilter.innerHTML = html;
    if (cur) taskFilter.value = cur;
  }
}

// マルチセレクトフィルターUIを構築
function buildMultiFilter(wrapId, key) {
  const wrap = document.getElementById(wrapId); if (!wrap) return;
  const blank = wrap.dataset.blank || '（全て）';
  // オプション一覧を取得
  let items = [];
  let useGroups = false;
  if (key === 'status') {
    // ステータスはグループ分け
    useGroups = true;
  } else if (key === 'media') {
    items = masters.media || [];
  } else if (key === 'dept') {
    items = masters.dept || [];
  } else if (key === 'jobType') {
    items = [...new Set(applicants.map(a => a.jobType).filter(Boolean))];
  }
  const selected = multiFilterState[key] || [];
  // トリガーボタンのラベル
  const cnt = selected.length;
  const triggerLabel = cnt === 0 ? blank : `${blank.replace('（全て）','')} <span class="mf-count">${cnt}</span>`;
  // パネルのHTML
  let panelHtml = `<div class="mf-actions"><a onclick="multiFilterAll('${key}',true)">全選択</a><a onclick="multiFilterAll('${key}',false)">クリア</a></div>`;
  if (useGroups) {
    STATUS_GROUPS.forEach(g => {
      panelHtml += `<div class="mf-group-label">${g.label}</div>`;
      g.items.forEach(v => {
        const chk = selected.includes(v) ? 'checked' : '';
        panelHtml += `<label><input type="checkbox" value="${v}" ${chk} onchange="multiFilterToggle('${key}','${v}',this.checked)">${v}</label>`;
      });
    });
  } else {
    if (!items.length) {
      panelHtml += `<div style="font-size:10px;color:#aaa;padding:8px;">選択肢がありません</div>`;
    } else {
      items.forEach(v => {
        const safe = String(v).replace(/'/g, "\\'");
        const chk = selected.includes(v) ? 'checked' : '';
        panelHtml += `<label><input type="checkbox" value="${safe}" ${chk} onchange="multiFilterToggle('${key}','${safe}',this.checked)">${v}</label>`;
      });
    }
  }
  wrap.innerHTML = `<div class="mf-trigger ${cnt?'active':''}" onclick="multiFilterTogglePanel('${wrapId}',event)">${triggerLabel}</div>
    <div class="mf-panel" id="${wrapId}_panel">${panelHtml}</div>`;
}

function multiFilterTogglePanel(wrapId, ev) {
  if (ev) ev.stopPropagation();
  // 他のパネルを閉じる
  document.querySelectorAll('.mf-panel.open').forEach(p => { if (p.id !== wrapId+'_panel') p.classList.remove('open'); });
  const panel = document.getElementById(wrapId+'_panel');
  if (panel) panel.classList.toggle('open');
}

function multiFilterToggle(key, val, checked) {
  if (!multiFilterState[key]) multiFilterState[key] = [];
  if (checked) {
    if (!multiFilterState[key].includes(val)) multiFilterState[key].push(val);
  } else {
    multiFilterState[key] = multiFilterState[key].filter(v => v !== val);
  }
  // トリガーラベルだけ更新
  updateMultiFilterTrigger(key);
  renderList();
}

function multiFilterAll(key, selectAll) {
  if (selectAll) {
    let items = [];
    if (key === 'status') {
      items = STATUS_GROUPS.flatMap(g => g.items);
    } else if (key === 'media') items = masters.media || [];
    else if (key === 'dept') items = masters.dept || [];
    else if (key === 'jobType') items = [...new Set(applicants.map(a => a.jobType).filter(Boolean))];
    multiFilterState[key] = [...items];
  } else {
    multiFilterState[key] = [];
  }
  // パネルとトリガー両方を再構築
  const wrapId = { status:'fSt_wrap', media:'fMd_wrap', jobType:'fJb_wrap', dept:'fDept_wrap' }[key];
  if (wrapId) {
    const wasOpen = document.getElementById(wrapId+'_panel')?.classList.contains('open');
    buildMultiFilter(wrapId, key);
    if (wasOpen) document.getElementById(wrapId+'_panel')?.classList.add('open');
  }
  renderList();
}

function updateMultiFilterTrigger(key) {
  const wrapId = { status:'fSt_wrap', media:'fMd_wrap', jobType:'fJb_wrap', dept:'fDept_wrap' }[key];
  if (!wrapId) return;
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const trigger = wrap.querySelector('.mf-trigger');
  if (!trigger) return;
  const blank = wrap.dataset.blank || '（全て）';
  const cnt = (multiFilterState[key] || []).length;
  trigger.innerHTML = cnt === 0 ? blank : `${blank.replace('（全て）','')} <span class="mf-count">${cnt}</span>`;
  trigger.classList.toggle('active', cnt > 0);
}

// 画面の他の部分をクリックしたらパネルを閉じる
document.addEventListener('click', function(e) {
  if (!e.target.closest('.multi-filter')) {
    document.querySelectorAll('.mf-panel.open').forEach(p => p.classList.remove('open'));
  }
});

// ========================================
// ナビ
// ========================================
function showSec(s) {
  // 前のセクションのキャラを非表示
  document.querySelectorAll('[id^="char_sec-"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.sec').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(e => e.classList.remove('active'));
  // 新しいセクションのキャラを表示
  const charEl = document.getElementById('char_' + 'sec-' + s);
  if (charEl && s !== 'dashboard') charEl.style.display = 'block';
  document.getElementById('sec-' + s).classList.add('active');
  const navMap = { dashboard: 0, list: 1, add: 2, import: 3, analytics: 4, minutes: 5, tasks: 6, budget: 7, master: 8 };
  if (navMap[s] !== undefined) document.querySelectorAll('.nb')[navMap[s]].classList.add('active');
  if (s === 'dashboard') renderDashboard();
  if (s === 'list') { closeDetail(); renderList(); }
  if (s === 'analytics') { setPeriod('all'); }
  if (s === 'master') renderManage();
  if (s === 'admin') renderAdmin();
  if (s === 'add' && !editId) resetForm();
  if (s === 'import') cancelImport();
  if (s === 'budget') {
    // 初回表示は単月モードをデフォルトに
    const sEl = document.getElementById('budgetSingle');
    if (sEl && !sEl.value) sEl.value = new Date().toISOString().slice(0,7);
    renderBudget();
  }
  if (s === 'minutes') {
    // カレンダーの月を今月に初期化
    const calInput = document.getElementById('calMonth');
    if (calInput && !calInput.value) calInput.value = new Date().toISOString().slice(0,7);
    renderMinutes();
    renderMinutesCalendar();
  }
  if (s === 'tasks') {
    const tcInput = document.getElementById('taskCalMonth');
    if (tcInput && !tcInput.value) tcInput.value = new Date().toISOString().slice(0,7);
    renderTasks();
    renderTaskCalendar();
  }
}

// ========================================
// 書類
// ========================================
function addDoc() {
  const type = document.getElementById('docType').value;
  const name = document.getElementById('docName').value.trim();
  const url = document.getElementById('docUrl').value.trim();
  if (!url) { alert('URLを入力してください'); return; }
  tempDocs.push({ type, name: name || type, url, id: Date.now() + '' });
  document.getElementById('docName').value = '';
  document.getElementById('docUrl').value = '';
  renderDocList();
}
function removeDoc(id) { tempDocs = tempDocs.filter(d => d.id !== id); renderDocList(); }
function renderDocList() {
  const el = document.getElementById('docList');
  el.innerHTML = tempDocs.map(d => `
    <div class="doc-item">
      <span class="badge bb">${d.type}</span>
      <span style="flex:1;font-size:12px;">${d.name}</span>
      <a href="${d.url}" target="_blank" style="font-size:11px;color:#378ADD;">開く</a>
      <button class="btn-del" onclick="removeDoc('${d.id}')">削除</button>
    </div>`).join('');
}

// ========================================
// 一覧
// ========================================
function clearDateFilter() {
  document.getElementById('fDateFrom').value = '';
  document.getElementById('fDateTo').value = '';
  renderList();
}

function toggleSortPanel() {
  const panel = document.getElementById('sortPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function closeSP(e) {
        if (!panel.contains(e.target) && !e.target.closest('[onclick*="toggleSortPanel"]')) {
          panel.style.display = 'none';
          document.removeEventListener('click', closeSP);
        }
      });
    }, 100);
  }
}

function applyMultiSort() {
  const keyDefs = [
    {id:'sck_appDate', key:'appDate', label:'応募日'},
    {id:'sck_name', key:'name', label:'名前'},
    {id:'sck_jobType', key:'jobType', label:'職種'},
    {id:'sck_dept', key:'dept', label:'部署'},
    {id:'sck_media', key:'media', label:'媒体'},
    {id:'sck_status', key:'status', label:'ステータス'},
  ];
  const descEl = document.getElementById('sDirDesc');
  const desc = descEl && descEl.checked;
  const dir = desc ? -1 : 1;
  const checked = keyDefs.filter(d => { const el=document.getElementById(d.id); return el&&el.checked; });
  sortKeys = checked.length > 0 ? checked.map(d=>({key:d.key,dir})) : [{key:'appDate',dir:-1}];
  // ラベル更新
  const lbl = document.getElementById('sortLabel');
  if (lbl) {
    const names = checked.map(d=>d.label);
    lbl.textContent = (names.length>0?names.join('・'):'応募日') + (desc?'↓':'↑');
  }
  renderList();
}

function quickSort(key) {
  // ヘッダークリックで単一キーソート（降順/昇順トグル）
  const existing = sortKeys.find(s=>s.key===key);
  if (existing) { existing.dir = existing.dir * -1; }
  else { sortKeys = [{key, dir:-1}]; }
  // チェックボックスUIを同期
  ['appDate','name','jobType','dept','media','status'].forEach(k=>{
    const el=document.getElementById('sck_'+k); if(el) el.checked=(k===key);
  });
  const descEl=document.getElementById('sDirDesc');
  const ascEl=document.getElementById('sDirAsc');
  if(descEl&&ascEl){ const d=sortKeys[0].dir===-1; descEl.checked=d; ascEl.checked=!d; }
  const lbl=document.getElementById('sortLabel');
  const labels={appDate:'応募日',name:'名前',jobType:'職種',dept:'部署',media:'媒体',status:'ステータス'};
  if(lbl) lbl.textContent=(labels[key]||key)+(sortKeys[0]&&sortKeys[0].dir===-1?'↓':'↑');
  // ヘッダーのスパン更新
  ['appDate','name','jobType','dept'].forEach(k=>{
    const sp=document.getElementById('sort_'+k); if(sp) sp.textContent='';
  });
  const sp=document.getElementById('sort_'+key);
  if(sp) sp.textContent=sortKeys[0]&&sortKeys[0].dir===-1?'↓':'↑';
  renderList();
}

let sortKeys = [{ key: 'appDate', dir: -1 }];
function toggleSort(key) {
  const existing = sortKeys.find(s => s.key === key);
  if (existing) {
    if (existing.dir === -1) existing.dir = 1;
    else sortKeys = sortKeys.filter(s => s.key !== key); // 3回目で解除
  } else {
    sortKeys.push({ key, dir: -1 });
  }
  ['appDate','jobType','dept'].forEach(k => {
    const el = document.getElementById('sort_'+k); if (!el) return;
    const s = sortKeys.find(x => x.key === k);
    const idx = sortKeys.findIndex(x => x.key === k);
    el.textContent = s ? (s.dir === -1 ? '↓' : '↑') + (sortKeys.length > 1 ? (idx+1) : '') : '';
  });
  renderList();
}
function renderList() {
  const q = (document.getElementById('srch').value || '').toLowerCase();
  const fDateFrom = document.getElementById('fDateFrom') ? document.getElementById('fDateFrom').value : '';
  const fDateTo = document.getElementById('fDateTo') ? document.getElementById('fDateTo').value : '';
  // マルチフィルターステートから取得
  const fsVals = multiFilterState.status || [];
  const fmVals = multiFilterState.media || [];
  const fjVals = multiFilterState.jobType || [];
  const fdVals = multiFilterState.dept || [];
  let fil = applicants.filter(a => {
    if (q && !a.name.toLowerCase().includes(q) && !(a.email||'').toLowerCase().includes(q)) return false;
    if (fsVals.length && !fsVals.includes(a.status||'')) return false;
    if (fmVals.length && !fmVals.includes(a.media||'')) return false;
    if (fjVals.length && !fjVals.includes(a.jobType||'')) return false;
    if (fdVals.length && !fdVals.includes(a.dept||'')) return false;
    if (fDateFrom && a.appDate && a.appDate < fDateFrom) return false;
    if (fDateTo && a.appDate && a.appDate > fDateTo) return false;
    return true;
  });
  fil.sort((a,b) => {
    for (const { key, dir } of sortKeys) {
      const av = a[key]||'', bv = b[key]||'';
      if (av > bv) return dir;
      if (av < bv) return -dir;
    }
    return 0;
  });
  document.getElementById('listCnt').textContent = fil.length + '件' + (fil.length !== applicants.length ? ' / 全'+applicants.length+'件' : '');
  const tb = document.getElementById('listBody');
  const em = document.getElementById('emptyList');
  if (!fil.length) { tb.innerHTML = ''; em.style.display = 'block'; return; }
  em.style.display = 'none';
  // 面接日時を MM/DD コンパクト形式に
  const fmtIntDate = (v) => {
    if (!v) return '<span class="list-col-int list-col-empty">-</span>';
    // YYYY-MM-DD or YYYY-MM-DDTHH:MM 両対応
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return `<span class="list-col-int has-value">${v}</span>`;
    return `<span class="list-col-int has-value">${m[2]}/${m[3]}</span>`;
  };
  // 求人名称をHTMLエスケープ（titleとテキスト両方で使うため）
  const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  tb.innerHTML = fil.map(a => {
    const hireColor = {'内定':'bg','内定承諾':'bt','採用':'bg','不採用':'br','保留':'ba'}[a.hireStatus] || 'bgr';
    const coreId = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    const hireOk = ['hired','joined'].includes(coreId);
    const hireNg = coreId === 'other';
    const rowBg = hireOk
      ? 'background:linear-gradient(90deg,#fff0f5,#fff5f8);'
      : hireNg
      ? 'background:linear-gradient(90deg,#eef4ff,#f0f6ff);'
      : '';
    const jobNoCell = a.jobNo
      ? `<span class="list-col-job-no">${esc(a.jobNo)}</span>`
      : `<span class="list-col-empty">-</span>`;
    const jobNameCell = a.jobName
      ? `<span class="list-col-job-name" title="${esc(a.jobName)}">${esc(a.jobName)}</span>`
      : `<span class="list-col-empty">-</span>`;
    return `<tr id="row_${a.id}" style="${rowBg}">
      <td style="width:36px;" onclick="event.stopPropagation()">
        <input type="checkbox" class="rowCheck" value="${a.id}" onchange="onCheckChange()" style="cursor:pointer;width:14px;height:14px;">
      </td>
      <td>${a.appDate||''}</td>
      <td>${jobNoCell}</td>
      <td>${jobNameCell}</td>
      <td style="font-weight:500;">${a.name}</td>
      <td>${a.jobType||''}</td>
      <td onclick="event.stopPropagation()">
        <select onchange="updateDept('${a.id}', this.value)" style="padding:3px 6px;border:1px solid #ddd;border-radius:6px;font-size:11px;font-family:inherit;background:#fafafa;color:#1a1a1a;cursor:pointer;" onclick="event.stopPropagation()">
          <option value="">-</option>
          ${(masters.dept||[]).map(d=>`<option value="${d}" ${a.dept===d?'selected':''}>${d}</option>`).join('')}
        </select>
      </td>
      <td>${a.media?`<span class="badge bb">${a.media}</span>`:''}</td>
      <td onclick="event.stopPropagation()">
        <select onchange="updateStatus('${a.id}', this.value)" style="padding:3px 6px;border:1px solid #ddd;border-radius:6px;font-size:11px;font-family:inherit;background:#fafafa;color:#1a1a1a;cursor:pointer;max-width:130px;" onclick="event.stopPropagation()">
          <option value="">-</option>
          ${(masters.status||[]).map(s=>`<option value="${s}" ${a.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>${fmtIntDate(a.int1Date)}</td>
      <td>${fmtIntDate(a.int2Date)}</td>
      <td><button class="btn-sm" onclick="openDetail('${a.id}')">詳細</button></td>
    </tr>
    <tr id="detail_${a.id}" style="display:none;"><td colspan="12" style="padding:0;"></td></tr>`;
  }).join('');
}

function stColor(s) {
  const m = {
    // 対応中グループ
    '書類依頼中':'bgr', '書類到着':'bgr', '面接調整中':'bgr', '面接確定':'ba',
    // 面接グループ
    '1次面接':'bb', '2次面接':'ba', '選考通過':'bg',
    '採用':'bg', '不採用':'br', '不来場':'br',
    // 採用グループ
    '内定':'bg', '内定承諾':'bg', '内定辞退':'bc',
    // その他グループ
    '連絡不通':'bc', 'キャンセル':'bc',
    // 最終グループ
    '入社':'bt', '退職':'br',
  };
  return m[s] || 'bb';
}

async function updateHireStatus(id, val) {
  let query = sb.from('applicants').update({ hire_status: val }).eq('id', id);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  const { error } = await query;
  if (error) { alert('更新に失敗しました: ' + error.message); return; }
  const a = applicants.find(x => x.id === id);
  if (a) a.hireStatus = val;
  setStatus('採用可否を更新しました', 'ok');
  // 行の背景色だけ更新（並び順を変えない）
  const hireOk = ['内定','内定承諾','採用'].includes(val);
  const hireNg = val === '不採用';
  const rowEl = document.getElementById('row_'+id);
  if (rowEl) {
    rowEl.style.background = hireOk ? 'linear-gradient(90deg,#fff0f5,#fff5f8)' : hireNg ? 'linear-gradient(90deg,#eef4ff,#f0f6ff)' : '';
  }
  if (document.getElementById('sec-dashboard').classList.contains('active')) renderDashboard();
}

async function updateDept(id, val) {
  let query = sb.from('applicants').update({ dept: val }).eq('id', id);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  const { error } = await query;
  if (error) { alert('更新に失敗しました: ' + error.message); return; }
  const a = applicants.find(x => x.id === id);
  if (a) a.dept = val;
  setStatus('部署を更新しました', 'ok');
}

async function updateStatus(id, val) {
  const newCoreId = onDetailStatusChange(val);
  let query = sb.from('applicants').update({ status: val, core_status_id: newCoreId }).eq('id', id);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  const { error } = await query;
  if (error) { alert('更新に失敗しました: ' + error.message); return; }
  const a = applicants.find(x => x.id === id);
  if (a) a.status = val;
  setStatus('ステータスを更新しました', 'ok');
  // 不採用の場合は行色も更新（並び順は変えない）
  const hireNg = val === '不採用' || (a && a.hireStatus === '不採用');
  const rowEl = document.getElementById('row_'+id);
  if (rowEl) {
    const hireOk = a && ['内定','内定承諾','採用'].includes(a.hireStatus);
    rowEl.style.background = hireOk ? 'linear-gradient(90deg,#fff0f5,#fff5f8)' : (val === '不採用' || hireNg) ? 'linear-gradient(90deg,#eef4ff,#f0f6ff)' : '';
  }
  if (document.getElementById('sec-dashboard').classList.contains('active')) renderDashboard();
}

// ========================================
// 詳細パネル
// ========================================
function openDetail(id) {
  // 既に開いている場合は閉じる
  if (curId && curId !== id) {
    const prev = document.getElementById('detail_'+curId);
    if (prev) { prev.style.display='none'; prev.querySelector('td').innerHTML=''; }
  }
  if (curId === id) { closeDetail(); return; }
  curId = id;
  const a = applicants.find(x => x.id === id); if (!a) return;
  const fields = [
    ['応募日',a.appDate],['応募職種',a.jobType],['部署',a.dept],['勤務地',a.location],
    ['メール',a.email],['電話',a.tel],['性別',a.gender],
    ['生年月日',a.birthdate],['年齢',a.age],['ふりがな',a.kana],
    ['媒体',a.media],['人材紹介会社',a.agency],['ステータス',a.status],['採用可否',a.hireStatus],
    ['コンタクト日',a.contactDate],
    ['1次面接日時',a.int1Date],['1次面接結果',a.int1Res],
    ['2次面接日時',a.int2Date],['2次面接結果',a.int2Res],
    ['退職日',a.resignDate],['メモ',a.memo]
  ].filter(r => r[1]);
  const docsHtml = (a.docs||[]).length ? `<div style="grid-column:1/-1;"><div style="font-size:10px;color:#aaa;margin-bottom:4px;">書類</div>${(a.docs||[]).map(d=>`<div class="dp-doc-item"><span class="badge bb">${d.type}</span><span style="flex:1;">${d.name}</span><a href="${d.url}" target="_blank" style="color:#378ADD;font-size:11px;">開く →</a></div>`).join('')}</div>` : '';
  const html = `<div style="background:#fff;border:1px solid #e8e8e6;border-radius:10px;padding:1rem;margin:4px 0 8px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;padding-bottom:.5rem;border-bottom:1px solid #f0f0ee;">
      <strong style="font-size:14px;">${a.name}${a.kana?' ('+a.kana+')':''}</strong>
      <div style="display:flex;gap:6px;">
        <button class="btn-del" onclick="delApp()">削除</button>
        <button class="btn btn-s" style="padding:4px 10px;font-size:11px;" onclick="closeDetail()">閉じる</button>
        <button class="btn btn-p" style="padding:4px 10px;font-size:11px;" onclick="editApp()">編集</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;">
      ${fields.map(r=>`<div><div style="font-size:10px;color:#aaa;">${r[0]}</div><div style="font-size:12px;">${r[1]}</div></div>`).join('')}
      ${docsHtml}
    </div>
  </div>`;
  const detailRow = document.getElementById('detail_'+id);
  if (detailRow) {
    detailRow.querySelector('td').innerHTML = html;
    detailRow.style.display = 'table-row';
    detailRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function closeDetail() {
  if (curId) {
    const prev = document.getElementById('detail_'+curId);
    if (prev) { prev.style.display='none'; prev.querySelector('td').innerHTML=''; }
  }
  curId = null;
}

function editApp() {
  const a = applicants.find(x => x.id === curId); if (!a) return;
  closeDetail(); editId = a.id;
  const map = {fAD:'appDate',fJT:'jobType',fJobNo:'jobNo',fJobName:'jobName',fLoc:'location',fNm:'name',fKn:'kana',fEm:'email',fTel:'tel',fGe:'gender',fAg:'age',fMed:'media',fAg2:'agency',fSt2:'status',fCD:'contactDate',fI1D:'int1Date',fI1R:'int1Res',fI2D:'int2Date',fI2R:'int2Res',fRD:'resignDate',fMemo:'memo',fDept2:'dept',fHire2:'hireStatus'};
  Object.entries(map).forEach(([fid,key])=>{ const el=document.getElementById(fid); if(el&&a[key]!=null)el.value=a[key]; });
  if(a.birthYear) document.getElementById('fBY').value=a.birthYear;
  if(a.birthMonth) document.getElementById('fBM').value=a.birthMonth;
  if(a.birthDay) document.getElementById('fBD').value=a.birthDay;
  tempDocs = [...(a.docs||[])];
  renderDocList();
  showSec('add');
}

async function delApp() {
  if (!confirm('この応募者を削除しますか？')) return;
  let query = sb.from('applicants').delete().eq('id', curId);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  const { error } = await query;
  if (error) { alert('削除に失敗しました: ' + error.message); return; }
  applicants = applicants.filter(x => x.id !== curId);
  closeDetail(); popSelects(); renderList();
  setStatus('削除しました', 'ok');
}

// ========================================
// 登録・更新
// ========================================
function resetForm() {
  editId = null; tempDocs = [];
  ['fAD','fJT','fJobNo','fJobName','fLoc','fNm','fKn','fEm','fTel','fAg','fCD','fI1D','fI2D','fRD','fMemo','fBY'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['fGe','fMed','fAg2','fSt2','fBM','fBD','fI1R','fI2R','fDept2','fHire2'].forEach(id=>{const e=document.getElementById(id);if(e)e.selectedIndex=0;});
  document.getElementById('fAD').value = new Date().toISOString().split('T')[0];
  document.getElementById('docList').innerHTML='';
  document.getElementById('docName').value=''; document.getElementById('docUrl').value='';
  // 自動年齢計算の状態をリセット
  if (typeof window._ageAutoOverride !== 'undefined') window._ageAutoOverride = false;
  const ageAuto = document.getElementById('fAgAuto'); if (ageAuto) ageAuto.style.display = 'none';
}

async function saveApp() {
  const req = {fAD:'応募日',fJT:'応募職種',fNm:'名前',fKn:'ふりがな',fEm:'メールアドレス',fTel:'電話番号',fGe:'性別',fMed:'媒体名',fSt2:'ステータス'};
  for (const [id,lbl] of Object.entries(req)) {
    if (!document.getElementById(id).value) { alert(`「${lbl}」は必須項目です`); document.getElementById(id).focus(); return; }
  }
  const by=document.getElementById('fBY').value, bm=document.getElementById('fBM').value, bd=document.getElementById('fBD').value;
  const cid = isAdmin ? (editId ? applicants.find(x=>x.id===editId)?.clientId || 'admin' : 'admin') : currentClientId;
  const row = {
    client_id: cid,
    app_date: document.getElementById('fAD').value,
    job_type: document.getElementById('fJT').value,
    job_no: document.getElementById('fJobNo') ? document.getElementById('fJobNo').value : '',
    job_name: document.getElementById('fJobName') ? document.getElementById('fJobName').value : '',
    location: document.getElementById('fLoc').value,
    name: document.getElementById('fNm').value,
    kana: document.getElementById('fKn').value,
    email: document.getElementById('fEm').value,
    tel: document.getElementById('fTel').value,
    gender: document.getElementById('fGe').value,
    age: document.getElementById('fAg').value || null,
    media: document.getElementById('fMed').value,
    agency: document.getElementById('fAg2').value,
    status: document.getElementById('fSt2').value,
    contact_date: document.getElementById('fCD').value || null,
    int1_date: document.getElementById('fI1D').value || null,
    int1_result: document.getElementById('fI1R').value,
    int2_date: document.getElementById('fI2D').value || null,
    int2_result: document.getElementById('fI2R').value,
    resign_date: document.getElementById('fRD').value || null,
    memo: document.getElementById('fMemo').value,
    birth_year: by || null, birth_month: bm || null, birth_day: bd || null,
    birthdate: by&&bm&&bd ? `${by}年${bm}月${bd}日` : null,
    docs: tempDocs,
    dept: document.getElementById('fDept2') ? document.getElementById('fDept2').value : '',
    hire_status: document.getElementById('fHire2') ? document.getElementById('fHire2').value : ''
  };
  let error;
  if (editId) {
    let query = sb.from('applicants').update(row).eq('id', editId);
    if (!isAdmin) query = query.eq('client_id', currentClientId);
    ({ error } = await query);
  } else {
    ({ error } = await sb.from('applicants').insert(row));
  }
  if (error) { alert('保存に失敗しました: ' + error.message); return; }
  await loadApplicants();
  popSelects(); resetForm(); editId=null;
  setStatus('保存しました', 'ok');
  showSec('list');
}

// ========================================
// CSV出力
// ========================================

// ========================================
// 一括取り込み（CSV）
// ========================================
function downloadTemplate() {
  // 新規登録フォーム・一覧画面・exportCSVと整合した26カラム
  const headers = [
    '応募日','求人番号','求人名称','応募職種','勤務地','部署',
    '名前','ふりがな','メール','電話','性別','生年','月','日',
    '媒体名','人材紹介会社','ステータス','採用可否','コンタクト日',
    '1次面接日時','1次面接結果','2次面接日時','2次面接結果','退職日',
    '書類URL','メモ'
  ];
  const example = [
    '2026-04-28','JOB-1234','Webエンジニア募集','エンジニア','東京','開発部',
    '山田太郎','やまだたろう','test@example.com','09012345678','男性','1990','4','1',
    'リクナビNEXT','','面接','','2026-04-29',
    '2026-04-30T14:00','合格','','','',
    'https://drive.google.com/xxxx','備考メモ'
  ];
  const csv = '\uFEFF' + headers.join(',') + '\r\n' + example.join(',') + '\r\n';
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '採用コア_取込テンプレート.csv';
  a.click();
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').style.borderColor = '#ddd';
  const file = e.dataTransfer.files[0];
  if (file) handleCSVFile(file);
}

let importData = [];
let importMissingCols = [];
function handleCSVFile(file) {
  if (!file) { return; }
  // 拡張子チェック（大文字も許容）
  const lname = file.name.toLowerCase();
  if (!lname.endsWith('.csv') && !lname.endsWith('.txt')) {
    alert('CSVファイル(.csv)を選択してください');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      // ArrayBufferとして読み込んだ後、文字コードを推定して decode
      const buf = e.target.result;
      let text = decodeCsvBuffer(buf);
      // BOM除去
      if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
      parseImportCSV(text);
    } catch(err) {
      console.error('[CSV読み込みエラー]', err);
      alert('CSVの読み込みに失敗しました: ' + (err.message || err));
    }
  };
  reader.onerror = function() {
    alert('ファイルの読み込みに失敗しました');
  };
  reader.readAsArrayBuffer(file);
}

// 文字コードを推定して decode（UTF-8 / UTF-8 BOM / Shift_JIS いずれにも対応）
function decodeCsvBuffer(buf) {
  const bytes = new Uint8Array(buf);
  // UTF-8 BOM チェック
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }
  // まず UTF-8 でデコードして、不正な文字 (replacement char) が含まれていないか確認
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return utf8;
  } catch(e) {
    // UTF-8 として不正 → Shift_JIS とみなして再デコード
    try {
      return new TextDecoder('shift_jis').decode(bytes);
    } catch(e2) {
      // フォールバック：UTF-8 でゆるくデコード
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}

function parseImportCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    alert('データが見つかりません。1行目にヘッダー、2行目以降にデータを入力してください。');
    return;
  }
  // ヘッダーから先頭BOMも念のため除去
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = splitCSVLine(headerLine).map(h => h.trim().replace(/^"|"$/g,'').replace(/^\uFEFF/, ''));

  // 必須カラムが揃っているかチェック（少なくとも応募日と名前は必要）
  const requiredCols = ['応募日','名前'];
  const missing = requiredCols.filter(c => !headers.includes(c));
  importMissingCols = missing;
  if (missing.length) {
    const errEl = document.getElementById('importErrors');
    if (errEl) {
      errEl.style.display = 'block';
      errEl.innerHTML = '⚠ 必須列が不足しています：<strong>' + missing.join(', ') + '</strong><br>テンプレートCSVをダウンロードして列名を確認してください。';
    }
    document.getElementById('importPreview').style.display = 'block';
    document.getElementById('previewCount').textContent = '取り込めません（列が足りません）';
    document.getElementById('previewHead').innerHTML = '';
    document.getElementById('previewBody').innerHTML = '';
    return;
  }

  importData = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx]||'').trim().replace(/^"|"$/g,''); });
    // 必須項目チェック（空欄OKの項目は通す）
    if (!row['応募日']) { errors.push(`行${i+1}: 応募日が空欄です`); continue; }
    if (!row['名前'])   { errors.push(`行${i+1}: 名前が空欄です`); continue; }
    importData.push(row);
  }
  const errEl = document.getElementById('importErrors');
  if (errors.length) {
    errEl.style.display = 'block';
    errEl.innerHTML = '⚠ 以下の行はスキップされます：<br>' + errors.slice(0, 20).join('<br>') + (errors.length > 20 ? '<br>...他 ' + (errors.length-20) + ' 件' : '');
  } else {
    errEl.style.display = 'none';
  }
  // プレビュー
  const previewCols = ['応募日','求人番号','名前','応募職種','媒体名','ステータス'].filter(c => headers.includes(c));
  document.getElementById('previewCount').textContent = `${importData.length}件のデータを検出` + (errors.length ? `（${errors.length}件はスキップ）` : '');
  document.getElementById('previewHead').innerHTML = '<tr>'+previewCols.map(c=>`<th style="padding:6px 8px;background:#f8f8f7;font-size:11px;font-weight:600;">${c}</th>`).join('')+'</tr>';
  document.getElementById('previewBody').innerHTML = importData.slice(0,10).map(r =>
    '<tr>'+previewCols.map(c=>`<td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #f0f0ee;">${(r[c]||'').replace(/[<>]/g, s=>s==='<'?'&lt;':'&gt;')}</td>`).join('')+'</tr>'
  ).join('') + (importData.length>10?`<tr><td colspan="${previewCols.length}" style="padding:6px 8px;font-size:11px;color:#aaa;">他 ${importData.length-10}件...</td></tr>`:'');
  document.getElementById('importPreview').style.display = 'block';
}

function splitCSVLine(line) {
  const result = []; let cur = ''; let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

function cancelImport() {
  importData = [];
  document.getElementById('importPreview').style.display = 'none';
  document.getElementById('csvFileInput').value = '';
}

async function doImport() {
  if (!importData.length) { alert('取り込むデータがありません'); return; }
  const btn = document.getElementById('importBtn');
  btn.disabled = true; btn.textContent = '登録中...';

  // 応募日時点の年齢を計算（フォームと同じロジック）
  function calcAgeAt(byear, bmonth, bday, appDateStr) {
    if (!byear || !bmonth || !bday || !appDateStr) return null;
    const birth = new Date(byear, bmonth - 1, bday);
    const apply = new Date(appDateStr);
    if (isNaN(birth.getTime()) || isNaN(apply.getTime())) return null;
    let age = apply.getFullYear() - birth.getFullYear();
    const md = apply.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && apply.getDate() < birth.getDate())) age--;
    if (age < 0 || age > 120) return null;
    return age;
  }

  const rows = importData.map(r => {
    // 生年月日：旧テンプレートの「生年月日_年/月/日」、新テンプレートの「生年/月/日」両対応
    const byear = parseInt(r['生年月日_年'] || r['生年']) || null;
    const bmonth = parseInt(r['生年月日_月'] || r['月']) || null;
    const bday = parseInt(r['生年月日_日'] || r['日']) || null;
    const appDate = r['応募日'] || null;
    // 応募日時点の年齢を計算（フォームと同じ振る舞い）
    const age = calcAgeAt(byear, bmonth, bday, appDate);
    // 表示用 birthdate 文字列（フォーム経由と整合）
    const birthdate = (byear && bmonth && bday) ? `${byear}年${bmonth}月${bday}日` : null;
    // 面接日時：新テンプレートの「1次面接日時」、旧テンプレートの「面接日時」両対応
    const int1d = r['1次面接日時'] || r['面接日時'] || null;
    // 書類URL：単一URLが指定されていれば docs 配列に1件として格納
    const docUrl = (r['書類URL'] || '').trim();
    const docs = docUrl ? [{ type: '履歴書', name: '履歴書', url: docUrl, id: Date.now() + '' + Math.floor(Math.random()*1000) }] : [];
    return {
      client_id: currentClientId,
      app_date: appDate,
      job_no: r['求人番号'] || null,
      job_name: r['求人名称'] || null,
      job_type: r['応募職種'] || null,
      location: r['勤務地'] || null,
      name: r['名前'] || '',
      kana: r['ふりがな'] || null,
      email: r['メール'] || null,
      tel: r['電話'] || null,
      media: r['媒体名'] || null,
      agency: r['人材紹介会社'] || null,
      birth_year: byear, birth_month: bmonth, birth_day: bday,
      birthdate,
      age,
      gender: r['性別'] || null,
      status: r['ステータス'] || '書類依頼中',
      hire_status: r['採用可否'] || null,
      dept: r['部署'] || null,
      contact_date: r['コンタクト日'] || null,
      int1_date: int1d, int1_result: r['1次面接結果'] || null,
      int2_date: r['2次面接日時'] || null, int2_result: r['2次面接結果'] || null,
      resign_date: r['退職日'] || null,
      memo: r['メモ'] || null,
      docs
    };
  });
  rows.forEach(r => { r.client_id = currentClientId; }); // マルチテナント強制付与
  // 1件ずつ登録して成功/失敗を集計（バルクで失敗すると全件失敗するため）
  let okCount = 0;
  const failures = [];
  // パフォーマンス確保のため、まずバルク登録を試行
  const { error: bulkErr } = await sb.from('applicants').insert(rows);
  if (!bulkErr) {
    okCount = rows.length;
  } else {
    // バルクが失敗したら1件ずつ
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const { error } = await sb.from('applicants').insert([r]);
      if (error) {
        failures.push(`${i+1}件目 (${r.name||'名前不明'}): ${error.message}`);
      } else {
        okCount++;
      }
    }
  }
  btn.disabled = false; btn.textContent = 'この内容で一括登録する';

  // 結果表示
  const errEl = document.getElementById('importErrors');
  if (failures.length === 0) {
    setStatus(`${okCount}件を登録しました`, 'ok');
    if (errEl) errEl.style.display = 'none';
    cancelImport();
    await loadApplicants();
    popSelects();
    renderList();
    showSec('list');
  } else {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.innerHTML = `✓ 成功: ${okCount}件 / ✗ 失敗: ${failures.length}件<br>` +
        failures.slice(0, 10).join('<br>') +
        (failures.length > 10 ? `<br>...他 ${failures.length-10} 件` : '');
    }
    setStatus(`${okCount}件登録 / ${failures.length}件失敗`, failures.length === rows.length ? 'err' : 'ok');
    if (okCount > 0) {
      await loadApplicants();
      popSelects();
      renderList();
    }
  }
}

function exportCSV() {
  // テンプレートCSVと同じ26カラム構成（往復可能なフォーマット）
  const headers = [
    '応募日','求人番号','求人名称','応募職種','勤務地','部署',
    '名前','ふりがな','メール','電話','性別','生年','月','日',
    '媒体名','人材紹介会社','ステータス','採用可否','コンタクト日',
    '1次面接日時','1次面接結果','2次面接日時','2次面接結果','退職日',
    '書類URL','メモ'
  ];
  const rows = applicants.map(a => {
    // 書類URL：複数あれば「name:url | name:url」で結合
    const docStr = (a.docs||[]).map(d => `${d.name||d.type||''}:${d.url||''}`).join(' | ');
    return [
      a.appDate||'', a.jobNo||'', a.jobName||'', a.jobType||'', a.location||'', a.dept||'',
      a.name||'', a.kana||'', a.email||'', a.tel||'', a.gender||'',
      a.birthYear||'', a.birthMonth||'', a.birthDay||'',
      a.media||'', a.agency||'', a.status||'', a.hireStatus||'', a.contactDate||'',
      a.int1Date||'', a.int1Res||'', a.int2Date||'', a.int2Res||'', a.resignDate||'',
      docStr, a.memo||''
    ].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',');
  });
  const csv = '\uFEFF' + headers.join(',') + '\r\n' + rows.join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `採用コア_${currentClientName}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ========================================
// PDF出力
// ========================================
function exportPDF() {
  const data=getAnData(), total=data.length;
  const hired=data.filter(a=>['内定','内定承諾','採用'].includes(a.hireStatus)).length;
  const rate=total?Math.round(hired/total*100):0;
  const from=document.getElementById('anFrom').value||'全期間';
  const to=document.getElementById('anTo').value||new Date().toISOString().split('T')[0];
  const mc={},jc={},sc={};
  data.forEach(a=>{if(a.media)mc[a.media]=(mc[a.media]||0)+1;if(a.jobType)jc[a.jobType]=(jc[a.jobType]||0)+1;if(a.status)sc[a.status]=(sc[a.status]||0)+1;});
  const mR=Object.entries(mc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${k}</td><td align="right">${v}件</td><td align="right">${total?Math.round(v/total*100):0}%</td></tr>`).join('');
  const jR=Object.entries(jc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${k}</td><td align="right">${v}件</td></tr>`).join('');
  const sR=Object.entries(sc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${k}</td><td align="right">${v}件</td></tr>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>採用コア レポート</title><style>body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#1a1a1a;margin:0;padding:32px;}h1{font-size:20px;font-weight:700;margin-bottom:4px;color:#185FA5;}.sub{font-size:11px;color:#888;margin-bottom:24px;}h2{font-size:13px;font-weight:600;margin:20px 0 8px;padding-bottom:5px;border-bottom:1.5px solid #e0e0e0;}.mg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}.mc{background:#f5f5f5;border-radius:6px;padding:12px;}.ml{font-size:10px;color:#888;margin-bottom:3px;}.mv{font-size:20px;font-weight:700;color:#185FA5;}table{width:100%;border-collapse:collapse;font-size:11px;}th{background:#f5f5f5;text-align:left;padding:7px 9px;font-weight:600;}td{padding:6px 9px;border-bottom:1px solid #f0f0f0;}.footer{margin-top:28px;font-size:10px;color:#aaa;text-align:right;}@media print{body{padding:20px;}}</style></head><body><h1>採用コア｜採用レポート</h1><div class="sub">クライアント：${currentClientName}　期間：${from}〜${to}　出力：${new Date().toLocaleDateString('ja-JP')}</div><h2>サマリー</h2><div class="mg"><div class="mc"><div class="ml">総応募数</div><div class="mv">${total}</div></div><div class="mc"><div class="ml">内定・入社</div><div class="mv">${hired}</div></div><div class="mc"><div class="ml">採用率</div><div class="mv">${rate}%</div></div><div class="mc"><div class="ml">媒体数</div><div class="mv">${Object.keys(mc).length}</div></div></div><h2>月別集計</h2><table><thead><tr><th>月</th><th align="right">応募数</th><th align="right">1次面接</th><th align="right">2次面接</th><th align="right">採用</th><th align="right">不採用</th><th align="right">面接率</th><th align="right">採用率</th></tr></thead><tbody>${monthR||'<tr><td colspan="8" style="color:#aaa">データなし</td></tr>'}</tbody></table><h2>媒体別応募状況</h2><table><thead><tr><th>媒体名</th><th align="right">応募数</th><th align="right">構成比</th></tr></thead><tbody>${mR||'<tr><td colspan="3" style="color:#aaa">データなし</td></tr>'}</tbody></table><h2>職種別応募状況</h2><table><thead><tr><th>職種</th><th align="right">応募数</th></tr></thead><tbody>${jR||'<tr><td colspan="2" style="color:#aaa">データなし</td></tr>'}</tbody></table><h2>ステータス別進捗</h2><table><thead><tr><th>ステータス</th><th align="right">人数</th></tr></thead><tbody>${sR||'<tr><td colspan="2" style="color:#aaa">データなし</td></tr>'}</tbody></table><div class="footer">採用コア · ${new Date().toLocaleString('ja-JP')}</div><script>window.onload=function(){window.print();}<\/script></body></html>`;
  window.open(URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),'_blank');
}

// ========================================
// 分析
// ========================================

// ========================================
// ダッシュボード
// ========================================
// ダッシュボードのタスクサマリー（renderDashboard から呼ばれる）
function renderDashTasks() {
  const el = document.getElementById('dashTaskList');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  // 自分のクライアントの未完了タスクを抽出（管理者は全件）
  const visible = tasks.filter(t => isAdmin || t.clientId === currentClientId || !t.clientId);
  const pending = visible.filter(t => !t.done);

  // 並び順：期限超過→期限近い→残り、期限内では期限が早い順
  pending.sort((a, b) => {
    const aDue = a.due || '9999-12-31';
    const bDue = b.due || '9999-12-31';
    return aDue.localeCompare(bDue);
  });

  // バッジ更新
  const badge = document.getElementById('dashTaskBadge');
  if (badge) {
    if (pending.length > 0) {
      const overdueCnt = pending.filter(t => t.due && t.due < today).length;
      badge.textContent = overdueCnt > 0 ? `${pending.length}件（期限超過 ${overdueCnt}）` : `${pending.length}件`;
      badge.style.display = 'inline-block';
      badge.style.background = overdueCnt > 0 ? '#D85A30' : '#378ADD';
    } else {
      badge.style.display = 'none';
    }
  }

  if (!pending.length) {
    el.innerHTML = '<div style="text-align:center;padding:1rem;color:#aaa;font-size:12px;">未完了タスクはありません 🎉</div>';
    return;
  }

  // 上位5件まで表示
  const top = pending.slice(0, 5);
  el.innerHTML = top.map(t => {
    const isOverdue = t.due && t.due < today;
    const dueText = t.due ? t.due.slice(5).replace('-', '/') : '期限なし';
    const safeContent = String(t.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#fafaf8;border-radius:6px;margin-bottom:4px;font-size:11px;">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
        ${renderOwnerBadge(t.owner, t.clientId)}
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeContent}</span>
      </div>
      <span style="color:${isOverdue ? '#D85A30' : '#888'};font-weight:${isOverdue ? '600' : '400'};flex-shrink:0;margin-left:8px;">${isOverdue ? '⚠ ' : ''}${dueText}</span>
    </div>`;
  }).join('');

  if (pending.length > 5) {
    el.innerHTML += `<div style="text-align:center;padding:6px;font-size:11px;color:#888;">他 ${pending.length - 5} 件</div>`;
  }
}

function renderDashboard() {
  const now = new Date();
  const toStr = d => d.toISOString().split('T')[0];
  const ym = now.toISOString().slice(0,7);
  const monthStart = ym + '-01';
  const days30Ago = new Date(now); days30Ago.setDate(days30Ago.getDate() - 29);
  const h = now.getHours();
  const greet = h < 12 ? 'おはようございます' : h < 18 ? 'こんにちは' : 'お疲れ様です';
  document.getElementById('dashGreet').textContent = greet + '、' + currentClientName + ' さん';
  document.getElementById('dashDate').textContent = now.toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' });

  // 吹き出しを真っ先に更新（後続でエラーが起きても「読み込み中」のまま残らないように）
  try {
    const _total = applicants.length;
    const _cumDash = calcFunnelCumulative(applicants);
    const _inProgress = _cumDash['in_progress'] || 0;
    const _hired = _cumDash['hired'] || 0;
    const _rate = _total ? Math.round(_hired / _total * 100) : 0;
    const _thisMonth = applicants.filter(a => a.appDate && a.appDate >= monthStart).length;
    updateDashBubbleInner(_total, _inProgress, _hired, _rate, _thisMonth);
  } catch(e) {
    console.warn('Bubble pre-update error:', e);
    const b = document.getElementById('dashBubbleText');
    if (b) b.innerHTML = `やっほー！<br>採用コアだよ〜`;
  }

  const total = applicants.length;
  const cumDash = calcFunnelCumulative(applicants);
  const inProgress = cumDash['in_progress'] || 0;
  const hired = cumDash['hired'] || 0;
  const rate = total ? Math.round(hired / total * 100) : 0;
  const thisMonth = applicants.filter(a => a.appDate && a.appDate >= monthStart).length;

  // ===== 本日のKPI =====
  const todayStr = toStr(now); // YYYY-MM-DD
  // 本日の応募数：応募日が今日と一致
  const todayApps = applicants.filter(a => a.appDate === todayStr).length;
  // 本日の面接数：1次/2次の日時が今日と一致（同日に両方なら2件）
  const todayInterviews = applicants.reduce((cnt, a) => {
    // int1Date / int2Date は YYYY-MM-DD or YYYY-MM-DDTHH:MM 形式
    const i1 = a.int1Date ? String(a.int1Date).slice(0,10) : '';
    const i2 = a.int2Date ? String(a.int2Date).slice(0,10) : '';
    if (i1 === todayStr) cnt++;
    if (i2 === todayStr) cnt++;
    return cnt;
  }, 0);

  // 上部 KPI: 本日カード2枚 + 既存5枚
  document.getElementById('dashKpi').innerHTML = `
    <div class="mc mc-today" style="border-left:3px solid #EF9F27;">
      <span class="badge-today">TODAY</span>
      <div class="mc-lbl">本日の応募数</div><div class="mc-val">${todayApps}<span style="font-size:14px;color:#888;font-weight:500;">件</span></div><div class="mc-sub">応募日が今日</div>
    </div>
    <div class="mc mc-today" style="border-left:3px solid #9B59B6;">
      <span class="badge-today">TODAY</span>
      <div class="mc-lbl">本日の面接数</div><div class="mc-val">${todayInterviews}<span style="font-size:14px;color:#888;font-weight:500;">件</span></div><div class="mc-sub">1次/2次の合算</div>
    </div>
    <div class="mc" style="border-left:3px solid #378ADD;">
      <div class="mc-lbl">総応募数</div><div class="mc-val">${total}</div><div class="mc-sub">累計</div>
    </div>
    <div class="mc" style="border-left:3px solid #1D9E75;">
      <div class="mc-lbl">選考中</div><div class="mc-val">${inProgress}</div><div class="mc-sub">累計</div>
    </div>
    <div class="mc" style="border-left:3px solid #639922;">
      <div class="mc-lbl">内定・採用</div><div class="mc-val">${hired}</div><div class="mc-sub">累計</div>
    </div>
    <div class="mc" style="border-left:3px solid #EF9F27;">
      <div class="mc-lbl">採用率</div><div class="mc-val">${rate}%</div><div class="mc-sub">累計</div>
    </div>
    <div class="mc" style="border-left:3px solid #85B7EB;">
      <div class="mc-lbl">今月の応募</div><div class="mc-val">${thisMonth}</div><div class="mc-sub">件</div>
    </div>`;

  // 下部: 当月ベースの集計
  const thisMonthApplicants = applicants.filter(a => a.appDate && a.appDate >= monthStart);
  const cumThis = calcFunnelCumulative(thisMonthApplicants);
  const tmTotal = thisMonthApplicants.length;
  const tmInProgress = cumThis['in_progress'] || 0;
  const tmInterview  = cumThis['interview'] || 0;
  const tmHired      = cumThis['hired'] || 0;
  const tmJoined     = cumThis['joined'] || 0;

  const monthLabel = (now.getMonth() + 1) + '月（当月）';
  const todoItems = [
    { label: monthLabel + 'の応募数',   count: tmTotal,      color: '#378ADD', bg: '#E6F1FB' },
    { label: monthLabel + 'の対応中',   count: tmInProgress, color: '#EF9F27', bg: '#FFF6E5' },
    { label: monthLabel + 'の面接数',   count: tmInterview,  color: '#9B59B6', bg: '#F4ECF7' },
    { label: monthLabel + 'の採用数',   count: tmHired,      color: '#27AE60', bg: '#E8F5E9' },
    { label: monthLabel + 'の入社数',   count: tmJoined,     color: '#1D9E75', bg: '#E0F2EE' },
  ];
  document.getElementById('dashTodo').innerHTML = todoItems.map(t => `
    <div onclick="showSec('list')" style="background:${t.bg};border-radius:10px;padding:1rem 1.125rem;cursor:pointer;transition:opacity .15s;display:flex;align-items:center;justify-content:space-between;" onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
      <div>
        <div style="font-size:11px;color:${t.color};font-weight:500;margin-bottom:4px;">${t.label}</div>
        <div style="font-size:26px;font-weight:700;color:${t.color};">${t.count}<span style="font-size:13px;margin-left:3px;">名</span></div>
      </div>
      <div style="font-size:18px;color:${t.color};opacity:.4;">→</div>
    </div>`).join('');

  // 追加情報
  const insightsEl = document.getElementById('dashInsights');
  if (insightsEl) {
    insightsEl.innerHTML = renderDashInsights(now, monthStart, days30Ago);
    setTimeout(() => renderTrendMini(days30Ago, now), 50);
  }

  // 直近の応募者
  const recent = [...applicants].sort((a,b) => b.appDate > a.appDate ? 1 : -1).slice(0, 10);
  const tb = document.getElementById('dashRecentBody');
  if (!recent.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:#aaa;font-size:12px;">応募者データがありません</td></tr>';
  } else {
    tb.innerHTML = recent.map(a => {
      const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
      const hireOk2 = ['hired','joined'].includes(cid);
      const hireNg2 = cid === 'other';
      const rBg = hireOk2 ? 'background:linear-gradient(90deg,#fff0f5,#fff5f8);' : hireNg2 ? 'background:linear-gradient(90deg,#eef4ff,#f0f6ff);' : '';
      const dc = (a.docs||[]).length;
      return `<tr style="${rBg}">
        <td>${a.appDate||''}</td>
        <td style="font-weight:500;">${a.name}</td>
        <td>${a.jobType||''}</td>
        <td>${a.dept||''}</td>
        <td>${a.media?`<span class="badge bb">${a.media}</span>`:''}</td>
        <td>${a.status?`<span class="badge ${stColor(a.status)}">${a.status}</span>`:''}</td>
        <td>${dc?`<span class="badge bgr">${dc}件</span>`:''}</td>
        <td><button class="btn-sm" onclick="openDetailFromDash('${a.id}')">詳細</button></td>
      </tr>`;
    }).join('');
  }
  renderDashTasks();
  updateTaskBadge();
  updateDashBubble(total, inProgress, hired, rate, thisMonth);
}

// 追加情報
function renderDashInsights(now, monthStart, days30Ago) {
  const tmApps = applicants.filter(a => a.appDate && a.appDate >= monthStart);
  const mediaCount = {};
  tmApps.forEach(a => {
    const m = a.media || '(未設定)';
    mediaCount[m] = (mediaCount[m] || 0) + 1;
  });
  const top3 = Object.entries(mediaCount).sort((a,b) => b[1]-a[1]).slice(0, 3);
  const top3Html = top3.length
    ? top3.map((e, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;${i<top3.length-1?'border-bottom:1px solid #f5f5f3;':''}"><span style="font-size:11px;color:#1a1a1a;">${i+1}. ${e[0]}</span><strong style="color:#378ADD;font-size:12px;">${e[1]}名</strong></div>`).join('')
    : '<div style="color:#aaa;font-size:11px;padding:8px 0;">当月の応募がありません</div>';

  const joinedAps = applicants.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return cid === 'joined' && a.appDate;
  });
  let avgDays = 0;
  if (joinedAps.length) {
    const days = joinedAps.map(a => {
      const endDate = a.int2Date || a.int1Date || a.appDate;
      const d1 = new Date(a.appDate);
      const d2 = new Date(endDate);
      return Math.max(0, Math.round((d2 - d1) / (1000*60*60*24)));
    });
    avgDays = Math.round(days.reduce((s,n)=>s+n,0) / days.length);
  }

  const fourteenAgo = new Date(now); fourteenAgo.setDate(fourteenAgo.getDate() - 14);
  const fourteenAgoStr = fourteenAgo.toISOString().split('T')[0];
  const stagnant = applicants.filter(a => {
    if (!a.appDate || a.appDate >= fourteenAgoStr) return false;
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return ['applied','in_progress','interview'].includes(cid);
  }).length;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:1rem;">
      <div style="background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.04);">
        <div style="font-size:11px;color:#888;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px;">📊 媒体別ランキング <span style="color:#aaa;font-weight:400;font-size:10px;">(当月応募)</span></div>
        ${top3Html}
      </div>
      <div style="background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.04);">
        <div style="font-size:11px;color:#888;font-weight:600;margin-bottom:8px;">⏱️ 平均選考日数</div>
        <div style="font-size:28px;font-weight:700;color:#1D9E75;line-height:1.1;">${avgDays || '-'}<span style="font-size:13px;margin-left:4px;color:#666;">日</span></div>
        <div style="font-size:10px;color:#aaa;margin-top:6px;">入社済み${joinedAps.length}名の平均(応募→面接最終日)</div>
      </div>
      <div style="background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.04);${stagnant>0?'border-left:3px solid #D85A30;':''}">
        <div style="font-size:11px;color:#888;font-weight:600;margin-bottom:8px;">🔔 ステータス滞留</div>
        <div style="font-size:28px;font-weight:700;color:${stagnant>0?'#D85A30':'#aaa'};line-height:1.1;">${stagnant}<span style="font-size:13px;margin-left:4px;color:#666;">名</span></div>
        <div style="font-size:10px;color:#aaa;margin-top:6px;">応募から14日以上、対応中／面接中の応募者</div>
      </div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.04);margin-bottom:1.25rem;">
      <div style="font-size:11px;color:#888;font-weight:600;margin-bottom:8px;">📈 直近30日の応募推移</div>
      <div style="position:relative;height:120px;"><canvas id="dashTrendMini"></canvas></div>
    </div>
  `;
}

let dashTrendChart = null;
function renderTrendMini(fromDate, toDate) {
  const el = document.getElementById('dashTrendMini');
  if (!el) return;
  if (dashTrendChart) { try { dashTrendChart.destroy(); } catch(e) {} dashTrendChart = null; }
  const labels = [];
  const counts = [];
  const dayCounts = {};
  applicants.forEach(a => {
    if (!a.appDate) return;
    if (a.appDate < fromDate.toISOString().split('T')[0]) return;
    dayCounts[a.appDate] = (dayCounts[a.appDate] || 0) + 1;
  });
  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    labels.push((d.getMonth()+1) + '/' + d.getDate());
    counts.push(dayCounts[key] || 0);
  }
  if (typeof Chart === 'undefined') return;
  dashTrendChart = new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '応募数', data: counts,
        borderColor: '#378ADD',
        backgroundColor: 'rgba(55,138,221,0.1)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { font: { size: 9 }, stepSize: 1 } },
        x: { ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } }
      }
    }
  });
}

function updateDashBubble(total, inProgress, hired, rate, thisMonth) {
  // tasksがロード済みなら即座に、未ロードなら遅延実行
  if (typeof tasks !== 'undefined' && Array.isArray(tasks)) {
    updateDashBubbleInner(total, inProgress, hired, rate, thisMonth);
  } else {
    setTimeout(() => updateDashBubbleInner(total, inProgress, hired, rate, thisMonth), 300);
  }
}
function updateDashBubbleInner(total, inProgress, hired, rate, thisMonth) {
  try {
  const bubble = document.getElementById('dashBubbleText');
  const charImg = document.getElementById('dashChar');
  if (!bubble) return;
  const today = new Date().toISOString().split('T')[0];
  // tasksが未定義でもエラーにならないようにフォールバック
  const safeTasks = (typeof tasks !== 'undefined' && Array.isArray(tasks)) ? tasks : [];
  const overdueTasks = safeTasks.filter(t => !t.done && t.due && t.due < today).length;
  const pendingTasks = safeTasks.filter(t => !t.done).length;
  const uncontacted = applicants.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return cid === 'applied' || cid === 'in_progress';
  }).length;
  
  let lines = [];
  let charSrc = 'assets/character.png'; // デフォルト：手振り
  
  if (overdueTasks > 0) {
    lines.push(`あっ、タスクが<br><strong style="color:#D85A30;">${overdueTasks}件</strong>期限切れだよ〜<br>見てあげて！`);
    charSrc = 'assets/character.png'; // 考える顔
  }
  if (uncontacted > 0) {
    lines.push(`<strong style="color:#D85A30;">${uncontacted}名</strong>のことが気になるなぁ。<br>連絡してあげて〜！`);
    charSrc = 'assets/character.png';
  }
  if (pendingTasks > 0 && overdueTasks === 0) {
    lines.push(`タスクが<strong>${pendingTasks}件</strong>残ってるよ〜<br>一緒にがんばろ！`);
  }
  if (thisMonth > 0) {
    lines.push(`今月は<strong>${thisMonth}名</strong>も<br>応募が来たね〜！すごい！`);
  }
  if (lines.length === 0) {
    lines.push(`今日もみんな元気だよ〜！<br>採用率<strong>${rate}%</strong>、<br>総応募<strong>${total}名</strong>！`);
    charSrc = 'assets/character.png'; // 喜ぶ顔
  }
  
  // 複数メッセージはランダムに1つ表示
  bubble.innerHTML = lines[Math.floor(Math.random() * lines.length)];
  if (charImg) charImg.src = charSrc;
  } catch(e) {
    console.warn('Bubble update error:', e);
    // エラー時は「読み込み中」を消して安全な表示に置き換える
    const b = document.getElementById('dashBubbleText');
    if (b) b.innerHTML = `やっほー！<br>採用コアだよ〜`;
  }
} // end updateDashBubbleInner

function filterAndGo(status) {
  showSec('list');
  document.getElementById('fSt').value = status;
  renderList();
}

function openDetailFromDash(id) {
  showSec('list');
  setTimeout(() => openDetail(id), 100);
}

// ========================================
// 分析
// ========================================
function getAnData() {
  const from=document.getElementById('anFrom').value, to=document.getElementById('anTo').value;
  const dept=document.getElementById('anDept')?document.getElementById('anDept').value:'';
  const job=document.getElementById('anJob')?document.getElementById('anJob').value:'';
  return applicants.filter(a=>{
    if(from&&a.appDate<from)return false;
    if(to&&a.appDate>to)return false;
    if(dept&&a.dept!==dept)return false;
    if(job&&a.jobType!==job)return false;
    return true;
  });
}

function setPeriod(p) {
  const now=new Date(); let from='',to=now.toISOString().split('T')[0];
  if(p==='month')from=new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0];
  else if(p==='quarter'){const d=new Date(now);d.setMonth(d.getMonth()-3);from=d.toISOString().split('T')[0];}
  else if(p==='year'){const d=new Date(now);d.setFullYear(d.getFullYear()-1);from=d.toISOString().split('T')[0];}
  document.getElementById('anFrom').value=from;
  document.getElementById('anTo').value=to;
  renderAn();
}

// ========================================
// 月別集計のデータ生成と表示
// ========================================
function buildMonthStats(data) {
  // 月ごとに、各コアステータスへの累積到達数をカウント
  const stats = {};
  data.forEach(a => {
    if (!a.appDate) return;
    const m = a.appDate.substring(0, 7);
    if (!stats[m]) {
      stats[m] = { total: 0, applied: 0, in_progress: 0, interview: 0, hired: 0, joined: 0, resigned: 0, other: 0 };
    }
    stats[m].total++;
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    const rank = FUNNEL_ORDER.indexOf(cid);
    // そのステップ以上に到達した数をカウント(ファネル累積)
    FUNNEL_ORDER.forEach((id, idx) => {
      if (rank >= idx) stats[m][id]++;
    });
    if (cid === 'other') stats[m].other++;
  });
  return stats;
}

function renderMonthTable(stats, title) {
  const months = Object.keys(stats).sort();
  const titleHtml = title ? `<div style="font-size:11px;font-weight:600;color:#666;margin:.75rem 0 .25rem;">${title}</div>` : '';
  if (!months.length) {
    return titleHtml + '<div class="empty" style="padding:1rem;text-align:center;color:#aaa;font-size:12px;">該当する月のデータがありません</div>';
  }
  const thL = 'padding:7px 10px;background:#f0f0ee;font-size:10px;font-weight:700;border-bottom:2px solid #e0e0de;text-align:left;color:#666;';
  const thR = thL.replace('text-align:left', 'text-align:right');
  const tdL = 'padding:6px 10px;font-size:11px;border-bottom:1px solid #f5f5f5;';
  const tdR = tdL + 'text-align:right;';
  const tfL = 'padding:7px 10px;font-size:11px;font-weight:700;background:#f8f8f7;border-top:2px solid #e0e0de;';
  const tfR = tfL + 'text-align:right;';

  // 合計
  const tot = { total:0, in_progress:0, interview:0, hired:0, joined:0 };
  months.forEach(m => {
    const s = stats[m];
    tot.total += s.total;
    tot.in_progress += s.in_progress;
    tot.interview += s.interview;
    tot.hired += s.hired;
    tot.joined += s.joined;
  });

  let rows = '';
  months.forEach(m => {
    const s = stats[m];
    const rate = s.total ? Math.round(s.hired / s.total * 100) : 0;
    rows += `<tr>
      <td style="${tdL}">${m}</td>
      <td style="${tdR}">${s.total}</td>
      <td style="${tdR};color:#EF9F27;">${s.in_progress}</td>
      <td style="${tdR};color:#9B59B6;">${s.interview}</td>
      <td style="${tdR};color:#27AE60;font-weight:600;">${s.hired}</td>
      <td style="${tdR};color:#1D9E75;">${s.joined}</td>
      <td style="${tdR};color:${rate>10?'#3B6D11':'#aaa'};">${rate}%</td>
    </tr>`;
  });
  const totRate = tot.total ? Math.round(tot.hired / tot.total * 100) : 0;

  return titleHtml + `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="${thL}">月</th>
      <th style="${thR}">応募</th>
      <th style="${thR}">対応中以上</th>
      <th style="${thR}">面接以上</th>
      <th style="${thR}">採用</th>
      <th style="${thR}">入社</th>
      <th style="${thR}">採用率</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td style="${tfL}">合計</td>
      <td style="${tfR}">${tot.total}</td>
      <td style="${tfR};color:#EF9F27;">${tot.in_progress}</td>
      <td style="${tfR};color:#9B59B6;">${tot.interview}</td>
      <td style="${tfR};color:#27AE60;">${tot.hired}</td>
      <td style="${tfR};color:#1D9E75;">${tot.joined}</td>
      <td style="${tfR};color:${totRate>10?'#3B6D11':'#aaa'};">${totRate}%</td>
    </tr></tfoot>
  </table></div>`;
}

let anTab='monthly_all';
function setAnTab(t,btn){
  anTab=t;
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // 月別集計（常時表示）を更新
  const fixedEl = document.getElementById('anMonthlyFixed');
  if (fixedEl) {
    const dataB = getCompareData();
    const cmpBar = dataB ? renderCompareBar(data, dataB,
      (document.getElementById('anFrom').value||'A')+'〜'+(document.getElementById('anTo').value||''),
      (document.getElementById('anFrom2').value||'B')+'〜'+(document.getElementById('anTo2').value||'')
    ) : '';
    fixedEl.innerHTML = cmpBar + renderMonthTable(buildMonthStats(data), '');
  }
  // カスタムセクションを再描画
  renderCustomSections();
}
function setTab(t,btn){ setAnTab(t,btn); }

function renderAn() {
  const anDept=document.getElementById('anDept');
  const anJob=document.getElementById('anJob');
  if(anDept){
    const cur=anDept.value;
    anDept.innerHTML='<option value="">部署（全て）</option>';
    [...new Set(applicants.map(a=>a.dept).filter(Boolean))].forEach(v=>anDept.innerHTML+=`<option ${cur===v?'selected':''}>${v}</option>`);
  }
  if(anJob){
    const cur=anJob.value;
    anJob.innerHTML='<option value="">職種（全て）</option>';
    [...new Set(applicants.map(a=>a.jobType).filter(Boolean))].forEach(v=>anJob.innerHTML+=`<option ${cur===v?'selected':''}>${v}</option>`);
  }

  const data = getAnData();
  const total = data.length;

  // ============================================================
  // コアステータスベースのファネル集計
  // ============================================================
  const getCoreId = (a) => {
    // core_status_idが直接あればそれを使用
    if (a.coreStatusId) return a.coreStatusId;
    // なければdetail_statusからマッピング
    const ds = detailStatuses.find(d => d.name === a.status);
    if (ds) return ds.core_status_id;
    return STATUS_TO_CORE[a.status] || 'applied';
  };

  // コアステータス別カウント
  const coreCounts = {};
  CORE_STATUS.forEach(cs => coreCounts[cs.id] = 0);
  data.forEach(a => {
    const cid = getCoreId(a);
    if (coreCounts[cid] !== undefined) coreCounts[cid]++;
    else coreCounts['other'] = (coreCounts['other']||0) + 1;
  });

  // ============================================================
  // 累積型ファネル集計
  // ============================================================
  const cumulative = calcFunnelCumulative(data);
  const funnelStepsIds = ['applied','in_progress','interview','hired','joined'];
  const hireCount = cumulative['hired'] || 0;
  const hireRate = total ? Math.round(hireCount/total*100) : 0;
  const otherCount = data.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return cid === 'other';
  }).length;

  // KPIメトリクス
  const metricsEl = document.getElementById('anMetrics');
  if (metricsEl) {
    const kpis = [
      { label:'総応募数',   val: total+'名',               sub:'期間内', color:'#378ADD' },
      { label:'対応中以上', val: cumulative['in_progress']+'名', sub:`通過率${total?Math.round(cumulative['in_progress']/total*100):0}%`, color:'#EF9F27' },
      { label:'面接以上',   val: cumulative['interview']+'名',   sub:`通過率${total?Math.round(cumulative['interview']/total*100):0}%`, color:'#9B59B6' },
      { label:'採用以上',   val: hireCount+'名',           sub:`採用率${hireRate}%`, color:'#27AE60' },
      { label:'入社',       val: cumulative['joined']+'名',sub:'', color:'#1D9E75' },
      { label:'その他',     val: otherCount+'名',          sub:'不採用・辞退含む', color:'#BDC3C7' },
    ];
    metricsEl.innerHTML = kpis.map(k=>`
      <div style="background:#fff;border:1px solid #e8e8e6;border-radius:10px;padding:.875rem 1rem;flex:1;min-width:100px;border-top:3px solid ${k.color};">
        <div style="font-size:10px;color:#888;margin-bottom:4px;">${k.label}</div>
        <div style="font-size:22px;font-weight:700;color:#1a1a1a;line-height:1.2;">${k.val}</div>
        ${k.sub?`<div style="font-size:10px;color:${k.color};margin-top:4px;">${k.sub}</div>`:''}
      </div>`).join('');
  }

  // ============================================================
  // 累積型ピラミッドファネル
  // ============================================================
  const funnelEl = document.getElementById('anFunnelBar');
  if (funnelEl && total > 0) {
    const steps = funnelStepsIds.map(id => {
      const cs = CORE_STATUS.find(c => c.id === id);
      const cnt = cumulative[id] || 0;
      const pct = Math.round(cnt/total*100);
      return { id, name: cs?.name || id, cnt, pct, color: cs?.color || '#999' };
    });

    funnelEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;padding:.5rem 0;">
        ${steps.map((s, i) => {
          const prevCnt = i > 0 ? (steps[i-1].cnt||1) : total;
          const throughRate = i > 0 ? (prevCnt>0?Math.round(s.cnt/prevCnt*100):0) : 100;
          const barW = Math.max(s.pct, 3);
          return `
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:72px;font-size:11px;font-weight:700;color:#1a1a1a;text-align:right;flex-shrink:0;">${s.name}</div>
              <div style="flex:1;position:relative;height:36px;">
                <div style="position:absolute;top:0;left:0;height:100%;background:${s.color};opacity:.15;border-radius:6px;width:${barW}%;min-width:6px;"></div>
                <div style="position:absolute;top:0;left:0;height:100%;display:flex;align-items:center;padding:0 10px;gap:8px;">
                  <span style="font-size:14px;font-weight:800;color:${s.color};">${s.cnt}<span style="font-size:11px;font-weight:600;">名</span></span>
                  <span style="font-size:10px;color:#aaa;">全体比 ${s.pct}%</span>
                </div>
              </div>
              <div style="font-size:11px;flex-shrink:0;width:64px;text-align:right;color:${throughRate<50&&i>0?'#D85A30':'#6ab49a'};">
                ${i>0?`前比 ${throughRate}%`:'基準'}
              </div>
            </div>
            ${i<steps.length-1?`<div style="text-align:left;padding-left:82px;color:#ddd;font-size:13px;line-height:1;">↓</div>`:''}
          `;
        }).join('')}
        ${cumulative['resigned']>0?`
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #eee;display:flex;align-items:center;gap:10px;">
            <div style="width:72px;font-size:11px;font-weight:700;color:#95A5A6;text-align:right;flex-shrink:0;">退職</div>
            <div style="flex:1;display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f8f8f7;border-radius:6px;">
              <span style="font-size:13px;font-weight:700;color:#95A5A6;">${cumulative['resigned']}名</span>
              <span style="font-size:10px;color:#aaa;">入社後離脱</span>
            </div>
          </div>`:''}
        ${otherCount>0?`
          <div style="margin-top:4px;display:flex;align-items:center;gap:10px;">
            <div style="width:72px;font-size:11px;font-weight:700;color:#BDC3C7;text-align:right;flex-shrink:0;">その他</div>
            <div style="flex:1;display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f8f8f7;border-radius:6px;">
              <span style="font-size:13px;font-weight:700;color:#BDC3C7;">${otherCount}名</span>
              <span style="font-size:10px;color:#aaa;">不採用・辞退・連絡不通など</span>
            </div>
          </div>`:''}
      </div>`;
  }

  // 月別集計（全体）
  const monthlyEl = document.getElementById('anMonthlyFixed');
  if (monthlyEl) monthlyEl.innerHTML = renderMonthTable(buildMonthStats(data), '');

  renderAnContent(data);
}


function renderAnContent(){
  // 旧タブ方式の後方互換（今は使わない）
}

// セクション管理
let activeSections = []; // 追加済みセクションのリスト
const sectionCharts = {}; // セクションごとのChartインスタンス管理
// CHART_COLORS defined below

function addSection(type, opts) {
  try {
    const id = 'sec_' + type + '_' + Date.now() + '_' + Math.floor(Math.random()*10000);
    activeSections.push({ id, type, opts: opts || {} });
    console.log('[addSection]', type, 'activeSections count:', activeSections.length);
    renderCustomSections();
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'box-shadow .3s, transform .3s';
        el.style.boxShadow = '0 0 0 3px #378ADD55, 0 4px 16px rgba(55,138,221,.15)';
        el.style.transform = 'scale(1.005)';
        setTimeout(() => {
          el.style.boxShadow = '0 1px 4px rgba(0,0,0,.04)';
          el.style.transform = 'scale(1)';
        }, 800);
      }
    }, 150);
    setStatus('セクションを追加しました（合計' + activeSections.length + '件）', 'ok');
  } catch(e) {
    console.error('[addSection ERROR]', e);
    setStatus('セクション追加エラー: ' + e.message, 'err');
  }
}

function removeSection(id) {
  if (sectionCharts[id]) { sectionCharts[id].forEach(c => c.destroy()); delete sectionCharts[id]; }
  activeSections = activeSections.filter(s => s.id !== id);
  delete sectionViewMode[id];
  delete sectionSelectedRows[id];
  renderCustomSections();
}


// ========================================
// グラフ・ビジュアライゼーション
// ========================================
const CHART_COLORS = ['#378ADD','#1D9E75','#EF9F27','#D85A30','#639922','#85B7EB','#5DCAA5','#854F0B','#A32D2D','#185FA5','#B4B2A9','#6ab49a'];

function renderSimpleChart(data, type, secId) {
  const keyMap = {media:'media',job:'jobType',dept:'dept',gender:'gender',status:'status',hire:'hireStatus'};
  const key = keyMap[type]; if (!key) return;
  const counts = {};
  data.forEach(a => { const v = a[key]||'未設定'; counts[v]=(counts[v]||0)+1; });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels = sorted.map(e=>e[0]), vals = sorted.map(e=>e[1]);
  const colors = CHART_COLORS.slice(0,labels.length);

  const barEl = document.getElementById('bar_'+type+'_'+secId);
  if (barEl) {
    const c = new Chart(barEl, {
      type:'bar',
      data:{labels, datasets:[{data:vals, backgroundColor:colors, borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},title:{display:false}},
        scales:{x:{grid:{display:false},ticks:{font:{size:10},maxRotation:35}},
                y:{beginAtZero:true,ticks:{stepSize:1,font:{size:10}}}}}
    });
    if (!sectionCharts[secId]) sectionCharts[secId]=[];
    sectionCharts[secId].push(c);
  }
  const pieEl = document.getElementById('pie_'+type+'_'+secId);
  if (pieEl) {
    const c = new Chart(pieEl, {
      type:'pie',
      data:{labels, datasets:[{data:vals, backgroundColor:colors, borderWidth:1}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,position:'right',labels:{font:{size:10},boxWidth:12}}}}
    });
    if (!sectionCharts[secId]) sectionCharts[secId]=[];
    sectionCharts[secId].push(c);
  }
}

function renderTrendInSection(data, secId) {
  const months={},int1m={},hirem={};
  data.forEach(a=>{if(a.appDate){const k=a.appDate.substring(0,7);months[k]=(months[k]||0)+1;if(a.int1Date)int1m[k]=(int1m[k]||0)+1;if(['内定','内定承諾','採用'].includes(a.hireStatus))hirem[k]=(hirem[k]||0)+1;}});
  const lbs=Object.keys(months).sort();
  const el=document.getElementById('trend_'+secId);
  if (!el) return;
  const c=new Chart(el,{type:'line',data:{labels:lbs,datasets:[
    {label:'応募数',data:lbs.map(l=>months[l]),borderColor:'#378ADD',backgroundColor:'rgba(55,138,221,0.07)',tension:0.3,fill:true,pointRadius:3},
    {label:'1次面接',data:lbs.map(l=>int1m[l]||0),borderColor:'#5DCAA5',borderDash:[4,2],tension:0.3,pointRadius:3},
    {label:'採用',data:lbs.map(l=>hirem[l]||0),borderColor:'#639922',tension:0.3,pointRadius:3},
  ]},options:{responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:true,position:'top',labels:{font:{size:10},boxWidth:12}}},
    scales:{y:{beginAtZero:true,ticks:{stepSize:1,font:{size:10}}},x:{grid:{display:false},ticks:{font:{size:10},maxRotation:45}}}}});
  if (!sectionCharts[secId]) sectionCharts[secId]=[];
  sectionCharts[secId].push(c);
}

function renderCrossChart(data, rowKey, colKey, viz, secId) {
  const getVal=(a,key)=>{
    if(key==='ageGroup'){const age=parseInt(a.age);if(!age)return'不明';if(age<30)return'20代以下';if(age<40)return'30代';if(age<50)return'40代';if(age<60)return'50代';return'60代以上';}
    return a[key]||'未設定';
  };
  const rowVals=[...new Set(data.map(a=>getVal(a,rowKey)).filter(Boolean))].sort();
  const colVals=[...new Set(data.map(a=>getVal(a,colKey)).filter(Boolean))].sort();
  const matrix={};rowVals.forEach(r=>{matrix[r]={};colVals.forEach(c=>matrix[r][c]=0);});
  const colTotals={};colVals.forEach(c=>colTotals[c]=0);
  data.forEach(a=>{const r=getVal(a,rowKey);const c=getVal(a,colKey);if(matrix[r])matrix[r][c]=(matrix[r][c]||0)+1;colTotals[c]=(colTotals[c]||0)+1;});
  const topCols=colVals.sort((a,b)=>(colTotals[b]||0)-(colTotals[a]||0)).slice(0,8);
  const container=document.getElementById('cross_chart_'+secId);
  if(!container)return;
  container.innerHTML=`<div style="position:relative;height:${Math.max(rowVals.length*36+80,220)}px;"><canvas id="bar_cross_${secId}"></canvas></div>`;
  const el=document.getElementById('bar_cross_'+secId);if(!el)return;
  const datasets=topCols.map((col,i)=>({
    label:col,data:rowVals.map(r=>matrix[r][col]||0),
    backgroundColor:CHART_COLORS[i%CHART_COLORS.length],borderRadius:3
  }));
  const c=new Chart(el,{type:'bar',data:{labels:rowVals,datasets},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top',labels:{font:{size:10},boxWidth:12}}},
      scales:{x:{stacked:true,ticks:{stepSize:1,font:{size:10}}},y:{stacked:true,grid:{display:false},ticks:{font:{size:10}}}}}});
  if(!sectionCharts[secId])sectionCharts[secId]=[];
  sectionCharts[secId].push(c);
}

// ========================================
// 多軸クロス集計（複数軸選択）
// ========================================
let multiAxisCols = []; // 選択中の列軸

function toggleMultiAxis(key) {
  if (multiAxisCols.includes(key)) {
    multiAxisCols = multiAxisCols.filter(k=>k!==key);
  } else {
    if (multiAxisCols.length >= 3) { alert('最大3軸まで選択できます'); return; }
    multiAxisCols.push(key);
  }
  updateMultiAxisUI();
}

function updateMultiAxisUI() {
  const keys = ['media','jobType','dept','ageGroup','agency','gender','status'];
  const labels = {jobType:'職種',dept:'部署',media:'媒体',agency:'紹介会社',ageGroup:'年代',gender:'性別',status:'ステータス'};
  keys.forEach(k => {
    const btn = document.getElementById('maxis_'+k);
    if (!btn) return;
    const selected = multiAxisCols.includes(k);
    btn.style.background = selected ? '#1a1a1a' : '#fafafa';
    btn.style.color = selected ? '#fff' : '#1a1a1a';
    btn.style.borderColor = selected ? '#1a1a1a' : '#ddd';
  });
  const preview = document.getElementById('multiAxisPreview');
  if (preview) {
    if (multiAxisCols.length > 0) {
      // 選択順に並べる（押した順）
      const orderedLabels = multiAxisCols.map(k => labels[k] || k);
      preview.textContent = '選択中: ' + orderedLabels.join(' × ') + '（' + multiAxisCols.length + '/3）';
      preview.style.color = multiAxisCols.length >= 2 ? '#185FA5' : '#aaa';
    } else {
      preview.textContent = '軸を選択してください（最大3軸・2軸以上で追加可能）';
      preview.style.color = '#aaa';
    }
  }
}

function addMultiAxisSection() {
  if (multiAxisCols.length < 2) {
    setStatus('複数軸クロス集計は2軸以上を選択してください（現在 ' + multiAxisCols.length + ' 軸）', 'err');
    alert('2軸以上を選択してください。\n例：月別 → 媒体 → 年代 のように2〜3軸を選択して「追加」を押してください。');
    return;
  }
  addSection('multi_axis', { axes: [...multiAxisCols] });
  multiAxisCols = [];
  updateMultiAxisUI();
}

function buildMultiAxisHTML(data, axes, secId) {
  if (!data.length) return '<div class="empty">データがありません</div>';
  if (!axes || axes.length < 2) return '<div class="empty">2軸以上を選択してください</div>';

  const labels = {jobType:'職種',dept:'部署',media:'媒体',agency:'紹介会社',ageGroup:'年代',gender:'性別',status:'ステータス',hireStatus:'採用可否'};
  const ax1 = axes[0], ax2 = axes[1], ax3 = axes[2];

  // 親軸（ax1）でグループ化
  const parentGroups = {};
  data.forEach(a => {
    const v = getAxisValue(a, ax1);
    if (!parentGroups[v]) parentGroups[v] = [];
    parentGroups[v].push(a);
  });
  // 応募数で降順、上位10件
  const sortedParents = Object.entries(parentGroups)
    .sort((a,b) => b[1].length - a[1].length)
    .slice(0, 10);
  const remaining = Object.keys(parentGroups).length - 10;

  const cards = sortedParents.map(([parentName, parentData]) => {
    // 親ファネル（媒体全体）の数値
    const cum = calcFunnelCumulative(parentData);
    const total = cum['applied'] || 0;
    const hired = cum['hired'] || 0;
    const hireRate = total ? Math.round(hired/total*100) : 0;

    // 親ファネル描画
    let parentSteps = '';
    FUNNEL_STEPS.forEach(s => {
      const cnt = cum[s.id] || 0;
      const pct = total ? Math.round(cnt/total*100) : 0;
      parentSteps += `<div class="fstep" data-step="${s.id}">
        <div class="fstep-label">${s.label}</div>
        <div class="fstep-bar-wrap"><div class="fstep-bar" style="width:${Math.max(pct,1)}%;"></div></div>
        <div class="fstep-stat"><span class="fstep-num">${cnt}</span><span class="fstep-pct">${pct}%</span></div>
      </div>`;
    });

    // 子軸（ax2）でグループ化
    const childGroups = {};
    parentData.forEach(a => {
      const v = getAxisValue(a, ax2);
      if (!childGroups[v]) childGroups[v] = [];
      childGroups[v].push(a);
    });
    const sortedChildren = Object.entries(childGroups)
      .sort((a,b) => b[1].length - a[1].length)
      .slice(0, 10);

    // 子ファネル描画
    const childCards = sortedChildren.map(([childName, childData]) => {
      const childCum = calcFunnelCumulative(childData);
      const childTotal = childCum['applied'] || 0;

      let childSteps = '';
      FUNNEL_STEPS.forEach(s => {
        const cnt = childCum[s.id] || 0;
        const pct = childTotal ? Math.round(cnt/childTotal*100) : 0;
        childSteps += `<div class="fstep" data-step="${s.id}">
          <div class="fstep-label">${s.label}</div>
          <div class="fstep-bar-wrap"><div class="fstep-bar" style="width:${Math.max(pct,1)}%;"></div></div>
          <div class="fstep-stat"><span class="fstep-num">${cnt}</span><span class="fstep-pct">${pct}%</span></div>
        </div>`;
      });

      // 3軸目（孫）がある場合：孫1行ミニバー
      let grandchildHtml = '';
      if (ax3) {
        const grandGroups = {};
        childData.forEach(a => {
          const v = getAxisValue(a, ax3);
          if (!grandGroups[v]) grandGroups[v] = [];
          grandGroups[v].push(a);
        });
        const sortedGrand = Object.entries(grandGroups)
          .sort((a,b) => b[1].length - a[1].length)
          .slice(0, 8);

        if (sortedGrand.length > 0) {
          const gcRows = sortedGrand.map(([grandName, grandData]) => {
            const gCum = calcFunnelCumulative(grandData);
            const gTotal = gCum['applied'] || 0;
            const miniSteps = FUNNEL_STEPS.map(s => {
              const cnt = gCum[s.id] || 0;
              const pct = gTotal ? Math.round(cnt/gTotal*100) : 0;
              return `<div class="gc-step" data-step="${s.id}">
                <div class="gc-bar-wrap"><div class="gc-bar" style="width:${Math.max(pct,1)}%;"></div></div>
                <span class="gc-num">${cnt}</span>
              </div>`;
            }).join('');
            return `<div class="nest-grandchild">
              <span class="nest-gc-title">${escFunnel(grandName)}（${gTotal}件）</span>
              <div class="nest-gc-mini">${miniSteps}</div>
            </div>`;
          }).join('');
          grandchildHtml = `
            <div class="nest-grandchildren-label">└ ${getAxisLabel(ax3)}別の内訳</div>
            <div class="nest-grandchildren">${gcRows}</div>`;
        }
      }

      return `<div class="nest-child">
        <div class="nest-child-head">
          <span class="nest-child-title">${escFunnel(childName)}</span>
          <span class="nest-child-total">応募 ${childTotal}件</span>
        </div>
        ${childSteps}
        ${grandchildHtml}
      </div>`;
    }).join('');

    return `<div class="nest-card">
      <div class="nest-card-head">
        <span class="nest-card-name">${escFunnel(parentName)}</span>
        <div class="nest-card-summary">
          <span><strong>${total}</strong>応募</span>
          <span><strong>${hired}</strong>採用</span>
          <span><strong>${hireRate}%</strong>採用率</span>
        </div>
      </div>
      <div class="nest-parent">
        <div class="nest-parent-label">▼ ${getAxisLabel(ax1)}全体</div>
        ${parentSteps}
      </div>
      <div class="nest-children-label">▼ ${getAxisLabel(ax2)}${ax3 ? ' → ' + getAxisLabel(ax3) : ''}別の内訳</div>
      <div class="nest-children">${childCards}</div>
    </div>`;
  }).join('');

  const note = remaining > 0
    ? `<div style="text-align:center;padding:8px;font-size:11px;color:#aaa;">他 ${remaining} 件は省略（応募数上位10件のみ表示）</div>`
    : '';

  return cards + note;
}

function renderCustomSections() {
  const container = document.getElementById('anCustomSections');
  if (!container) return;
  // 既存のChartを全破棄
  Object.values(sectionCharts).forEach(charts => charts.forEach(c => { try { c.destroy(); } catch(e) {} }));
  Object.keys(sectionCharts).forEach(k => delete sectionCharts[k]);
  const data = getAnData();
  // HTML生成
  container.innerHTML = activeSections.map(s => {
    let title;
    if (s.type === 'multi_axis' && s.opts && s.opts.axes) {
      const axisLabels = {jobType:'職種',dept:'部署',media:'媒体',agency:'紹介会社',ageGroup:'年代',gender:'性別',status:'ステータス',hireStatus:'採用可否'};
      title = '🔀 ' + s.opts.axes.map(k => axisLabels[k] || k).join(' × ');
    } else {
      title = getSectionTitle(s.type);
    }
    let bodyHtml;
    try {
      bodyHtml = buildSectionInline(data, s);
    } catch(e) {
      console.error('[buildSectionInline error]', s.type, s.id, e);
      bodyHtml = '<div class="empty" style="color:#D85A30;">表示エラー: ' + (e.message || e) + '</div>';
    }
    return `<div id="${s.id}" style="background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.04);overflow:hidden;margin-bottom:0;">
      <div onclick="toggleAccordion('${s.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:.875rem 1rem;cursor:pointer;border-bottom:1px solid #f0f0ee;" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
        <div style="font-size:12px;font-weight:600;color:#1a1a1a;">${title}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span id="acc_icon_${s.id}" style="font-size:14px;color:#aaa;">▼</span>
          <button class="btn-del" onclick="event.stopPropagation();removeSection('${s.id}')" style="font-size:10px;padding:2px 8px;">✕</button>
        </div>
      </div>
      <div id="acc_body_${s.id}" style="padding:1rem;">${bodyHtml}</div>
    </div>`;
  }).join('');
  // AI分析だけはDOM生成後に非同期で描画（ファネル系はCSS描画なのでJS呼出不要）
  activeSections.forEach(s => {
    try {
      if (s.type === 'ai') {
        renderAiAnalysis(data, 'acc_body_' + s.id);
      }
    } catch(e) {
      console.error('[renderCustomSections section error]', s.type, s.id, e);
    }
  });
}

function buildSectionInline(data, s) {
  if (!data.length) return '<div class="empty">データがありません</div>';
  const type = s.type;
  const secId = s.id;

  // AI分析（既存維持）
  if (type === 'ai') {
    return '<div style="color:#aaa;font-size:12px;padding:.5rem;text-align:center;">分析中...</div>';
  }

  // ビュー切替トグルのHTML生成
  const renderToggle = (current, options) => {
    return `<div class="view-toggle" style="margin-bottom:10px;">${
      options.map(o =>
        `<button class="${current===o.value?'active':''}" onclick="setSectionView('${secId}','${o.value}')">${o.label}</button>`
      ).join('')
    }</div>`;
  };

  // 単一軸ファネル分析
  const axisKeyMap = {
    media: 'media', job: 'jobType', dept: 'dept', age: 'ageGroup',
    gender: 'gender', agency: 'agency', status: 'status', hire: 'hireStatus'
  };
  if (axisKeyMap[type]) {
    const axisKey = axisKeyMap[type];
    const view = sectionViewMode[secId] || 'table'; // デフォルトはテーブル比較
    const toggle = renderToggle(view, [
      {value:'table', label:'📊 比較表示'},
      {value:'card',  label:'🎴 カード表示'}
    ]);
    const body = view === 'card'
      ? renderSingleAxisFunnel(data, a => getAxisValue(a, axisKey))
      : renderCompareTable(data, axisKey, secId);
    return toggle + body;
  }

  // 複数軸クロス集計
  if (type === 'multi_axis') {
    const axes = s.opts ? s.opts.axes : [];
    const view = sectionViewMode[secId] || 'table'; // デフォルトはテーブル比較
    const toggle = renderToggle(view, [
      {value:'table', label:'📊 比較表示'},
      {value:'nest',  label:'🌳 ネスト表示'}
    ]);
    const body = view === 'nest'
      ? buildMultiAxisHTML(data, axes, secId)
      : renderCompareTableMulti(data, axes, secId);
    return toggle + body;
  }

  return '<div class="empty">不明なセクションタイプです</div>';
}


function toggleAccordion(id) {
  const body = document.getElementById('acc_body_' + id);
  const icon = document.getElementById('acc_icon_' + id);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (icon) icon.style.transform = isOpen ? 'rotate(-90deg)' : '';
}

function getKeyLabel(key) {
  const m = { jobType:'職種', dept:'部署', media:'媒体', agency:'紹介会社', ageGroup:'年代', gender:'性別', status:'ステータス', hireStatus:'採用可否' };
  return m[key] || key;
}

function getSectionTitle(type) {
  const map = {
    media: '📡 媒体別', job: '💼 職種別', dept: '🏢 部署別',
    age: '👥 年代別', gender: '⚧ 性別', agency: '🏛️ 紹介会社別',
    status: '📋 ステータス別', hire: '✅ 採用可否別',
    ai: '🤖 AI分析', multi_axis: '🔀 複数軸クロス集計'
  };
  return map[type] || type;
}

function buildSectionHTML(data, type) {
  if (!data.length) return '<div class="empty">データがありません</div>';

  if (type === 'monthly_ref') {
    const ref = data.filter(a => a.agency && a.agency.trim());
    const nonRef = data.filter(a => !a.agency || !a.agency.trim());
    return renderMonthTable(buildMonthStats(nonRef), '▼ 紹介以外') + renderMonthTable(buildMonthStats(ref), '▼ 紹介');

  } else if (type === 'age') {
    return renderAgeTable(data);

  } else if (type === 'trend') {
    return `<div style="position:relative;width:100%;height:260px;"><canvas id="trend_canvas_${Date.now()}" class="trendCanvas"></canvas></div>`;

  } else if (type === 'ai') {
    const div = document.createElement('div');
    div.id = 'ai_content_' + Date.now();
    setTimeout(() => renderAiAnalysis(data, div.id), 50);
    return `<div id="${div.id}"><div style="color:#aaa;font-size:12px;padding:1rem;">分析中...</div></div>`;

  } else if (['media','job','dept','gender','status','hire'].includes(type)) {
    const keyMap = {media:'media',job:'jobType',dept:'dept',gender:'gender',status:'status',hire:'hireStatus'};
    return renderSimpleTable(data, keyMap[type]);

  } else if (type === 'dept_job') {
    return renderCrossTable(data, 'dept', 'jobType', '部署', '職種');
  } else if (type === 'age_job') {
    return renderCrossTable(data, 'ageGroup', 'jobType', '年代', '職種');
  } else if (type === 'job_status') {
    return renderCrossTable(data, 'jobType', 'status', '職種', 'ステータス');
  } else if (type === 'media_hire') {
    return renderCrossTable(data, 'media', 'hireStatus', '媒体', '採用可否');
  }
  return '<div class="empty">不明なセクションタイプです</div>';
}

// ========================================
// 分析テーブル共通ヘルパー
// ========================================
// 割合をパーセント表記の文字列で返す（0除算回避）
function pct(value, total) {
  if (!total) return '0%';
  return Math.round(value / total * 100) + '%';
}

// 割合に応じた色分けを返す
// threshold以上: 緑（良好）, threshold/2以上: 茶（注意）, それ未満: グレー
function pctColor(value, total, threshold) {
  if (!total) return '#aaa';
  const rate = value / total * 100;
  if (rate >= threshold * 2) return '#3B6D11'; // しきい値の2倍以上: 濃い緑
  if (rate >= threshold)     return '#639922'; // しきい値以上: 緑
  if (rate >= threshold / 2) return '#854F0B'; // しきい値の半分以上: 茶
  return '#aaa';                                 // 未満: グレー
}

// ========================================
// 分析テーブル共通スタイル
// ========================================
const thStyle  = 'background:#f5f5f5;color:#666;font-size:11px;font-weight:600;padding:8px 6px;text-align:center;border-bottom:2px solid #e0e0e0;white-space:nowrap;';
const thStyleL = 'background:#f5f5f5;color:#666;font-size:11px;font-weight:600;padding:8px 10px;text-align:left;border-bottom:2px solid #e0e0e0;white-space:nowrap;';
const tdStyle  = 'padding:7px 6px;text-align:center;border-bottom:1px solid #f0f0f0;font-size:12px;';
const tdStyleL = 'padding:7px 10px;text-align:left;border-bottom:1px solid #f0f0f0;font-size:12px;font-weight:500;';
const tfStyle  = 'padding:8px 6px;text-align:center;border-top:2px solid #ddd;background:#fafafa;font-size:12px;font-weight:600;';
const tfStyleL = 'padding:8px 10px;text-align:left;border-top:2px solid #ddd;background:#fafafa;font-size:12px;font-weight:700;';

function renderAgeTable(data) {
  const ageBands = ['10代','20代','30代','40代','50代','60代','70代以上'];
  const getAgeBand = a => {
    const age = parseInt(a.age); if (!age) return null;
    if (age < 20) return '10代'; if (age < 30) return '20代'; if (age < 40) return '30代';
    if (age < 50) return '40代'; if (age < 60) return '50代'; if (age < 70) return '60代';
    return '70代以上';
  };
  const months = [...new Set(data.map(a => a.appDate ? a.appDate.substring(0,7) : null).filter(Boolean))].sort();
  const matrix = {}; months.forEach(m => matrix[m] = {});
  const totals = {}; ageBands.forEach(b => totals[b] = 0);
  const monthTotals = {}; months.forEach(m => monthTotals[m] = 0);
  let grand = 0;
  data.forEach(a => {
    if (!a.appDate) return;
    const m = a.appDate.substring(0,7); const b = getAgeBand(a); if (!b) return;
    matrix[m][b] = (matrix[m][b] || 0) + 1; totals[b] = (totals[b] || 0) + 1;
    monthTotals[m] = (monthTotals[m] || 0) + 1; grand++;
  });
  const usedBands = ageBands.filter(b => totals[b] > 0);
  const hc = usedBands.map(b => `<th style="${thStyle}">${b}</th>`).join('');
  const rows = months.map(m => `<tr>
    <td style="${tdStyleL}">${m}</td>
    ${usedBands.map(b => { const v = matrix[m][b]||0; const p = monthTotals[m] ? Math.round(v/monthTotals[m]*100) : 0; return `<td style="${tdStyle}">${v ? v+'人<span style="font-size:9px;color:#aaa;margin-left:2px;">('+p+'%)</span>' : ''}</td>`; }).join('')}
    <td style="${tdStyle};font-weight:600;">${monthTotals[m]||0}人</td>
  </tr>`).join('');
  const fc = usedBands.map(b => { const p = grand ? Math.round(totals[b]/grand*100) : 0; return `<td style="${tfStyle}">${totals[b]}人<span style="font-size:9px;color:#aaa;">(${p}%)</span></td>`; }).join('');
  return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:500px;">
    <thead><tr><th style="${thStyleL}">月</th>${hc}<th style="${thStyle}">総計</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td style="${tfStyleL}">総計</td>${fc}<td style="${tfStyle}">${grand}人</td></tr></tfoot>
  </table></div>`;
}

function renderSimpleTable(data, key) {
  const counts = {}, int1c = {}, hiredc = {};
  data.forEach(a => {
    const v = a[key] || '(未設定)';
    counts[v] = (counts[v]||0) + 1;
    if (a.int1Date) int1c[v] = (int1c[v]||0) + 1;
    if (['内定','内定承諾','採用'].includes(a.hireStatus)) hiredc[v] = (hiredc[v]||0) + 1;
  });
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const rows = sorted.map(([k,v]) => `<tr>
    <td style="${tdStyleL}">${k}</td>
    <td style="${tdStyle}">${v}</td>
    <td style="${tdStyle}">${pct(v,data.length)}</td>
    <td style="${tdStyle}">${int1c[k]||0}</td>
    <td style="${tdStyle};color:${pctColor(int1c[k]||0,v,10)};font-weight:600;">${pct(int1c[k]||0,v)}</td>
    <td style="${tdStyle};color:#639922;font-weight:600;">${hiredc[k]||0}</td>
    <td style="${tdStyle};color:${pctColor(hiredc[k]||0,v,5)};font-weight:600;">${pct(hiredc[k]||0,v)}</td>
  </tr>`).join('');
  const tot = data.length;
  const totInt1 = data.filter(a => a.int1Date).length;
  const totHired = data.filter(a => ['内定','内定承諾','採用'].includes(a.hireStatus)).length;
  return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="${thStyleL}">項目</th><th style="${thStyle}">応募数</th><th style="${thStyle}">構成比</th>
      <th style="${thStyle}">1次面接</th><th style="${thStyle};color:#378ADD;">面接率</th>
      <th style="${thStyle};color:#639922;">採用数</th><th style="${thStyle};color:#3B6D11;">採用率</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td style="${tfStyleL}">合計</td><td style="${tfStyle}">${tot}</td><td style="${tfStyle}">100%</td>
      <td style="${tfStyle}">${totInt1}</td><td style="${tfStyle};color:#378ADD;">${pct(totInt1,tot)}</td>
      <td style="${tfStyle};color:#639922;">${totHired}</td><td style="${tfStyle};color:#3B6D11;">${pct(totHired,tot)}</td>
    </tr></tfoot>
  </table></div>`;
}

function renderCrossTable(data, rowKey, colKey, rowLabel, colLabel) {
  // rowKeyがageGroupの場合は年代を計算
  const getVal = (a, key) => {
    if (key === 'ageGroup') {
      const age = parseInt(a.age); if (!age) return '不明';
      if (age < 30) return '20代以下'; if (age < 40) return '30代';
      if (age < 50) return '40代'; if (age < 60) return '50代'; return '60代以上';
    }
    return a[key] || '(未設定)';
  };
  const rowVals = [...new Set(data.map(a => getVal(a, rowKey)).filter(Boolean))].sort();
  const colVals = [...new Set(data.map(a => getVal(a, colKey)).filter(Boolean))].sort();
  if (!rowVals.length || !colVals.length) return '<div class="empty">データが不足しています</div>';
  const matrix = {};
  rowVals.forEach(r => { matrix[r] = {}; colVals.forEach(c => matrix[r][c] = 0); });
  const rowTotals = {}; rowVals.forEach(r => rowTotals[r] = 0);
  const colTotals = {}; colVals.forEach(c => colTotals[c] = 0);
  let grand = 0;
  data.forEach(a => {
    const r = getVal(a, rowKey); const c = getVal(a, colKey);
    if (!matrix[r]) return;
    matrix[r][c] = (matrix[r][c] || 0) + 1;
    rowTotals[r] = (rowTotals[r] || 0) + 1;
    colTotals[c] = (colTotals[c] || 0) + 1;
    grand++;
  });
  // 列を応募数多い順にソート
  const sortedCols = colVals.sort((a,b) => (colTotals[b]||0) - (colTotals[a]||0)).slice(0, 10);
  const hc = sortedCols.map(c => `<th style="${thStyle};max-width:80px;overflow:hidden;text-overflow:ellipsis;" title="${c}">${c.length>8?c.slice(0,8)+'…':c}</th>`).join('');
  const rows = rowVals.map(r => `<tr>
    <td style="${tdStyleL}">${r}</td>
    ${sortedCols.map(c => { const v = matrix[r][c]||0; const p = rowTotals[r] ? Math.round(v/rowTotals[r]*100) : 0; return `<td style="${tdStyle}">${v ? `<span style="font-weight:600;">${v}</span><span style="font-size:9px;color:#aaa;margin-left:2px;">(${p}%)</span>` : ''}</td>`; }).join('')}
    <td style="${tdStyle};font-weight:700;">${rowTotals[r]}人</td>
  </tr>`).join('');
  const fc = sortedCols.map(c => `<td style="${tfStyle}">${colTotals[c]||0}人</td>`).join('');
  return `<div style="overflow-x:auto;font-size:11px;color:#666;margin-bottom:4px;">行：${rowLabel}　列：${colLabel}（上位10列表示）</div>
  <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:400px;">
    <thead><tr><th style="${thStyleL}">${rowLabel}</th>${hc}<th style="${thStyle}">合計</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td style="${tfStyleL}">合計</td>${fc}<td style="${tfStyle}">${grand}人</td></tr></tfoot>
  </table></div>`;
}

function renderAiAnalysis(data, targetId) {
  const el = targetId ? document.getElementById(targetId) : document.getElementById('anContent');
  if (!el) return;
  el.innerHTML = '<div style="padding:1rem;text-align:center;color:#aaa;font-size:12px;">分析中...</div>';
  const total = data.length;
  if (!total) { el.innerHTML = '<div class="empty">データがありません</div>'; return; }
  const int1n = data.filter(a=>a.int1Date).length;
  const int2n = data.filter(a=>a.int2Date).length;
  const hiredn = data.filter(a=>['内定','内定承諾','採用'].includes(a.hireStatus)).length;
  const rejected = data.filter(a=>a.status==='不採用'||a.hireStatus==='不採用').length;
  const withdrew = data.filter(a=>a.status&&(a.status.includes('辞退')||a.status.includes('連絡不通'))).length;
  const intRate = total?Math.round(int1n/total*100):0;
  const hireRate = total?Math.round(hiredn/total*100):0;
  const mc={},jc={},ac={},gc={},months={};
  data.forEach(a=>{
    if(a.media)mc[a.media]=(mc[a.media]||0)+1;
    if(a.jobType)jc[a.jobType]=(jc[a.jobType]||0)+1;
    if(a.gender)gc[a.gender]=(gc[a.gender]||0)+1;
    if(a.appDate){const m=a.appDate.substring(0,7);months[m]=(months[m]||0)+1;}
    const age=parseInt(a.age);if(age){const b=age<30?'20代以下':age<40?'30代':age<50?'40代':age<60?'50代':'60代以上';ac[b]=(ac[b]||0)+1;}
  });
  const topMedia=Object.entries(mc).sort((a,b)=>b[1]-a[1]);
  const topMediaPct=topMedia[0]&&total?Math.round(topMedia[0][1]/total*100):0;
  const topAge=Object.entries(ac).sort((a,b)=>b[1]-a[1]);
  const topAgePct=topAge[0]&&total?Math.round(topAge[0][1]/total*100):0;
  const mKeys=Object.keys(months).sort();
  const lastM=mKeys[mKeys.length-1],prevM=mKeys[mKeys.length-2];
  const mTrend=months[prevM]?Math.round((months[lastM]-months[prevM])/months[prevM]*100):0;
  const refCount=data.filter(a=>a.agency&&a.agency.trim()).length;
  const refHired=data.filter(a=>a.agency&&a.agency.trim()&&['内定','内定承諾','採用'].includes(a.hireStatus)).length;
  const refHireRate=refCount?Math.round(refHired/refCount*100):0;
  const nonRefCount=total-refCount;
  const nonRefHired=hiredn-refHired;
  const nonRefHireRate=nonRefCount?Math.round(nonRefHired/nonRefCount*100):0;
  const malePct=gc['男性']?Math.round(gc['男性']/total*100):0;
  const femalePct=gc['女性']?Math.round(gc['女性']/total*100):0;
  const sections=[];
  let overall=hireRate>=10?'採用率が'+hireRate+'%と高水準です。現在の選考フローは効果的に機能しています。':hireRate>=5?'採用率は'+hireRate+'%で標準的な水準です。さらなる改善の余地があります。':'採用率が'+hireRate+'%と低めです。母集団の質向上や選考基準の見直しを検討してください。';
  if(intRate>=20)overall+=' 面接実施率は'+intRate+'%と高く、書類選考の精度が高いです。';else overall+=' 面接実施率は'+intRate+'%です。書類選考基準の適正化を検討してください。';
  if(mTrend>0)overall+=' 直近月の応募数は前月比+'+mTrend+'%と増加傾向です。';else if(mTrend<0)overall+=' 直近月の応募数は前月比'+mTrend+'%と減少傾向です。';
  sections.push({title:'📊 総評・全体傾向',content:overall,color:'#1a1a1a'});
  let mediaText=topMedia.length>0?'最多媒体は「'+topMedia[0][0]+'」('+topMedia[0][1]+'名・'+topMediaPct+'%)。'+(topMedia.length>1?'次いで「'+topMedia[1][0]+'」('+topMedia[1][1]+'名)。':'')+(topMediaPct>60?' 1媒体集中リスクあり。他媒体の強化を推奨。':'')+(refCount>0?' 紹介採用率'+refHireRate+'%、紹介以外'+nonRefHireRate+'%。'+(refHireRate>nonRefHireRate?' 紹介ルートへの投資を優先推奨。':' 紹介以外も効果的です。'):''):'媒体データが不足しています。';
  sections.push({title:'📡 媒体戦略',content:mediaText+'<br><span style="color:#378ADD;font-size:11px;">【アドバイス】'+( topMedia.length>2?'上位3媒体に予算集中し、採用率低媒体はコスト検証してください。':'複数媒体を活用して母集団を拡大することを推奨します。')+'</span>',color:'#185FA5'});
  let attrText=topAge.length>0?'応募者の最多年代は「'+(topAge[0][0])+'」('+topAgePct+'%)。':''; const youngPct2=(ac['20代以下']||0)+(ac['30代']||0); if(total&&youngPct2/total>0.5)attrText+='若年層が過半数。ポテンシャル採用中心。';attrText+=' 性別は男性'+malePct+'%・女性'+femalePct+'%。';if(femalePct<20)attrText+=' 女性比率低め。女性向け訴求強化を推奨。';
  sections.push({title:'👥 属性分析',content:attrText+'<br><span style="color:#378ADD;font-size:11px;">【アドバイス】ターゲット層に合わせた求人票の見直しで応募品質が向上します。</span>',color:'#0F6E56'});
  let funnelText='応募'+total+'名→1次面接'+int1n+'名('+intRate+'%)→2次面接'+int2n+'名('+( total?Math.round(int2n/total*100):0)+'%)→採用'+hiredn+'名('+hireRate+'%)。';if(intRate<10)funnelText+='書類通過率低め。要件見直し推奨。';const int2Rate2=int1n?Math.round(int2n/int1n*100):0;if(int2Rate2<50&&int2n>0)funnelText+=' 1→2次通過率'+int2Rate2+'%。評価基準の明確化を推奨。';if(withdrew/total>0.15)funnelText+=' 辞退・連絡不通が'+Math.round(withdrew/total*100)+'%と高め。フォロー迅速化を推奨。';
  sections.push({title:'🔻 ファネル分析',content:funnelText,color:'#A32D2D'});
  const actions=[];if(intRate<15)actions.push('書類選考基準を見直し、面接実施率'+intRate+'%→20%以上に改善');if(topMediaPct>60)actions.push('「'+(topMedia[0]?topMedia[0][0]:'主要媒体')+'」への依存を下げ、他媒体を強化');if(hireRate<5)actions.push('採用要件を再定義し、求人票の訴求ポイントを見直す');if(withdrew/total>0.1)actions.push('応募者へのコンタクトを24時間以内に行い、辞退・連絡不通を減らす');if(refHireRate>nonRefHireRate&&refCount>0)actions.push('紹介経由の採用率が高いため、紹介ネットワークを強化する');if(actions.length<3)actions.push('採用データを定期分析し、月次で媒体・選考基準を見直す');
  const actionHtml=actions.slice(0,5).map((a,i)=>'<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;"><span style="background:#1a1a1a;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">'+( i+1)+'</span><span style="font-size:12px;">'+a+'</span></div>').join('');
  sections.push({title:'✅ アクションアイテム',content:actionHtml,color:'#639922'});
  el.innerHTML='<div style="display:flex;flex-direction:column;gap:.875rem;">'+sections.map(s=>`<div style="border-left:3px solid ${s.color};background:#fafafa;border-radius:0 8px 8px 0;padding:.875rem 1rem;"><div style="font-size:12px;font-weight:700;color:${s.color};margin-bottom:6px;">${s.title}</div><div style="font-size:12px;color:#2a2a2a;line-height:1.8;">${s.content}</div></div>`).join('')+'</div>';
}

function updateTaskBadge() {
  const btn = document.getElementById('taskNavBtn');
  if (!btn) return;
  const today = new Date().toISOString().split('T')[0];
  const pending = tasks.filter(t => !t.done).length;
  const overdue = tasks.filter(t => !t.done && t.due && t.due < today).length;
  if (pending > 0) {
    btn.innerHTML = `タスク <span style="background:${overdue>0?'#D85A30':'#378ADD'};color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:3px;">${overdue>0?'!':''} ${pending}</span>`;
  } else {
    btn.textContent = 'タスク';
  }
}

function setCompare(mode) {
  const from = document.getElementById('anFrom').value;
  const to = document.getElementById('anTo').value;
  const now = new Date();
  let f2='', t2='';
  if (mode === 'lastMonth') {
    const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const d2 = new Date(now.getFullYear(), now.getMonth(), 0);
    f2 = d.toISOString().split('T')[0]; t2 = d2.toISOString().split('T')[0];
  } else if (mode === 'last3m') {
    const d = new Date(now); d.setMonth(d.getMonth()-6);
    const d2 = new Date(now); d2.setMonth(d2.getMonth()-3);
    f2 = d.toISOString().split('T')[0]; t2 = d2.toISOString().split('T')[0];
  } else if (mode === 'lastYear') {
    if (from && to) {
      const df=new Date(from); df.setFullYear(df.getFullYear()-1);
      const dt=new Date(to); dt.setFullYear(dt.getFullYear()-1);
      f2=df.toISOString().split('T')[0]; t2=dt.toISOString().split('T')[0];
    }
  }
  document.getElementById('anFrom2').value = f2;
  document.getElementById('anTo2').value = t2;
  document.getElementById('compareStatus').textContent = f2&&t2?`比較中: ${f2} 〜 ${t2}`:'';
  renderAn();
}

function clearCompare() {
  document.getElementById('anFrom2').value = '';
  document.getElementById('anTo2').value = '';
  document.getElementById('compareStatus').textContent = '';
  renderAn();
}

function getCompareData() {
  const f=document.getElementById('anFrom2').value, t=document.getElementById('anTo2').value;
  if (!f && !t) return null;
  return applicants.filter(a=>{ if(f&&a.appDate<f)return false; if(t&&a.appDate>t)return false; return true; });
}

function renderCompareBar(dataA, dataB, labelA, labelB) {
  if (!dataB) return '';
  const metrics = [
    {label:'応募数', a:dataA.length, b:dataB.length},
    {label:'1次面接', a:dataA.filter(x=>x.int1Date).length, b:dataB.filter(x=>x.int1Date).length},
    {label:'採用', a:dataA.filter(x=>['内定','内定承諾','採用'].includes(x.hireStatus)).length, b:dataB.filter(x=>['内定','内定承諾','採用'].includes(x.hireStatus)).length},
    {label:'面接率', a:dataA.length?Math.round(dataA.filter(x=>x.int1Date).length/dataA.length*100):0, b:dataB.length?Math.round(dataB.filter(x=>x.int1Date).length/dataB.length*100):0, pct:true},
    {label:'採用率', a:dataA.length?Math.round(dataA.filter(x=>['内定','内定承諾','採用'].includes(x.hireStatus)).length/dataA.length*100):0, b:dataB.length?Math.round(dataB.filter(x=>['内定','内定承諾','採用'].includes(x.hireStatus)).length/dataB.length*100):0, pct:true},
  ];
  return `<div style="background:#f0f6ff;border-radius:8px;padding:.875rem;margin-bottom:1rem;border-left:3px solid #378ADD;">
    <div style="font-size:11px;font-weight:600;color:#378ADD;margin-bottom:8px;">📊 期間比較: ${labelA} vs ${labelB}</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
      ${metrics.map(m=>{
        const diff=m.a-m.b; const up=diff>=0;
        return`<div style="text-align:center;background:#fff;border-radius:6px;padding:7px;">
          <div style="font-size:10px;color:#aaa;margin-bottom:3px;">${m.label}</div>
          <div style="font-size:15px;font-weight:700;color:#1a1a1a;">${m.a}${m.pct?'%':''}</div>
          <div style="font-size:10px;color:${up?'#3B6D11':'#D85A30'};margin-top:2px;">${up?'▲':'▼'}${Math.abs(diff)}${m.pct?'%':''}</div>
          <div style="font-size:10px;color:#aaa;">B: ${m.b}${m.pct?'%':''}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderAiAnalysis(data, targetId) {
  const el = targetId ? document.getElementById(targetId) : document.getElementById('anContent');
  if (!el) return;
  el.innerHTML = '<div style="padding:1rem;text-align:center;color:#aaa;font-size:12px;">分析中...</div>';

  const total = data.length;
  if (!total) { el.innerHTML = '<div class="empty">データがありません</div>'; return; }

  const int1n = data.filter(a=>a.int1Date).length;
  const int2n = data.filter(a=>a.int2Date).length;
  const hiredn = data.filter(a=>['内定','内定承諾','採用'].includes(a.hireStatus)).length;
  const rejected = data.filter(a=>a.status==='不採用'||a.hireStatus==='不採用').length;
  const withdrew = data.filter(a=>a.status&&(a.status.includes('辞退')||a.status.includes('連絡不通'))).length;
  const intRate = total?Math.round(int1n/total*100):0;
  const hireRate = total?Math.round(hiredn/total*100):0;

  // 媒体別集計
  const mc={};
  data.forEach(a=>{if(a.media)mc[a.media]=(mc[a.media]||0)+1;});
  const topMedia = Object.entries(mc).sort((a,b)=>b[1]-a[1]);
  const topMediaName = topMedia[0]?topMedia[0][0]:'';
  const topMediaPct = topMedia[0]?Math.round(topMedia[0][1]/total*100):0;

  // 職種別
  const jc={};
  data.forEach(a=>{if(a.jobType)jc[a.jobType]=(jc[a.jobType]||0)+1;});
  const topJobs = Object.entries(jc).sort((a,b)=>b[1]-a[1]);

  // 年代別
  const ac={};
  data.forEach(a=>{const age=parseInt(a.age);if(age){const b=age<30?'20代以下':age<40?'30代':age<50?'40代':age<60?'50代':'60代以上';ac[b]=(ac[b]||0)+1;}});
  const topAge = Object.entries(ac).sort((a,b)=>b[1]-a[1]);
  const topAgeName = topAge[0]?topAge[0][0]:'';
  const topAgePct = topAge[0]&&total?Math.round(topAge[0][1]/total*100):0;

  // 性別
  const gc={};
  data.forEach(a=>{if(a.gender)gc[a.gender]=(gc[a.gender]||0)+1;});
  const malePct = gc['男性']?Math.round(gc['男性']/total*100):0;
  const femalePct = gc['女性']?Math.round(gc['女性']/total*100):0;

  // 月別トレンド（増減）
  const months={};
  data.forEach(a=>{if(a.appDate){const m=a.appDate.substring(0,7);months[m]=(months[m]||0)+1;}});
  const mKeys=Object.keys(months).sort();
  const lastM=mKeys[mKeys.length-1], prevM=mKeys[mKeys.length-2];
  const lastMCount=months[lastM]||0, prevMCount=months[prevM]||0;
  const mTrend=prevMCount?Math.round((lastMCount-prevMCount)/prevMCount*100):0;

  // 紹介vs非紹介
  const refCount=data.filter(a=>a.agency&&a.agency.trim()).length;
  const refHired=data.filter(a=>a.agency&&a.agency.trim()&&['内定','内定承諾','採用'].includes(a.hireStatus)).length;
  const nonRefHired=hiredn-refHired;
  const refHireRate=refCount?Math.round(refHired/refCount*100):0;
  const nonRefCount=total-refCount;
  const nonRefHireRate=nonRefCount?Math.round(nonRefHired/nonRefCount*100):0;

  // 分析テキスト生成
  const sections = [];

  // 1. 総評
  let overall = '';
  if(hireRate>=10) overall='採用率が'+hireRate+'%と高水準です。現在の選考フローは効果的に機能しています。';
  else if(hireRate>=5) overall='採用率は'+hireRate+'%で業界標準的な水準です。さらなる改善の余地があります。';
  else overall='採用率が'+hireRate+'%と低めです。母集団の質向上や選考基準の見直しを検討してください。';
  if(intRate>=20) overall+=' 面接実施率は'+intRate+'%と高く、書類選考の精度が高いと言えます。';
  else overall+=' 面接実施率は'+intRate+'%です。書類選考基準の適正化を検討してください。';
  if(mTrend>0) overall+=' 直近月の応募数は前月比+'+mTrend+'%と増加傾向にあります。';
  else if(mTrend<0) overall+=' 直近月の応募数は前月比'+mTrend+'%と減少傾向にあります。採用施策の強化が必要かもしれません。';
  sections.push({title:'📊 総評・全体傾向', content:overall, color:'#1a1a1a'});

  // 2. 媒体戦略
  let mediaText = '';
  if(topMedia.length>0){
    mediaText += '最も応募が多い媒体は「'+topMedia[0][0]+'」（'+topMedia[0][1]+'名・'+topMediaPct+'%）です。';
    if(topMedia.length>1) mediaText += '次いで「'+topMedia[1][0]+'」（'+topMedia[1][1]+'名）が続きます。';
    if(topMediaPct>60) mediaText += ' 1媒体への依存度が高いため、リスク分散として他媒体の強化を推奨します。';
    if(refCount>0){
      mediaText += ' 紹介経由の採用率は'+refHireRate+'%、紹介以外は'+nonRefHireRate+'%です。';
      if(refHireRate>nonRefHireRate) mediaText += '紹介の採用率が高いため、紹介ルートへの投資を優先することを推奨します。';
      else mediaText += '紹介以外のルートも採用率が良好です。';
    }
  } else { mediaText = '媒体データが不足しています。媒体名を登録して分析精度を上げてください。'; }
  const mediaAdvice = topMedia.length>2?'【アドバイス】上位3媒体に予算を集中しつつ、採用率が低い媒体はコスト対効果を検証してください。':'【アドバイス】複数媒体を活用して応募者の母集団を拡大することを推奨します。';
  sections.push({title:'📡 媒体戦略', content:mediaText+'<br><span style="color:#378ADD;font-size:11px;">'+mediaAdvice+'</span>', color:'#185FA5'});

  // 3. 年代・性別分析
  let attrText = '';
  if(topAge.length>0){
    attrText += '応募者の年代は「'+topAgeName+'」が最多（'+topAgePct+'%）です。';
    const youngPct=(ac['20代以下']||0)+(ac['30代']||0);
    const midPct=(ac['40代']||0)+(ac['50代']||0);
    const total2=total||1;
    if(youngPct/total2>0.5) attrText += '若年層が過半数を占めており、即戦力よりポテンシャル採用が中心の傾向があります。';
    else if(midPct/total2>0.5) attrText += '40〜50代が多く、経験者採用が中心の傾向があります。';
  }
  attrText += ' 性別は男性'+malePct+'%・女性'+femalePct+'%の構成です。';
  if(femalePct<20) attrText += '女性比率が低め（'+femalePct+'%）のため、女性が応募しやすい求人内容・媒体選択を検討してください。';
  const attrAdvice = '【アドバイス】ターゲット層に合わせた求人票の訴求ポイントを見直すことで、応募の質が向上します。';
  sections.push({title:'👥 属性分析（年代・性別）', content:attrText+'<br><span style="color:#378ADD;font-size:11px;">'+attrAdvice+'</span>', color:'#0F6E56'});

  // 4. ファネル分析
  let funnelText = '応募'+total+'名 → 1次面接'+int1n+'名（'+intRate+'%）→ 2次面接'+int2n+'名（'+( total?Math.round(int2n/total*100):0)+'%）→ 採用'+hiredn+'名（'+hireRate+'%）。';
  if(intRate<10) funnelText += '書類通過率が低めです。求人要件が厳しすぎる可能性があります。要件を緩和するか、より適した媒体へのシフトを検討してください。';
  const int2Rate = int1n?Math.round(int2n/int1n*100):0;
  if(int2Rate<50&&int2n>0) funnelText += '1次から2次への通過率は'+int2Rate+'%です。1次面接の評価基準を明確化することを推奨します。';
  const step3Rate = int2n?Math.round(hiredn/int2n*100):0;
  if(step3Rate<70&&int2n>0) funnelText += '2次面接から採用への転換率は'+step3Rate+'%です。最終判断の基準を関係者間で統一すると改善につながります。';
  funnelText += ' 辞退・連絡不通は'+withdrew+'名（'+( total?Math.round(withdrew/total*100):0)+'%）です。';
  if(withdrew/total>0.15) funnelText += '辞退率が高めのため、応募者フォローの迅速化・コミュニケーション改善を推奨します。';
  sections.push({title:'🔻 採用ファネル・歩留り分析', content:funnelText, color:'#A32D2D'});

  // 5. 職種分析
  let jobText = '';
  if(topJobs.length>0){
    jobText = '応募数上位の職種：';
    topJobs.slice(0,4).forEach(([k,v])=>{ jobText += '「'+k+'」'+v+'名（'+Math.round(v/total*100)+'%）、'; });
    jobText = jobText.replace(/、$/, '。');
    if(topJobs.length===1) jobText += '単一職種への集中は採用リスクがあります。複数職種の並行採用を検討してください。';
  }
  sections.push({title:'💼 職種別傾向', content:jobText||'職種データが少ないため、応募者登録時に職種を入力してください。', color:'#854F0B'});

  // 6. アクションアイテム
  const actions = [];
  if(intRate<15) actions.push('書類選考基準を見直し、面接実施率を'+intRate+'%→20%以上に改善する');
  if(topMediaPct>60) actions.push('「'+topMediaName+'」への依存を下げ、他媒体（紹介・エージェント等）を強化する');
  if(hireRate<5) actions.push('採用要件を再定義し、求人票の訴求ポイントを見直す');
  if(withdrew/total>0.1) actions.push('応募者へのファーストコンタクトを24時間以内に行い、辞退・連絡不通を減らす');
  if(refHireRate>nonRefHireRate&&refCount>0) actions.push('紹介経由の採用率が高いため、紹介ネットワーク（人材紹介会社・OB/OG）を強化する');
  if(actions.length<3) actions.push('採用データを定期的に分析し、月次で媒体・選考基準を見直す');
  const actionHtml = actions.slice(0,5).map((a,i)=>'<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;"><span style="background:#1a1a1a;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">'+(i+1)+'</span><span style="font-size:12px;">'+a+'</span></div>').join('');
  sections.push({title:'✅ アクションアイテム', content:actionHtml, color:'#639922'});

  // HTML生成
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:.875rem;margin-top:.5rem;">' +
    sections.map(s=>`<div style="border-left:3px solid ${s.color};background:#fafafa;border-radius:0 8px 8px 0;padding:.875rem 1rem;">
      <div style="font-size:12px;font-weight:700;color:${s.color};margin-bottom:6px;">${s.title}</div>
      <div style="font-size:12px;color:#2a2a2a;line-height:1.8;">${s.content}</div>
    </div>`).join('') +
  '</div>';
}


// ========================================
// 議事録・タスク
// ========================================
let minutes = [];      // 議事録リスト
let tasks = [];        // 全タスクリスト（議事録由来＋手動）
let tempMinuteTasks = []; // 議事録作成中の一時タスク
let editingMinuteId = null;

const MINUTES_KEY = () => `saiyo_minutes_${currentClientId}_v1`;
const TASKS_KEY = () => `saiyo_tasks_${currentClientId}_v1`;

async function loadMinutesAndTasks() {
  const cid = currentClientId;
  try {
    let mQuery = sb.from('minutes').select('*').order('date', { ascending: false });
    if (!isAdmin) mQuery = mQuery.eq('client_id', cid);
    const { data: mData } = await mQuery;
    minutes = (mData || []).map(r => ({
      id: r.id, date: r.date, title: r.title, url: r.url,
      tasks: r.tasks || [], clientId: r.client_id, createdAt: r.created_at
    }));
  } catch(e) { minutes = []; }
  try {
    let tQuery = sb.from('tasks').select('*').order('created_at', { ascending: false });
    if (!isAdmin) tQuery = tQuery.eq('client_id', cid);
    const { data: tData, error: tErr } = await tQuery;
    if (tErr && (tErr.message.includes('relation') || tErr.message.includes('does not exist'))) {
      // テーブル未作成時はlocalStorageから読み込み
      const fb = JSON.parse(localStorage.getItem('saiyo_tasks_fallback_' + cid) || '[]');
      tasks = fb;
      if (fb.length) setStatus('⚠ タスクテーブルが未作成です。Supabaseで add_minutes_tasks_tables.sql を実行してください。', '');
    } else {
      tasks = (tData || []).map(r => ({
        id: r.id, owner: r.owner, content: r.content,
        startDate: r.start_date, due: r.due_date, priority: r.priority,
        done: r.done, doneDate: r.done_date, source: r.source,
        minuteId: r.minute_id, clientId: r.client_id
      }));
    }
  } catch(e) { tasks = []; }
}
async function saveMinutesData() {
  // Supabaseへの保存はsaveMinute()内で個別に実施
}
async function saveTasksData() {
  // Supabaseへの保存はsaveManualTask/confirmComplete/deleteTask内で実施
  updateTaskBadge();
  if(document.getElementById("sec-dashboard") && document.getElementById("sec-dashboard").classList.contains("active")) renderDashTasks();
}

// 議事録フォーム
function showMinutesForm() {
  tempMinuteTasks = [];
  editingMinuteId = null;
  document.getElementById('mDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('mUrl').value = '';
  document.getElementById('mTitle').value = '';
  document.getElementById('mTaskList').innerHTML = '';
  document.getElementById('minutesForm').style.display = 'block';
  document.getElementById('minutesForm').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function hideMinutesForm() {
  document.getElementById('minutesForm').style.display = 'none';
  tempMinuteTasks = [];
}

function addTaskToMinutes() {
  const owner = document.getElementById('tOwner').value;
  const content = document.getElementById('tContent').value.trim();
  const due = document.getElementById('tDue').value;
  const priority = document.getElementById('tPriority').value;
  if (!content) { alert('タスク内容を入力してください'); return; }
  const task = { id: Date.now()+'', owner, content, due, priority, done: false, doneDate: '', source: 'minutes' };
  tempMinuteTasks.push(task);
  document.getElementById('tContent').value = '';
  document.getElementById('tDue').value = '';
  renderTempTaskList();
}
function removeMinuteTask(id) {
  tempMinuteTasks = tempMinuteTasks.filter(t => t.id !== id);
  renderTempTaskList();
}
function renderTempTaskList() {
  const el = document.getElementById('mTaskList');
  if (!tempMinuteTasks.length) { el.innerHTML = ''; return; }
  el.innerHTML = tempMinuteTasks.map(t => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border-radius:6px;border:1px solid #e8e8e6;font-size:11px;">
      <span class="badge ${getOwnerBadgeClass(t.owner)}">${escapeOwnerHtml(t.owner||'未設定')}</span>
      <span style="flex:1;">${t.content}</span>
      <span style="color:#aaa;">${t.due||'期限なし'}</span>
      <span class="badge ${t.priority==='高'?'br':t.priority==='低'?'bg':'bgr'}">${t.priority}</span>
      <button class="btn-del" onclick="removeMinuteTask('${t.id}')">削除</button>
    </div>`).join('');
}

async function saveMinutes() {
  const date = document.getElementById('mDate').value;
  const url = document.getElementById('mUrl').value;
  const title = document.getElementById('mTitle').value;
  if (!date) { alert('日付を入力してください'); return; }
  const mid = editingMinuteId || (Date.now()+'');
  const cid = currentClientId;
  const row = { id: mid, client_id: cid, date, url: url||null, title: title||null, tasks: tempMinuteTasks };
  if (editingMinuteId) {
    let mUpdQuery = sb.from('minutes').update(row).eq('id', mid);
    if (!isAdmin) mUpdQuery = mUpdQuery.eq('client_id', currentClientId);
    await mUpdQuery;
    // 関連タスクを削除して再挿入
    let tDelQuery = sb.from('tasks').delete().eq('minute_id', mid);
    if (!isAdmin) tDelQuery = tDelQuery.eq('client_id', currentClientId);
    await tDelQuery;
    tasks = tasks.filter(t => t.minuteId !== mid);
  } else {
    row.client_id = currentClientId; // マルチテナント強制付与
    await sb.from('minutes').insert(row);
    minutes.unshift({ id: mid, date, url, title, tasks: tempMinuteTasks, clientId: cid });
  }
  // タスクをSupabaseに保存
  if (tempMinuteTasks.length) {
    const taskRows = tempMinuteTasks.map(t => ({
      id: t.id || (Date.now()+Math.random()+''),
      client_id: cid, owner: t.owner, content: t.content,
      due_date: t.due||null, priority: t.priority||'中',
      done: false, source: 'minutes', minute_id: mid
    }));
    await sb.from('tasks').insert(taskRows);
    const newTasks = taskRows.map(r => ({
      id: r.id, owner: r.owner, content: r.content, due: r.due_date,
      priority: r.priority, done: false, source: 'minutes', minuteId: mid, clientId: cid
    }));
    tasks = [...newTasks, ...tasks.filter(t => t.minuteId !== mid)];
  }
  hideMinutesForm();
  renderMinutes();
  updateTaskBadge();
  setStatus('議事録を保存しました', 'ok');
}

function renderMinutes() {
  renderMinutesCalendar();
  const el = document.getElementById('minutesList');
  if (!minutes.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;"><img src="assets/character-small.png" style="width:70px;opacity:.8;"><div style="font-size:12px;color:#aaa;margin-top:8px;">議事録がまだありません。右上の「＋ 新規議事録」から追加してください。</div></div>';
    return;
  }
  el.innerHTML = minutes.map(m => {
    const mTasks = tasks.filter(t => t.minuteId === m.id);
    const mId = 'minute_' + m.id;
    const pendingCount = mTasks.filter(t => !t.done).length;
    return `<div id="${mId}" style="border:1px solid #e8e8e6;border-radius:10px;margin-bottom:10px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.875rem 1rem;background:#fafafa;border-bottom:1px solid #f0f0ee;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:12px;color:#aaa;">${m.date}</div>
          <div style="font-size:13px;font-weight:600;">${m.title||'MTG議事録'}</div>
          ${m.url ? `<a href="${m.url}" target="_blank" style="font-size:11px;color:#378ADD;">議事録を開く →</a>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${pendingCount > 0 ? `<span class="badge br">未完了タスク ${pendingCount}件</span>` : '<span class="badge bg">全完了</span>'}
          <button class="btn-sm" onclick="editMinute('${m.id}')">編集</button>
          <button class="btn-del" onclick="deleteMinute('${m.id}')">削除</button>
        </div>
      </div>
      ${mTasks.length ? `<div style="padding:.75rem 1rem;">
        ${mTasks.map(t => renderTaskRow(t, true)).join('')}
      </div>` : '<div style="padding:.75rem 1rem;font-size:11px;color:#aaa;">タスクなし</div>'}
    </div>`;
  }).join('');
}

function editMinute(id) {
  const m = minutes.find(x => x.id === id); if (!m) return;
  editingMinuteId = id;
  document.getElementById('mDate').value = m.date;
  document.getElementById('mUrl').value = m.url || '';
  document.getElementById('mTitle').value = m.title || '';
  tempMinuteTasks = [...(m.tasks || [])];
  renderTempTaskList();
  document.getElementById('minutesForm').style.display = 'block';
  document.getElementById('minutesForm').scrollIntoView({behavior:'smooth',block:'start'});
}

async function deleteMinute(id) {
  if (!confirm('この議事録を削除しますか？（関連タスクも削除されます）')) return;
  let tDelQuery = sb.from('tasks').delete().eq('minute_id', id);
  if (!isAdmin) tDelQuery = tDelQuery.eq('client_id', currentClientId);
  await tDelQuery;
  let mDelQuery = sb.from('minutes').delete().eq('id', id);
  if (!isAdmin) mDelQuery = mDelQuery.eq('client_id', currentClientId);
  await mDelQuery;
  minutes = minutes.filter(m => m.id !== id);
  tasks = tasks.filter(t => t.minuteId !== id);
  renderMinutes();
  setStatus('議事録を削除しました', 'ok');
}

// タスク
function showManualTaskForm() {
  document.getElementById('manualTaskForm').style.display = 'block';
  document.getElementById('mtStart').value = new Date().toISOString().split('T')[0];
}
function hideManualTaskForm() {
  document.getElementById('manualTaskForm').style.display = 'none';
  const saveBtn = document.querySelector('#manualTaskForm .btn-p');
  if (saveBtn) { saveBtn.textContent = '追加'; saveBtn.onclick = saveManualTask; }
}

async function saveManualTask() {
  const taskContent = document.getElementById('mtContent').value.trim();
  const due = document.getElementById('mtDue').value;
  if (!taskContent) { alert('タスク内容を入力してください'); return; }
  const tid = Date.now()+'';
  const row = {
    id: tid, client_id: currentClientId,
    owner: document.getElementById('mtOwner').value,
    content: taskContent,
    start_date: document.getElementById('mtStart').value || null,
    due_date: due || null,
    priority: document.getElementById('mtPriority').value,
    done: false, source: 'manual', minute_id: null
  };
  let saveOk = false;
  try {
    const { error } = await sb.from('tasks').insert(row);
    if (error) {
      console.warn('Supabase task insert error:', error.message);
      // テーブルが存在しない場合はlocalStorageにフォールバック
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        const stored = JSON.parse(localStorage.getItem('saiyo_tasks_fallback_' + currentClientId) || '[]');
        stored.unshift({...row, hireStatus:'', dept:''});
        localStorage.setItem('saiyo_tasks_fallback_' + currentClientId, JSON.stringify(stored));
        saveOk = true;
      } else {
        alert('タスク保存エラー: ' + error.message + '\n\nSupabaseのSQLエディタで add_minutes_tasks_tables.sql を実行してください。');
        return;
      }
    } else { saveOk = true; }
  } catch(e) { console.warn('Task save error:', e); saveOk = true; }
  tasks.unshift({ id: tid, owner: row.owner, content: taskContent, startDate: row.start_date, due, priority: row.priority, done: false, doneDate: '', source: 'manual', minuteId: null, clientId: currentClientId });
  hideManualTaskForm();
  document.getElementById('mtContent').value = '';
  document.getElementById('mtDue').value = '';
  renderTasks();
  updateTaskBadge();
  setStatus('タスクを追加しました', 'ok');
}

function renderTaskRow(task, compact=false) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.due && task.due < today && !task.done;
  const isDueSoon = task.due && task.due >= today && task.due <= new Date(Date.now()+3*86400000).toISOString().split('T')[0] && !task.done;
  const rowBg = task.done ? 'background:#f8fdf8;' : isOverdue ? 'background:#fff5f5;border-left:3px solid #D85A30;' : isDueSoon ? 'background:#fffbf0;border-left:3px solid #EF9F27;' : 'background:#fff;';
  return `<div style="${rowBg}padding:8px 10px;border-radius:6px;margin-bottom:5px;border:1px solid #f0f0ee;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <span style="flex-shrink:0;">${renderOwnerBadge(task.owner, task.clientId)}</span>
    <span style="flex:1;font-size:12px;${task.done?'text-decoration:line-through;color:#aaa;':''}">${task.content}</span>
    ${task.due ? `<span style="font-size:11px;color:${isOverdue?'#D85A30':isDueSoon?'#854F0B':'#aaa'};">期限: ${task.due}</span>` : ''}
    <span class="badge ${task.priority==='高'?'br':task.priority==='低'?'bg':'bgr'}" style="flex-shrink:0;">${task.priority||'中'}</span>
    ${task.done
      ? `<span class="badge bt" style="flex-shrink:0;">✓ 完了 ${task.doneDate||''}</span>`
      : `<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          <button class="btn-sm" style="background:#f0faf6;color:#3B6D11;border-color:#c8e6c9;" onclick="showCompleteInput('${task.id}')">完了</button>
          <div id="complete_${task.id}" style="display:none;align-items:center;gap:4px;">
            <input type="date" id="cdate_${task.id}" value="${new Date().toISOString().split('T')[0]}" style="padding:3px 6px;border:1px solid #ddd;border-radius:6px;font-size:11px;font-family:inherit;">
            <button class="btn-sm" style="background:#f0faf6;color:#3B6D11;border-color:#c8e6c9;" onclick="confirmComplete('${task.id}', document.getElementById('cdate_${task.id}').value)">確定</button>
          </div>
        </div>`}
    <button class="btn-sm" style="flex-shrink:0;font-size:10px;" onclick="editTask('${task.id}')">編集</button>
    ${!compact ? `<button class="btn-del" style="flex-shrink:0;" onclick="deleteTask('${task.id}')">削除</button>` : ''}
  </div>`;
}

function renderTasks() {
  const filter = document.getElementById('taskFilter')?.value || 'all';
  const today = new Date().toISOString().split('T')[0];
  // admin時は全件、client時は自社のみ
  let filtered = isAdmin ? [...tasks] : tasks.filter(t => t.clientId === currentClientId || !t.clientId);
  if (filter === 'pending') filtered = filtered.filter(t => !t.done);
  else if (filter === 'done') filtered = filtered.filter(t => t.done);
  else if (filter && filter.startsWith('owner:')) {
    const ownerName = filter.substring(6);
    filtered = filtered.filter(t => t.owner === ownerName);
  }

  // ソート：未完了→期限近い順、完了→完了日降順
  filtered.sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.done) return (a.due||'9999') > (b.due||'9999') ? 1 : -1;
    return (b.doneDate||'') > (a.doneDate||'') ? 1 : -1;
  });

  const pending = filtered.filter(t => !t.done);
  const done = filtered.filter(t => t.done);
  const overdue = pending.filter(t => t.due && t.due < today);
  const dueSoon = pending.filter(t => t.due && t.due >= today && t.due <= new Date(Date.now()+3*86400000).toISOString().split('T')[0]);

  const el = document.getElementById('taskList');
  if (!filtered.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;"><img src="assets/character-small.png" style="width:70px;opacity:.8;"><div style="font-size:12px;color:#aaa;margin-top:8px;">タスクはありません 🎉</div></div>';
    return;
  }

  let html = '';
  if (overdue.length) html += `<div style="margin-bottom:1rem;"><div style="font-size:11px;font-weight:600;color:#D85A30;margin-bottom:6px;">⚠ 期限超過（${overdue.length}件）</div>${overdue.map(t=>renderTaskRow(t)).join('')}</div>`;
  if (dueSoon.length) html += `<div style="margin-bottom:1rem;"><div style="font-size:11px;font-weight:600;color:#854F0B;margin-bottom:6px;">⏰ 期限間近（${dueSoon.length}件）</div>${dueSoon.map(t=>renderTaskRow(t)).join('')}</div>`;
  const normal = pending.filter(t => !overdue.includes(t) && !dueSoon.includes(t));
  if (normal.length) html += `<div style="margin-bottom:1rem;"><div style="font-size:11px;font-weight:600;color:#666;margin-bottom:6px;">未完了（${normal.length}件）</div>${normal.map(t=>renderTaskRow(t)).join('')}</div>`;
  if (done.length) html += `<div><div style="font-size:11px;font-weight:600;color:#3B6D11;margin-bottom:6px;">✓ 完了（${done.length}件）</div>${done.map(t=>renderTaskRow(t)).join('')}</div>`;
  el.innerHTML = html;
}

async function completeTask(id) {
  const today = new Date().toISOString().split('T')[0];
  // インラインで完了日入力UIを表示
  const el = document.getElementById('complete_'+id);
  if (el) { el.style.display = el.style.display === 'none' ? 'flex' : 'none'; return; }
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.done = true; t.doneDate = today;
  await saveTasksData();
  renderTasks();
  if (document.getElementById('sec-minutes').classList.contains('active')) renderMinutes();
}

function showCompleteInput(id) {
  const el = document.getElementById('complete_'+id);
  if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

async function confirmComplete(id, dateVal) {
  const doneDate = dateVal || new Date().toISOString().split('T')[0];
  let query = sb.from('tasks').update({ done: true, done_date: doneDate }).eq('id', id);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  await query;
  const t = tasks.find(x => x.id === id);
  if (t) { t.done = true; t.doneDate = doneDate; }
  await saveTasksData();
  renderTasks();
  if (document.getElementById('sec-minutes') && document.getElementById('sec-minutes').classList.contains('active')) renderMinutes();
  setStatus('タスクを完了しました', 'ok');
}

async function deleteTask(id) {
  if (!confirm('このタスクを削除しますか？')) return;
  let query = sb.from('tasks').delete().eq('id', id);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  await query;
  tasks = tasks.filter(t => t.id !== id);
  await saveTasksData();
  renderTasks();
}

// ========================================
// 一括操作
// ========================================
function getCheckedIds() {
  return Array.from(document.querySelectorAll('.rowCheck:checked')).map(c => c.value);
}

function onCheckChange() {
  const ids = getCheckedIds();
  const bar = document.getElementById('bulkBar');
  const count = document.getElementById('bulkCount');
  if (ids.length > 0) {
    bar.style.display = 'flex';
    count.textContent = ids.length + '件選択中';
    // プルダウン更新
    const bSt = document.getElementById('bulkStatus');
    const bHire = document.getElementById('bulkHire');
    bSt.innerHTML = '<option value="">選択</option>';
    (masters.status||[]).forEach(v => bSt.innerHTML += `<option>${v}</option>`);
    bHire.innerHTML = '<option value="">選択</option>';
    (masters.hire||['内定','内定承諾','採用','不採用','保留']).forEach(v => bHire.innerHTML += `<option>${v}</option>`);
  } else {
    bar.style.display = 'none';
  }
  // 全選択チェックボックスの状態更新
  const total = document.querySelectorAll('.rowCheck').length;
  const ca = document.getElementById('checkAll');
  if (ca) ca.checked = ids.length === total && total > 0;
}

function toggleCheckAll(cb) {
  document.querySelectorAll('.rowCheck').forEach(c => c.checked = cb.checked);
  onCheckChange();
}

function clearChecks() {
  document.querySelectorAll('.rowCheck').forEach(c => c.checked = false);
  const ca = document.getElementById('checkAll');
  if (ca) ca.checked = false;
  document.getElementById('bulkBar').style.display = 'none';
}

async function bulkUpdateStatus() {
  const val = document.getElementById('bulkStatus').value;
  if (!val) { alert('ステータスを選択してください'); return; }
  const ids = getCheckedIds();
  if (!ids.length) return;
  if (!confirm(`${ids.length}件のステータスを「${val}」に変更しますか？`)) return;
  let query = sb.from('applicants').update({ status: val }).in('id', ids);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  const { error } = await query;
  if (error) { alert('更新に失敗しました: ' + error.message); return; }
  ids.forEach(id => { const a = applicants.find(x => x.id === id); if (a) a.status = val; });
  clearChecks();
  renderList();
  setStatus(`${ids.length}件のステータスを更新しました`, 'ok');
}

async function bulkUpdateHire() {
  const val = document.getElementById('bulkHire').value;
  if (!val) { alert('採用可否を選択してください'); return; }
  const ids = getCheckedIds();
  if (!ids.length) return;
  if (!confirm(`${ids.length}件の採用可否を「${val}」に変更しますか？`)) return;
  let query = sb.from('applicants').update({ hire_status: val }).in('id', ids);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  const { error } = await query;
  if (error) { alert('更新に失敗しました: ' + error.message); return; }
  ids.forEach(id => { const a = applicants.find(x => x.id === id); if (a) a.hireStatus = val; });
  clearChecks();
  renderList();
  setStatus(`${ids.length}件の採用可否を更新しました`, 'ok');
}

async function bulkDelete() {
  const ids = getCheckedIds();
  if (!ids.length) return;
  if (!confirm(`選択した${ids.length}件を削除しますか？\nこの操作は取り消せません。`)) return;
  let query = sb.from('applicants').delete().in('id', ids);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  const { error } = await query;
  if (error) { alert('削除に失敗しました: ' + error.message); return; }
  applicants = applicants.filter(a => !ids.includes(a.id));
  clearChecks();
  popSelects();
  renderList();
  setStatus(`${ids.length}件を削除しました`, 'ok');
}

function editTask(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  showManualTaskForm();
  document.getElementById('mtOwner').value = t.owner || 'LinkCore';
  document.getElementById('mtContent').value = t.content || '';
  document.getElementById('mtStart').value = t.startDate || '';
  document.getElementById('mtDue').value = t.due || '';
  document.getElementById('mtPriority').value = t.priority || '中';
  // 保存ボタンを「更新」モードに
  const saveBtn = document.querySelector('#manualTaskForm .btn-p');
  if (saveBtn) {
    saveBtn.textContent = '更新する';
    saveBtn.onclick = () => updateTask(id);
  }
  document.getElementById('manualTaskForm').scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function updateTask(id) {
  const taskContent = document.getElementById('mtContent').value.trim();
  const due = document.getElementById('mtDue').value;
  if (!taskContent) { alert('タスク内容を入力してください'); return; }
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.owner = document.getElementById('mtOwner').value;
  t.content = taskContent;
  t.startDate = document.getElementById('mtStart').value;
  t.due = due;
  t.priority = document.getElementById('mtPriority').value;
  try {
    let query = sb.from('tasks').update({ owner: t.owner, content: taskContent, start_date: t.startDate||null, due_date: due||null, priority: t.priority }).eq('id', id);
    if (!isAdmin) query = query.eq('client_id', currentClientId);
    await query;
  } catch(e) {
    // fallback: update localStorage
    const stored = JSON.parse(localStorage.getItem('saiyo_tasks_fallback_' + currentClientId) || '[]');
    const fi = stored.findIndex(x => x.id === id);
    if (fi >= 0) { stored[fi] = {...stored[fi], owner:t.owner, content:taskContent, due_date:due||null, priority:t.priority}; localStorage.setItem('saiyo_tasks_fallback_' + currentClientId, JSON.stringify(stored)); }
  }
  await saveTasksData();
  hideManualTaskForm();
  // ボタンを「追加」モードに戻す
  const saveBtn = document.querySelector('#manualTaskForm .btn-p');
  if (saveBtn) { saveBtn.textContent = '追加'; saveBtn.onclick = saveManualTask; }
  renderTasks();
  setStatus('タスクを更新しました', 'ok');
}


// ========================================
// カレンダー機能（議事録・タスク）
// ========================================
function renderMinutesCalendar() {
  const el = document.getElementById('minutesCalendar');
  if (!el) return;
  const monthInput = document.getElementById('calMonth');
  const now = new Date();
  const ym = monthInput && monthInput.value ? monthInput.value : now.toISOString().slice(0,7);

  const markedDates = {};
  minutes.forEach(min => {
    if (!min.date) return;
    if (!markedDates[min.date]) markedDates[min.date] = [];
    markedDates[min.date].push({ type: 'minute' });
  });
  tasks.forEach(t => {
    if (!t.due) return;
    if (!markedDates[t.due]) markedDates[t.due] = [];
    markedDates[t.due].push({ type: 'task', done: t.done });
  });

  renderStyledCalendar('minutesCalendar', ym, markedDates, 'clickCalDay', { type: 'minutes' });
}

// タスク管理画面のカレンダー
function renderTaskCalendar() {
  const el = document.getElementById('taskCalendar');
  if (!el) return;
  const monthInput = document.getElementById('taskCalMonth');
  const now = new Date();
  const ym = monthInput && monthInput.value ? monthInput.value : now.toISOString().slice(0,7);

  const markedDates = {};
  // 自分のクライアントのタスクのみマーク（管理者はすべて）
  const visibleTasks = tasks.filter(t => isAdmin || t.clientId === currentClientId || !t.clientId);
  visibleTasks.forEach(t => {
    if (!t.due) return;
    if (!markedDates[t.due]) markedDates[t.due] = [];
    markedDates[t.due].push({ type: 'task', done: t.done });
  });

  renderStyledCalendar('taskCalendar', ym, markedDates, 'clickTaskCalDay', { type: 'tasks' });
}

// タスクカレンダーの日付クリック → 手動タスク追加フォームを開いて期限日を埋める
function clickTaskCalDay(dateStr) {
  showManualTaskForm();
  const dueEl = document.getElementById('mtDue');
  if (dueEl) dueEl.value = dateStr;
  const startEl = document.getElementById('mtStart');
  if (startEl && !startEl.value) startEl.value = new Date().toISOString().split('T')[0];
  const existing = tasks.filter(t => t.due === dateStr && (isAdmin || t.clientId === currentClientId));
  if (existing.length > 0) {
    setStatus(`${dateStr} は既に${existing.length}件のタスクがあります。新規追加もできます`, 'ok');
  }
}

function changeCalMonth(delta) {
  const input = document.getElementById('calMonth');
  if (!input) return;
  const [y, m] = (input.value || new Date().toISOString().slice(0,7)).split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  input.value = d.toISOString().slice(0,7);
  renderMinutesCalendar();
  renderMinutes();
}

// カレンダーの日付クリック → 新規議事録作成画面を開く（要件⑥）
// 既に議事録がある日でも新規作成可能にする
function clickCalDay(dateStr) {
  showMinutesForm();
  const dEl = document.getElementById('mDate');
  if (dEl) dEl.value = dateStr;
  // 既存議事録がある場合はその情報を表示するため、議事録一覧側にもスクロールできるようヒントを残す
  const existing = minutes.filter(m => m.date === dateStr);
  if (existing.length > 0) {
    setStatus(`${dateStr} は既に${existing.length}件の議事録があります。新規作成も可能です`, 'ok');
  }
}

// 後方互換（旧呼び出しが残っていた場合のため）
function calDayClick(dateStr) {
  clickCalDay(dateStr);
}

function showMinutesFormForDate() {
  showMinutesForm();
  const calInput = document.getElementById('calMonth');
  if (calInput && calInput.value) {
    document.getElementById('mDate').value = calInput.value + '-01';
  }
}


function shiftMonth(inputId, renderFn, delta) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const val = el.value || new Date().toISOString().slice(0,7);
  const [y, m] = val.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  el.value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  // 対応するrender関数を呼ぶ
  if (renderFn === 'renderMinutesCalendar') renderMinutesCalendar();
  else if (renderFn === 'renderTaskCalendar') renderTaskCalendar();
  else if (renderFn === 'renderMinutes') renderMinutes();
}

function renderStyledCalendar(containerId, ym, markedDates, onDayClick, opts) {
  var el = document.getElementById(containerId);
  if (!el || !ym) { if(el) el.innerHTML=''; return; }
  var p = ym.split('-'); var y = parseInt(p[0]); var m = parseInt(p[1]);
  var fd = new Date(y, m-1, 1).getDay();
  var dim = new Date(y, m, 0).getDate();
  var today = new Date().toISOString().split('T')[0];
  var ens=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var bgs=['linear-gradient(160deg,#e8f4f8,#d6e8f0)','linear-gradient(160deg,#fde8f0,#f5d0e0)','linear-gradient(160deg,#fde8f5,#f9d0e8)','linear-gradient(160deg,#f5f0ea,#ede8e0)','linear-gradient(160deg,#e8f5e9,#c8e6c9)','linear-gradient(160deg,#e3f2fd,#bbdefb)','linear-gradient(160deg,#fff9e6,#fff3cd)','linear-gradient(160deg,#ffeaa7,#fdcb6e)','linear-gradient(160deg,#fdf2e9,#f5d7b5)','linear-gradient(160deg,#fde8d8,#f5cba7)','linear-gradient(160deg,#eaf0f6,#d5e8f8)','linear-gradient(160deg,#eaf4fb,#d6eaf8)'];
  var acs=['#2471a3','#c0392b','#d35db0','#6b4f3a','#2e7d32','#1565c0','#e67e22','#d35400','#ca6f1e','#a04000','#1a5276','#1a5276'];
  var nums=['#1a5276','#922b21','#a83278','#4a3020','#1b5e20','#0d47a1','#ca6f1e','#a04000','#935116','#784212','#154360','#154360'];
  var bg=bgs[m-1], ac=acs[m-1], num=nums[m-1];
  var type=(opts&&opts.type)||'tasks';
  var logoSrc=(document.querySelector('.header img')||{src:''}).src;
  var charSrc=(document.getElementById('dashChar')||{src:''}).src;
  var html='<div style="display:flex;background:'+bg+';border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);border:1px solid rgba(0,0,0,.06);">';
  html+='<div style="width:130px;flex-shrink:0;padding:1.25rem 1rem;display:flex;flex-direction:column;align-items:center;justify-content:space-between;border-right:1px solid rgba(0,0,0,.06);">';
  html+='<div style="text-align:center;"><div style="font-family:Georgia,serif;font-size:12px;color:'+ac+';letter-spacing:.1em;margin-bottom:6px;font-style:italic;">'+ens[m-1]+'</div>';
  html+='<div style="font-size:56px;font-weight:900;color:'+num+';line-height:1;margin-bottom:6px;">'+m+'</div>';
  html+='<div style="font-size:11px;color:rgba(0,0,0,.3);letter-spacing:.06em;">'+y+'</div></div>';
  if(logoSrc||charSrc){html+='<div style="text-align:center;margin-top:1rem;opacity:.85;">';
    if(logoSrc)html+='<img src="'+logoSrc+'" style="width:36px;height:36px;object-fit:contain;display:block;margin:0 auto 8px;">';
    if(charSrc)html+='<img src="'+charSrc+'" style="width:60px;height:60px;object-fit:contain;display:block;margin:0 auto;">';
    html+='</div>';}
  html+='</div><div style="flex:1;padding:.875rem .75rem;overflow-x:auto;">';
  html+='<table style="width:100%;border-collapse:collapse;min-width:320px;"><thead><tr>';
  var dl=['日','月','火','水','木','金','土'];
  for(var di=0;di<7;di++){var dc=di===0?'#c0392b':di===6?'#2471a3':'#4a4040';html+='<th style="padding:6px 2px;font-size:11px;font-weight:700;color:'+dc+';text-align:center;border-bottom:2px solid rgba(0,0,0,.08);">'+dl[di]+'</th>';}
  html+='</tr></thead><tbody>';
  var day=1, wc=Math.ceil((fd+dim)/7);
  for(var row=0;row<wc;row++){html+='<tr>';
    for(var col=0;col<7;col++){var cn=row*7+col;
      if(cn<fd||day>dim){html+='<td style="padding:3px;height:52px;border:1px solid rgba(0,0,0,.05);background:rgba(255,255,255,.3);"></td>';}
      else{
        var ds=y+'-'+(m<10?'0':'')+m+'-'+(day<10?'0':'')+day;
        var isT=(ds===today),isSun=(col===0),isSat=(col===6);
        var marks=markedDates[ds]||[];
        var nbg=isT?num:'transparent', nfg=isT?'#fff':(isSun?'#c0392b':isSat?'#2471a3':'#4a4040');
        var cbg=isT?'rgba(255,255,255,.9)':'rgba(255,255,255,.5)';
        var dots='';
        if(marks.length){var colors=marks.slice(0,4).map(function(mk){return type==='minutes'?(mk.type==='minute'?'#6ab49a':'#D85A30'):(mk.done?'#aaa':mk.overdue?'#D85A30':'#6ab49a');});dots='<div style="display:flex;gap:2px;justify-content:center;flex-wrap:wrap;margin-top:2px;">'+colors.map(function(c){return'<div style="width:5px;height:5px;border-radius:50%;background:'+c+'"></div>';}).join('')+'</div>';}
        html+='<td style="padding:3px;height:52px;border:1px solid rgba(0,0,0,.05);background:'+cbg+';vertical-align:top;cursor:'+(onDayClick?'pointer':'default')+';" onclick="'+(onDayClick?onDayClick+"('"+ds+"')":'')+'"><div style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:'+nbg+';font-size:11px;font-weight:'+(isT?700:500)+';color:'+nfg+';">'+day+'</div>'+dots+'</td>';
        day++;
      }
    }html+='</tr>';
  }
  html+='</tbody></table></div></div>';
  el.innerHTML=html;
}


// ========================================
// 予算管理
// ========================================
let budgetData = [];
let budgetChart = null;
let budgetInputRowCount = 0;
const BUDGET_KEY = () => 'saiyo_budget_' + currentClientId + '_v1';

async function loadBudgetData() {
  try {
    let query = sb.from('budgets').select('*').order('month', { ascending: false });
    if (!isAdmin) query = query.eq('client_id', currentClientId);
    const { data, error } = await query;
    if (error) {
      const raw = localStorage.getItem(BUDGET_KEY());
      budgetData = raw ? JSON.parse(raw) : [];
    } else {
      budgetData = (data || []).map(r => ({
        id: r.id, month: r.month, media: r.media,
        type: r.type || 'media', dept: r.dept || '',
        job: r.job || '', amount: r.amount, clientId: r.client_id
      }));
    }
  } catch(e) { budgetData = []; }
}

async function saveBudgetData() {
  try { localStorage.setItem(BUDGET_KEY(), JSON.stringify(budgetData)); } catch(e) {}
}

async function deleteBudget(id) {
  if (!confirm('削除しますか？')) return;
  try {
    await sb.from('budgets').delete().eq('id', id).eq('client_id', currentClientId);
  } catch(e) {}
  budgetData = budgetData.filter(d => d.id !== id);
  renderBudget();
}

function showBudgetForm() {
  const form = document.getElementById('budgetForm');
  if (!form) return;
  form.style.display = 'block';
  document.getElementById('budgetInputRows').innerHTML = '';
  addBudgetRow();
}

function hideBudgetForm() {
  const f = document.getElementById('budgetForm');
  if (f) f.style.display = 'none';
}

function addBudgetRow() {
  const rid = 'brow_' + Date.now();
  const mOpts = [...(masters.media||[]),...(masters.agency||[])].map(v=>'<option>'+v+'</option>').join('');
  const dOpts = (masters.dept||[]).map(v=>'<option>'+v+'</option>').join('');
  const jOpts = [...new Set(applicants.map(a=>a.jobType).filter(Boolean))].map(v=>'<option>'+v+'</option>').join('');
  const dm = new Date().toISOString().slice(0,7);
  document.getElementById('budgetInputRows').insertAdjacentHTML('beforeend',
    '<tr id="'+rid+'" style="border-bottom:1px solid #f0f0ee;">' +
    '<td style="padding:5px;"><input type="month" class="bMonth" value="'+dm+'" style="padding:5px;border:1px solid #ddd;border-radius:6px;font-size:11px;font-family:inherit;"></td>' +
    '<td style="padding:5px;"><select class="bMedia" style="padding:5px;border:1px solid #ddd;border-radius:6px;font-size:11px;min-width:110px;"><option value="">選択</option>'+mOpts+'</select></td>' +
    '<td style="padding:5px;"><select class="bType" style="padding:5px;border:1px solid #ddd;border-radius:6px;font-size:11px;"><option value="media">求人媒体</option><option value="agency">人材紹介</option></select></td>' +
    '<td style="padding:5px;"><select class="bDept" style="padding:5px;border:1px solid #ddd;border-radius:6px;font-size:11px;min-width:70px;"><option value="">全て</option>'+dOpts+'</select></td>' +
    '<td style="padding:5px;"><select class="bJob" style="padding:5px;border:1px solid #ddd;border-radius:6px;font-size:11px;min-width:70px;"><option value="">全て</option>'+jOpts+'</select></td>' +
    '<td style="padding:5px;"><input type="number" class="bAmount" placeholder="0" min="0" style="padding:5px;border:1px solid #ddd;border-radius:6px;font-size:11px;text-align:right;width:100px;"></td>' +
    '<td style="padding:5px;"><button class="btn-del" onclick="this.closest(\'tr\').remove()">✕</button></td></tr>');
}

async function saveAllBudgets() {
  const rows = document.getElementById('budgetInputRows').querySelectorAll('tr');
  const toSave = []; let hasError = false;
  rows.forEach(row => {
    const month = row.querySelector('.bMonth')?.value || '';
    const media = row.querySelector('.bMedia')?.value || '';
    const type  = row.querySelector('.bType')?.value  || 'media';
    const dept  = row.querySelector('.bDept')?.value  || '';
    const job   = row.querySelector('.bJob')?.value   || '';
    const amount= parseInt(row.querySelector('.bAmount')?.value || '0') || 0;
    if (!month || !media) { hasError = true; return; }
    if (!amount) return;
    toSave.push({ id: Date.now()+Math.random()+'', month, media, type, dept, job, amount });
  });
  if (hasError) { alert('月と媒体は必須です'); return; }
  if (!toSave.length) { alert('登録するデータがありません'); return; }
  const bRows = toSave.map(e => ({
    id: e.id, client_id: currentClientId,
    month: e.month, media: e.media, type: e.type,
    dept: e.dept || null, job: e.job || null, amount: e.amount
  }));
  const { error } = await sb.from('budgets').upsert(bRows, { onConflict: 'id' });
  if (!error) {
    toSave.forEach(e => {
      const i = budgetData.findIndex(d => d.month===e.month && d.media===e.media && d.dept===e.dept && d.job===e.job);
      if (i >= 0) budgetData[i] = {...budgetData[i], ...e};
      else budgetData.push(e);
    });
  }
  hideBudgetForm();
  renderBudget();
  setStatus(toSave.length + '件登録しました', 'ok');
}

function setBudgetMode(mode) {
  const s=document.getElementById('budgetSingleMode'), r=document.getElementById('budgetRangeMode');
  const bS=document.getElementById('budgetModeSingle'), bR=document.getElementById('budgetModeRange');
  if (!s||!r) return;
  if (mode==='single') {
    s.style.display='flex'; r.style.display='none';
    if(bS){bS.style.background='#1a1a1a';bS.style.color='#fff';}
    if(bR){bR.style.background='#fafafa';bR.style.color='#666';}
    syncBudgetPeriod();
  } else {
    s.style.display='none'; r.style.display='flex';
    if(bR){bR.style.background='#1a1a1a';bR.style.color='#fff';}
    if(bS){bS.style.background='#fafafa';bS.style.color='#666';}
    renderBudget();
  }
}

function syncBudgetPeriod() {
  const v = document.getElementById('budgetSingle')?.value;
  if (!v) return;
  const f=document.getElementById('budgetFrom'), t=document.getElementById('budgetTo');
  if(f) f.value=v; if(t) t.value=v;
  renderBudget();
}

function renderBudget() {
  const now=new Date(), curYM=now.toISOString().slice(0,7);
  const fromEl=document.getElementById('budgetFrom'), toEl=document.getElementById('budgetTo');
  const sEl=document.getElementById('budgetSingle');
  if(sEl&&!sEl.value) sEl.value=curYM;
  const singleMode = document.getElementById('budgetSingleMode')?.style.display !== 'none';
  if(sEl&&sEl.value&&singleMode) { if(fromEl) fromEl.value=sEl.value; if(toEl) toEl.value=sEl.value; }
  else {
    if(fromEl&&!fromEl.value){const d=new Date(now);d.setMonth(d.getMonth()-5);fromEl.value=d.toISOString().slice(0,7);}
    if(toEl&&!toEl.value) toEl.value=curYM;
  }
  const selFrom=fromEl?.value||'', selTo=toEl?.value||'';
  const selDept=document.getElementById('budgetDeptFilter')?.value||'';
  const selJob =document.getElementById('budgetJobFilter')?.value||'';

  // フィルター選択肢を更新
  ['budgetDeptFilter','simDept'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const c=el.value; el.innerHTML='<option value="">'+(id==='simDept'?'全部署':'部署（全て）')+'</option>';
    (masters.dept||[]).forEach(v=>el.innerHTML+='<option '+(c===v?'selected':'')+'>'+v+'</option>');
  });
  ['budgetJobFilter','simJob'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const c=el.value; el.innerHTML='<option value="">'+(id==='simJob'?'全職種':'職種（全て）')+'</option>';
    [...new Set(applicants.map(a=>a.jobType).filter(Boolean))].forEach(v=>el.innerHTML+='<option '+(c===v?'selected':'')+'>'+v+'</option>');
  });

  const af = applicants.filter(a=>{
    const m=a.appDate?a.appDate.substring(0,7):'';
    if(selFrom&&m<selFrom) return false; if(selTo&&m>selTo) return false;
    if(selDept&&a.dept!==selDept) return false; if(selJob&&a.jobType!==selJob) return false;
    return true;
  });
  const bf = budgetData.filter(d=>{
    if(selFrom&&d.month<selFrom) return false; if(selTo&&d.month>selTo) return false;
    if(selDept&&d.dept&&d.dept!==selDept) return false; if(selJob&&d.job&&d.job!==selJob) return false;
    return true;
  });

  // 採用判定: コアステータスがhired/joined または hireStatusが採用系
  const isHired = a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return cid === 'hired' || cid === 'joined' || ['内定','内定承諾','採用'].includes(a.hireStatus);
  };
  const tA=af.length, tH=af.filter(isHired).length;
  const tB=bf.reduce((s,d)=>s+d.amount,0);
  const tCPA=tB&&tA?Math.round(tB/tA):0, tCPO=tB&&tH?Math.round(tB/tH):0;
  const hr=tA?Math.round(tH/tA*100):0;

  const kpi=document.getElementById('budgetKpi');
  if(kpi) kpi.innerHTML=[
    '<div class="mc" style="border-left:3px solid #378ADD;"><div class="mc-lbl">総広告費</div><div class="mc-val">'+tB.toLocaleString()+'円</div></div>',
    '<div class="mc" style="border-left:3px solid #85B7EB;"><div class="mc-lbl">応募数</div><div class="mc-val">'+tA+'</div></div>',
    '<div class="mc" style="border-left:3px solid #639922;"><div class="mc-lbl">採用数</div><div class="mc-val">'+tH+'</div></div>',
    '<div class="mc" style="border-left:3px solid #EF9F27;"><div class="mc-lbl">CPA（応募単価）</div><div class="mc-val">'+(tCPA?tCPA.toLocaleString()+'円':'-')+'</div></div>',
    '<div class="mc" style="border-left:3px solid #D85A30;"><div class="mc-lbl">CPO（採用単価）</div><div class="mc-val">'+(tCPO?tCPO.toLocaleString()+'円':'-')+'</div></div>',
    '<div class="mc" style="border-left:3px solid #1D9E75;"><div class="mc-lbl">採用率</div><div class="mc-val">'+hr+'%</div></div>'
  ].join('');

  // 月別テーブル
  const months={};
  af.forEach(a=>{if(!a.appDate)return;const m=a.appDate.substring(0,7);if(!months[m])months[m]={apps:0,hires:0,budget:0};months[m].apps++;if(isHired(a))months[m].hires++;});
  bf.forEach(d=>{if(!months[d.month])months[d.month]={apps:0,hires:0,budget:0};months[d.month].budget+=d.amount;});
  const sm=Object.keys(months).sort();
  const thL='padding:8px 10px;background:#f0f0ee;font-size:11px;font-weight:700;border-bottom:2px solid #e0e0de;text-align:left;';
  const thR=thL.replace('text-align:left','text-align:right');
  const tdL='padding:7px 10px;font-size:12px;border-bottom:1px solid #f5f5f5;';
  const tdR=tdL+'text-align:right;';
  const tfL='padding:8px 10px;font-size:12px;font-weight:700;background:#f8f8f7;border-top:2px solid #e0e0de;';
  const tfR=tfL+'text-align:right;';

  const mTbl=document.getElementById('budgetMonthTable');
  if(mTbl) {
    let rows='';
    sm.forEach(m=>{
      const d=months[m],cpa=d.budget&&d.apps?Math.round(d.budget/d.apps):0,cpo=d.budget&&d.hires?Math.round(d.budget/d.hires):0,r2=d.apps?Math.round(d.hires/d.apps*100):0;
      rows+='<tr><td style="'+tdL+'">'+m+'</td><td style="'+tdR+'">'+(d.budget?d.budget.toLocaleString()+'円':'未入力')+'</td><td style="'+tdR+'">'+d.apps+'</td><td style="'+tdR+'">'+d.hires+'</td><td style="'+tdR+';color:'+(r2>10?'#3B6D11':'#aaa')+';">'+r2+'%</td><td style="'+tdR+';color:'+(cpa?'#EF9F27':'#aaa')+';font-weight:600;">'+(cpa?cpa.toLocaleString()+'円':'-')+'</td><td style="'+tdR+';color:'+(cpo?'#D85A30':'#aaa')+';font-weight:600;">'+(cpo?cpo.toLocaleString()+'円':'-')+'</td></tr>';
    });
    mTbl.innerHTML='<thead><tr><th style="'+thL+'">月</th><th style="'+thR+'">広告費</th><th style="'+thR+'">応募</th><th style="'+thR+'">採用</th><th style="'+thR+'">採用率</th><th style="'+thR+'">CPA</th><th style="'+thR+'">CPO</th></tr></thead><tbody>'+rows+'</tbody>'+
      '<tfoot><tr><td style="'+tfL+'">合計</td><td style="'+tfR+'">'+(tB?tB.toLocaleString()+'円':'未入力')+'</td><td style="'+tfR+'">'+tA+'</td><td style="'+tfR+'">'+tH+'</td><td style="'+tfR+';color:'+(hr>10?'#3B6D11':'#aaa')+';">'+hr+'%</td><td style="'+tfR+';color:'+(tCPA?'#EF9F27':'#aaa')+'">'+(tCPA?tCPA.toLocaleString()+'円':'-')+'</td><td style="'+tfR+';color:'+(tCPO?'#D85A30':'#aaa')+'">'+(tCPO?tCPO.toLocaleString()+'円':'-')+'</td></tr></tfoot>';
  }

  // 媒体別テーブル
  const ms={};
  af.forEach(a=>{const m=a.media||'(未設定)';if(!ms[m])ms[m]={apps:0,hires:0,budget:0};ms[m].apps++;if(isHired(a))ms[m].hires++;});
  bf.forEach(d=>{if(!ms[d.media])ms[d.media]={apps:0,hires:0,budget:0};ms[d.media].budget+=d.amount;});
  const tbl=document.getElementById('budgetTable');
  if(tbl) {
    let rows2='';
    Object.entries(ms).sort((a,b)=>b[1].apps-a[1].apps).forEach(([m,s])=>{
      const cpa=s.budget&&s.apps?Math.round(s.budget/s.apps):0,cpo=s.budget&&s.hires?Math.round(s.budget/s.hires):0,r2=s.apps?Math.round(s.hires/s.apps*100):0;
      rows2+='<tr><td style="'+tdL+'">'+m+'</td><td style="'+tdR+'">'+(s.budget?s.budget.toLocaleString()+'円':'未入力')+'</td><td style="'+tdR+'">'+s.apps+'</td><td style="'+tdR+'">'+s.hires+'</td><td style="'+tdR+';color:'+(r2>10?'#3B6D11':'#aaa')+';">'+r2+'%</td><td style="'+tdR+';color:'+(cpa?'#EF9F27':'#aaa')+';font-weight:600;">'+(cpa?cpa.toLocaleString()+'円':'-')+'</td><td style="'+tdR+';color:'+(cpo?'#D85A30':'#aaa')+';font-weight:600;">'+(cpo?cpo.toLocaleString()+'円':'-')+'</td></tr>';
    });
    tbl.innerHTML='<thead><tr><th style="'+thL+'">媒体</th><th style="'+thR+'">広告費</th><th style="'+thR+'">応募数</th><th style="'+thR+'">採用数</th><th style="'+thR+'">採用率</th><th style="'+thR+'">CPA</th><th style="'+thR+'">CPO</th></tr></thead><tbody>'+rows2+'</tbody>';
  }

  renderBudgetTrend(months);

  const dlEl=document.getElementById('budgetDataList');
  if(dlEl) {
    const sd=[...budgetData].filter(d=>{if(selFrom&&d.month<selFrom)return false;if(selTo&&d.month>selTo)return false;return true;}).sort((a,b)=>b.month>a.month?1:-1);
    if (sd.length) {
      let dlRows = '';
      sd.forEach(function(d) {
        dlRows += '<tr><td style="'+tdL+'">'+d.month+'</td><td style="'+tdL+'">'+d.media+'</td>';
        dlRows += '<td style="'+tdL+'">'+(d.dept||'-')+'</td><td style="'+tdL+'">'+(d.job||'-')+'</td>';
        dlRows += '<td style="'+tdR+'">'+d.amount.toLocaleString()+'円</td>';
        dlRows += '<td style="'+tdL+'">'+(d.type==='agency'?'人材紹介':'求人媒体')+'</td>';
        dlRows += '<td style="'+tdR+'"><button class="btn-del" onclick="deleteBudget('+JSON.stringify(d.id)+')">削除</button></td></tr>';
      });
      dlEl.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
        '<th style="'+thL+'">月</th><th style="'+thL+'">媒体</th><th style="'+thL+'">部署</th>' +
        '<th style="'+thL+'">職種</th><th style="'+thR+'">金額</th><th style="'+thL+'">種別</th><th></th>' +
        '</tr></thead><tbody>' + dlRows + '</tbody></table>';
    } else {
      dlEl.innerHTML = '<div class="empty">予算データがありません</div>';
    }
  }
}

function renderBudgetTrend(months) {
  if(budgetChart){try{budgetChart.destroy();}catch(e){}budgetChart=null;}
  const el=document.getElementById('budgetTrendChart');
  if(!el) return;

  // 表示月一覧を決定
  let lbs = Object.keys(months||{}).sort();

  // 単月のみの場合は前後5ヶ月を含めて計6ヶ月の推移を表示する
  const selFrom = document.getElementById('budgetFrom')?.value || '';
  const selTo = document.getElementById('budgetTo')?.value || '';
  const isSingleMonth = (selFrom && selTo && selFrom === selTo) || lbs.length <= 1;
  const selDept = document.getElementById('budgetDeptFilter')?.value || '';
  const selJob = document.getElementById('budgetJobFilter')?.value || '';

  if (isSingleMonth) {
    const baseYM = selFrom || (lbs[0]) || new Date().toISOString().slice(0,7);
    const expandedMonths = {};
    const baseDate = new Date(baseYM + '-01');
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0,7);
      expandedMonths[ym] = { apps: 0, hires: 0, budget: 0 };
    }
    applicants.forEach(a => {
      if (!a.appDate) return;
      const m = a.appDate.substring(0,7);
      if (!(m in expandedMonths)) return;
      if (selDept && a.dept !== selDept) return;
      if (selJob && a.jobType !== selJob) return;
      expandedMonths[m].apps++;
      const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
      if (cid === 'hired' || cid === 'joined') expandedMonths[m].hires++;
    });
    budgetData.forEach(d => {
      if (!(d.month in expandedMonths)) return;
      if (selDept && d.dept && d.dept !== selDept) return;
      if (selJob && d.job && d.job !== selJob) return;
      expandedMonths[d.month].budget += d.amount;
    });
    months = expandedMonths;
    lbs = Object.keys(months).sort();
  }

  if(!lbs.length){el.parentElement.innerHTML='<div class="empty" style="padding:2rem;text-align:center;">データがありません</div>';return;}

  const budgetData_arr = lbs.map(m => +((months[m].budget||0)/10000).toFixed(1));
  const appsData_arr = lbs.map(m => months[m].apps || 0);
  const hiresData_arr = lbs.map(m => months[m].hires || 0);
  const cpaData_arr = lbs.map(m => {
    const b = months[m].budget || 0;
    const a = months[m].apps || 0;
    return (b && a) ? Math.round(b/a) : null;
  });

  const baseYMselected = (isSingleMonth && selFrom) ? selFrom : null;
  const barBg = lbs.map(m => baseYMselected && m === baseYMselected ? 'rgba(239,159,39,0.6)' : 'rgba(239,159,39,0.2)');
  const barBorder = lbs.map(m => baseYMselected && m === baseYMselected ? '#D85A30' : '#EF9F27');

  budgetChart = new Chart(el, {
    type:'bar',
    data:{
      labels: lbs,
      datasets:[
        {label:'広告費(万円)', data: budgetData_arr, backgroundColor: barBg, borderColor: barBorder, borderWidth: 1.5, yAxisID:'y2', order: 3},
        {label:'応募数', data: appsData_arr, type:'line', borderColor:'#378ADD', backgroundColor:'transparent', tension:0.3, pointRadius:4, pointBackgroundColor:'#378ADD', yAxisID:'y', order: 2},
        {label:'採用数', data: hiresData_arr, type:'line', borderColor:'#639922', backgroundColor:'transparent', tension:0.3, pointRadius:4, pointBackgroundColor:'#639922', yAxisID:'y', order: 1},
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:true, position:'top', labels:{font:{size:10}, boxWidth:12}},
        tooltip: {
          callbacks: {
            afterBody: function(items) {
              const idx = items[0].dataIndex;
              const cpa = cpaData_arr[idx];
              const apps = appsData_arr[idx];
              const hires = hiresData_arr[idx];
              const rate = apps ? Math.round(hires/apps*100) : 0;
              const lines = [];
              if (cpa) lines.push('CPA: ' + cpa.toLocaleString() + '円');
              if (apps) lines.push('採用率: ' + rate + '%');
              return lines;
            }
          }
        }
      },
      scales:{
        y:{beginAtZero:true, position:'left', title:{display:true, text:'人数', font:{size:10}}, ticks:{font:{size:10}, stepSize:1}},
        y2:{beginAtZero:true, position:'right', grid:{display:false}, title:{display:true, text:'広告費(万円)', font:{size:10}}, ticks:{font:{size:10}}},
        x:{grid:{display:false}, ticks:{font:{size:10}, maxRotation:45}}
      }
    }
  });

  if (isSingleMonth && baseYMselected) {
    const noteEl = el.parentElement.querySelector('.budget-trend-note');
    if (!noteEl) {
      const note = document.createElement('div');
      note.className = 'budget-trend-note';
      note.style.cssText = 'font-size:10px;color:#888;text-align:center;margin-top:6px;';
      note.textContent = '※ 単月選択中のため、前後6ヶ月の推移を表示しています(選択月: ' + baseYMselected + ' をハイライト)';
      el.parentElement.appendChild(note);
    } else {
      noteEl.textContent = '※ 単月選択中のため、前後6ヶ月の推移を表示しています(選択月: ' + baseYMselected + ' をハイライト)';
    }
  } else {
    const noteEl = el.parentElement.querySelector('.budget-trend-note');
    if (noteEl) noteEl.remove();
  }
}

function runSimulation() {
  const target=parseInt(document.getElementById('simHireTarget')?.value||'0')||0;
  const dept=document.getElementById('simDept')?.value||'';
  const job=document.getElementById('simJob')?.value||'';
  if(!target){alert('採用目標人数を入力してください');return;}
  let apps=applicants;
  if(dept) apps=apps.filter(a=>a.dept===dept);
  if(job)  apps=apps.filter(a=>a.jobType===job);
  let budgets=budgetData;
  if(dept) budgets=budgets.filter(d=>!d.dept||d.dept===dept);
  if(job)  budgets=budgets.filter(d=>!d.job||d.job===job);
  const tA=apps.length, tH=apps.filter(a=>['内定','内定承諾','採用'].includes(a.hireStatus)).length;
  const tB=budgets.reduce((s,d)=>s+d.amount,0);
  let fHR=tA?tH/tA:0, fCPA=tB&&tA?Math.round(tB/tA):0, fCPO=tB&&tH?Math.round(tB/tH):0;
  const fallback=tA<5;
  if(fallback){
    const aA=applicants.length,aH=applicants.filter(a=>['内定','内定承諾','採用'].includes(a.hireStatus)).length,aB=budgetData.reduce((s,d)=>s+d.amount,0);
    fHR=aA?aH/aA:0; fCPA=aB&&aA?Math.round(aB/aA):0; fCPO=aB&&aH?Math.round(aB/aH):0;
  }
  const rEl=document.getElementById('simResult');
  if(!fHR){if(rEl)rEl.innerHTML='<div style="background:#f8f8f7;border-radius:8px;padding:1rem;color:#aaa;font-size:12px;">データが不足しています。</div>';return;}
  const need=Math.ceil(target/fHR), nCPA=fCPA?Math.round(fCPA*need):null, nCPO=fCPO?Math.round(fCPO*target):null;
  if(rEl) rEl.innerHTML='<div style="background:#f0f6ff;border-radius:10px;padding:1.125rem;border-left:3px solid #378ADD;">'
    +(fallback?'<div style="font-size:11px;color:#EF9F27;margin-bottom:.5rem;">⚠ データが少ないため全体平均から算出</div>':'')
    +'<div style="font-size:12px;font-weight:700;color:#378ADD;margin-bottom:1rem;">シミュレーション結果（過去実績から算出）</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:1rem;">'
    +'<div style="background:#fff;border-radius:8px;padding:.875rem;text-align:center;"><div style="font-size:10px;color:#aaa;margin-bottom:4px;">採用率</div><div style="font-size:22px;font-weight:700;">'+Math.round(fHR*100)+'%</div></div>'
    +'<div style="background:#fff;border-radius:8px;padding:.875rem;text-align:center;"><div style="font-size:10px;color:#aaa;margin-bottom:4px;">必要応募数</div><div style="font-size:22px;font-weight:700;color:#378ADD;">'+need+'名</div></div>'
    +'<div style="background:#fff;border-radius:8px;padding:.875rem;text-align:center;"><div style="font-size:10px;color:#aaa;margin-bottom:4px;">採用目標</div><div style="font-size:22px;font-weight:700;color:#639922;">'+target+'名</div></div>'
    +(nCPA?'<div style="background:#fff;border-radius:8px;padding:.875rem;text-align:center;"><div style="font-size:10px;color:#aaa;margin-bottom:4px;">推定予算(CPA)</div><div style="font-size:20px;font-weight:700;color:#EF9F27;">'+nCPA.toLocaleString()+'円</div></div>':'')
    +(nCPO?'<div style="background:#fff;border-radius:8px;padding:.875rem;text-align:center;"><div style="font-size:10px;color:#aaa;margin-bottom:4px;">推定予算(CPO)</div><div style="font-size:20px;font-weight:700;color:#D85A30;">'+nCPO.toLocaleString()+'円</div></div>':'')
    +'</div><div style="font-size:11px;color:#888;padding-top:.75rem;border-top:1px solid #d8e8f8;">⚠ あくまで参考値です。実績データが増えるほど精度は上がります。</div></div>';
}


// ========================================
// クライアント管理UI（管理者専用）
// ========================================
async function loadClients() {
  if (!isAdmin) return;
  const { data, error } = await sb.from('clients').select('*').order('name');
  if (error) {
    console.error('クライアント取得エラー', error);
    setStatus('クライアント情報の取得に失敗しました: ' + error.message, 'err');
    clients = [];
    return;
  }
  clients = data || [];
}

async function renderAdmin() {
  if (!isAdmin) {
    const tbody = document.getElementById('clientTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:1rem;">管理者のみ閲覧できます</td></tr>';
    return;
  }
  await loadClients();
  const tbody = document.getElementById('clientTableBody');
  if (!tbody) return;

  if (!clients.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:1rem;">クライアントがまだ登録されていません</td></tr>';
    return;
  }

  // 各クライアントの応募者数・採用数を集計
  const HIRED_STATUSES = ['内定','内定承諾','採用'];
  const stats = {}; // { client_id: { total, hired } }
  applicants.forEach(a => {
    const cid = a.clientId;
    if (!cid) return;
    if (!stats[cid]) stats[cid] = { total: 0, hired: 0 };
    stats[cid].total++;
    if (HIRED_STATUSES.includes(a.hireStatus)) stats[cid].hired++;
  });

  tbody.innerHTML = clients.map(c => {
    const s = stats[c.client_id] || { total: 0, hired: 0 };
    const safeName = String(c.name || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const safeId = String(c.client_id || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const safePw = String(c.password || '').replace(/</g, '&lt;');
    return `<tr>
      <td>${safeName}</td>
      <td><code style="font-size:11px;">${safeId}</code></td>
      <td><code style="font-size:11px;">${safePw}</code></td>
      <td>${s.total} 件 / 採用 ${s.hired} 件</td>
      <td><button class="btn btn-s" onclick="deleteClient('${String(c.id).replace(/'/g, "\\'")}')">削除</button></td>
    </tr>`;
  }).join('');
}

async function addClient() {
  if (!isAdmin) { setStatus('管理者のみ実行できます', 'err'); return; }
  const nameEl = document.getElementById('newCName');
  const idEl = document.getElementById('newCId');
  const pwEl = document.getElementById('newCPw');
  const name = (nameEl?.value || '').trim();
  const cid = (idEl?.value || '').trim();
  const pw = (pwEl?.value || '').trim();

  if (!name || !cid || !pw) {
    setStatus('クライアント名・ID・パスワードをすべて入力してください', 'err');
    return;
  }
  // ID重複チェック
  const dup = clients.find(c => c.client_id === cid);
  if (dup) {
    setStatus('そのクライアントIDは既に使われています', 'err');
    return;
  }

  const { error } = await sb.from('clients').insert({ client_id: cid, password: pw, name: name });
  if (error) {
    setStatus('追加に失敗しました: ' + error.message, 'err');
    return;
  }
  setStatus('クライアントを追加しました', 'ok');
  if (nameEl) nameEl.value = '';
  if (idEl) idEl.value = '';
  if (pwEl) pwEl.value = '';
  await renderAdmin();
}

async function deleteClient(id) {
  if (!isAdmin) { setStatus('管理者のみ実行できます', 'err'); return; }
  const target = clients.find(c => String(c.id) === String(id));
  if (!target) {
    setStatus('対象のクライアントが見つかりません', 'err');
    return;
  }
  // 該当クライアントの応募者数を確認
  const cnt = applicants.filter(a => a.clientId === target.client_id).length;
  let msg = `クライアント「${target.name}」を削除しますか？`;
  if (cnt > 0) {
    msg += `\n\n⚠ このクライアントには ${cnt} 件の応募者データが紐付いています。\nクライアントを削除しても応募者データは残りますが、ログインできなくなり閲覧できなくなります。`;
  }
  if (!confirm(msg)) return;

  const { error } = await sb.from('clients').delete().eq('id', id);
  if (error) {
    setStatus('削除に失敗しました: ' + error.message, 'err');
    return;
  }
  setStatus('クライアントを削除しました', 'ok');
  await renderAdmin();
}

// ========================================
// マスター管理UI（媒体・部署・人材紹介会社）
// ========================================
function renderManage() {
  // 既存のマスター項目を表示
  renderMasterList('media', 'mlMed');
  renderMasterList('dept', 'mlDept');
  renderMasterList('agency', 'mlAg');
  renderMasterList('assignee', 'mlAssignee');
  // ステータスマスターも更新
  renderStatusMaster();
}

function renderMasterList(type, listId) {
  const ul = document.getElementById(listId);
  if (!ul) return;
  const items = masters[type] || [];
  if (!items.length) {
    ul.innerHTML = '<li style="color:#aaa;font-size:11px;padding:8px 6px;font-style:italic;justify-content:flex-start;background:transparent;">登録なし</li>';
    return;
  }
  // 既存CSS .mg-list li のスタイル(背景色・パディング)を活かしつつ削除ボタンを追加
  ul.innerHTML = items.map((v, i) => `
    <li>
      <span style="color:#1a1a1a;">${escapeHtml(v)}</span>
      <button onclick="deleteM('${type}', ${i})" title="削除"
        style="background:transparent;border:none;color:#D85A30;cursor:pointer;font-size:13px;padding:0 4px;line-height:1;opacity:.5;transition:opacity .15s;"
        onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.5'">✕</button>
    </li>
  `).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function addM(type) {
  const inputId = { media: 'miMed', dept: 'miDept', agency: 'miAg', assignee: 'miAssignee' }[type];
  const input = document.getElementById(inputId);
  if (!input) return;
  const value = (input.value || '').trim();
  if (!value) { alert('項目名を入力してください'); return; }
  if ((masters[type] || []).includes(value)) {
    alert('既に登録されています');
    return;
  }
  // Supabaseに追加
  const cid = isAdmin ? 'admin' : currentClientId;
  const { error } = await sb.from('masters').insert({ client_id: cid, type, value });
  if (error) {
    alert('追加に失敗しました: ' + error.message);
    return;
  }
  // ローカルに反映
  if (!masters[type]) masters[type] = [];
  masters[type].push(value);
  input.value = '';
  setStatus('追加しました', 'ok');
  // 関連UIをリフレッシュ
  renderManage();
  popSelects();
}

async function deleteM(type, index) {
  const items = masters[type] || [];
  const value = items[index];
  if (value === undefined) return;
  if (!confirm(`「${value}」を削除しますか？`)) return;
  // Supabaseから削除
  const cid = isAdmin ? 'admin' : currentClientId;
  const { error } = await sb.from('masters').delete().eq('client_id', cid).eq('type', type).eq('value', value);
  if (error) {
    alert('削除に失敗しました: ' + error.message);
    return;
  }
  // ローカルから削除
  masters[type].splice(index, 1);
  setStatus('削除しました', 'ok');
  renderManage();
  popSelects();
}

// パスワード変更
async function chgPw() {
  const np1 = document.getElementById('np1');
  const np2 = document.getElementById('np2');
  const pwOk = document.getElementById('pwOk');
  if (!np1 || !np2) return;
  const p1 = (np1.value || '').trim();
  const p2 = (np2.value || '').trim();
  if (!p1 || !p2) { alert('パスワードを入力してください'); return; }
  if (p1 !== p2) { alert('パスワードが一致しません'); return; }
  if (p1.length < 4) { alert('パスワードは4文字以上にしてください'); return; }

  if (isAdmin) {
    // 管理者：system_configのadmin_pwを更新
    const { error } = await sb.from('system_config').update({ value: p1 }).eq('key', 'admin_pw');
    if (error) {
      // upsertで作成
      const { error: e2 } = await sb.from('system_config').upsert({ key: 'admin_pw', value: p1 });
      if (e2) { alert('変更に失敗しました: ' + e2.message); return; }
    }
  } else {
    // クライアント：clientsテーブルのpasswordを更新
    const { error } = await sb.from('clients').update({ password: p1 }).eq('id', currentClientId);
    if (error) { alert('変更に失敗しました: ' + error.message); return; }
  }

  np1.value = ''; np2.value = '';
  if (pwOk) {
    pwOk.style.display = 'inline';
    setTimeout(() => { pwOk.style.display = 'none'; }, 3000);
  }
  setStatus('パスワードを変更しました', 'ok');
}


// ========================================
// ステータスマスター管理UI
// ========================================
function renderStatusMaster() {
  // コアステータス凡例
  const legendEl = document.getElementById('coreStatusLegend');
  if (legendEl) {
    legendEl.innerHTML = CORE_STATUS.map(cs =>
      `<span style="display:inline-flex;align-items:center;gap:4px;background:${cs.color}18;border:1px solid ${cs.color}44;border-radius:12px;padding:3px 8px;font-size:10px;font-weight:600;color:${cs.color};">
        <span style="width:7px;height:7px;border-radius:50%;background:${cs.color};"></span>${cs.name}
      </span>`
    ).join(' ');
  }

  // 詳細ステータス一覧（コアステータスでグループ化）
  const listEl = document.getElementById('detailStatusList');
  if (!listEl) return;

  const grouped = {};
  CORE_STATUS.forEach(cs => grouped[cs.id] = []);
  detailStatuses.forEach(ds => {
    if (grouped[ds.core_status_id]) grouped[ds.core_status_id].push(ds);
    else grouped['other'] = grouped['other'] || [];
  });

  listEl.innerHTML = CORE_STATUS.map(cs => {
    const items = grouped[cs.id] || [];
    if (!items.length) return '';
    return `<div style="margin-bottom:.75rem;">
      <div style="font-size:11px;font-weight:700;color:${cs.color};margin-bottom:4px;display:flex;align-items:center;gap:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${cs.color};display:inline-block;"></span>
        ${cs.name}
        <span style="font-size:10px;color:#aaa;font-weight:400;">${items.length}件</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;padding-left:14px;">
        ${items.map(ds => `
          <div style="display:flex;align-items:center;gap:4px;background:#f8f8f7;border:1px solid #e8e8e6;border-radius:8px;padding:4px 10px;font-size:11px;">
            <span>${ds.name}</span>
            ${!ds.is_default ? `<button onclick="deleteDetailStatus('${ds.id}')" style="background:none;border:none;cursor:pointer;color:#D85A30;font-size:11px;padding:0 2px;line-height:1;" title="削除">✕</button>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
  }).join('');

  // コア選択肢を更新
  const coreSelect = document.getElementById('newDetailStatusCore');
  if (coreSelect) {
    coreSelect.innerHTML = '<option value="">選択してください</option>' +
      CORE_STATUS.map(cs => `<option value="${cs.id}">${cs.name}</option>`).join('');
  }
}

function addDetailStatus() {
  document.getElementById('addDetailStatusForm').style.display = 'block';
  renderStatusMaster();
}

async function saveDetailStatus() {
  const name = document.getElementById('newDetailStatusName').value.trim();
  const coreId = document.getElementById('newDetailStatusCore').value;
  if (!name || !coreId) { alert('ステータス名とコアステータスを入力してください'); return; }
  if (detailStatuses.find(d => d.name === name)) { alert('同じ名前のステータスが既に存在します'); return; }

  const newDs = {
    id: 'ds_' + Date.now(),
    client_id: currentClientId,
    name,
    core_status_id: coreId,
    ord: detailStatuses.length + 1,
    is_default: false
  };

  try {
    const { error } = await sb.from('detail_status_master').insert(newDs);
    if (error) {
      // テーブル未作成の場合はメモリのみ
      console.warn('detail_status_master insert failed:', error.message);
    }
  } catch(e) { console.warn(e); }

  detailStatuses.push(newDs);
  // mastersのstatusにも追加
  if (!masters.status.includes(name)) {
    masters.status.push(name);
    popSelects();
  }

  document.getElementById('newDetailStatusName').value = '';
  document.getElementById('newDetailStatusCore').value = '';
  document.getElementById('addDetailStatusForm').style.display = 'none';
  renderStatusMaster();
  setStatus(name + ' を追加しました', 'ok');
}

async function deleteDetailStatus(id) {
  if (!confirm('このステータスを削除しますか？')) return;
  const ds = detailStatuses.find(d => d.id === id);
  if (!ds) return;
  try {
    await sb.from('detail_status_master').delete().eq('id', id).eq('client_id', currentClientId);
  } catch(e) {}
  detailStatuses = detailStatuses.filter(d => d.id !== id);
  renderStatusMaster();
  setStatus(ds.name + ' を削除しました', 'ok');
}

function exportBudgetCSV() {
  const rows=[['月','媒体','部署','職種','広告費','種別']];
  budgetData.forEach(d=>rows.push([d.month,d.media,d.dept||'',d.job||'',d.amount,d.type==='agency'?'人材紹介':'求人媒体']));
  const csv=rows.map(r=>r.join(',')).join('\r\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download='budget_'+new Date().toISOString().split('T')[0]+'.csv';
  a.click();
}


// ========================================
// グローバル公開（onclick等のインラインハンドラから確実に呼べるようにする）
// ========================================
if (typeof window !== 'undefined') {
  window.doLogin = doLogin;
  window.addClient = addClient;
  window.deleteClient = deleteClient;
  window.renderTaskCalendar = renderTaskCalendar;
  window.clickTaskCalDay = clickTaskCalDay;
  window.afJump = afJump;
  window.setSectionView = setSectionView;
  window.onCompareRowCheck = onCompareRowCheck;
  window.showPickupDetails = showPickupDetails;
  window.showPickupDetailsMulti = showPickupDetailsMulti;
  // 上記以外の関数は function宣言により既にグローバルだが、
  // 万一のミニファイ等に備えて主要関数も明示しておく
}

// 起動完了ログ
console.log('[app.js] 読み込み完了');
