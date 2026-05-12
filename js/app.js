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
let masters = { media: [], status: [], agency: [], hire: [], dept: [], assignee: [], jobType: [] };
// マルチセレクトフィルターの選択状態（{status:[], media:[], jobType:[], dept:[]}）
let multiFilterState = { status: [], media: [], jobType: [], dept: [] };
let clients = []; // 管理者用
let staffList = []; // 担当者マスタ（Phase B-1で追加）
// 現在の担当者（Phase B-2で追加）
let currentStaffId = null;
let currentStaffName = '';
let activeStaffList = []; // 担当者選択画面・ヘッダープルダウン用の在籍中担当者一覧
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

  // ===== ログインローディング演出（v2.4 ロゴベース） =====
  // 2モード:
  //  jump: ログインボタン押下後（2秒、ロゴのパルス＋「ログイン中...」）
  //  walk: 担当者選択後（5秒、ロゴ＋スピナー＋メッセージ4本）
  function showLoadingOverlay(mode) {
    mode = mode || 'walk';
    const ov = document.getElementById('loginLoadingOverlay');
    if (!ov) return;
    const jumpStage = document.getElementById('loadingJumpStage');
    const walkStage = document.getElementById('loadingWalkStage');
    const msg = document.getElementById('loadingMessage');
    // 既存タイマーがあればクリア
    if (window.__loadingMsgTimers) {
      window.__loadingMsgTimers.forEach(t => clearTimeout(t));
    }
    window.__loadingMsgTimers = [];

    if (mode === 'jump') {
      // ジャンプ相当：ロゴパルス
      if (jumpStage) jumpStage.style.display = 'flex';
      if (walkStage) walkStage.style.display = 'none';
      if (msg) {
        msg.textContent = 'ログイン中...';
        msg.style.color = '#666';
        msg.style.opacity = '1';
      }
    } else {
      // 歩く相当：ロゴ＋スピナー＋メッセージ切替
      if (jumpStage) jumpStage.style.display = 'none';
      if (walkStage) walkStage.style.display = 'flex';
      if (msg) {
        msg.textContent = 'もうちょっと待ってね';
        msg.style.color = '#666';
        msg.style.opacity = '1';
      }
      // メッセージ切替（1.2秒間隔で4本）
      const messages = [
        'もうちょっと待ってね',
        'データを取りに行ってるよ',
        'もうすぐだよ',
        'あと少し！'
      ];
      messages.forEach((text, i) => {
        const t = setTimeout(() => {
          if (!msg) return;
          msg.style.opacity = '0';
          setTimeout(() => {
            msg.textContent = text;
            msg.style.opacity = '1';
          }, 250);
        }, i * 1200);
        window.__loadingMsgTimers.push(t);
      });
    }

    // オーバーレイ表示
    ov.style.display = 'flex';
    requestAnimationFrame(() => {
      ov.style.opacity = '1';
    });
    window.__loginLoadingStartedAt = Date.now();
    window.__loginLoadingMode = mode;
  }
  function hideLoadingOverlay() {
    const ov = document.getElementById('loginLoadingOverlay');
    if (!ov) return;
    ov.style.opacity = '0';
    setTimeout(() => { ov.style.display = 'none'; }, 400);
    if (window.__loadingMsgTimers) {
      window.__loadingMsgTimers.forEach(t => clearTimeout(t));
      window.__loadingMsgTimers = [];
    }
  }
  // 最低N秒は表示する
  async function waitMinDuration(ms) {
    const started = window.__loginLoadingStartedAt || Date.now();
    const elapsed = Date.now() - started;
    const remain = ms - elapsed;
    if (remain > 0) await new Promise(r => setTimeout(r, remain));
  }
  // グローバル公開
  window.__saiyoLoginLoading = {
    show: showLoadingOverlay,
    showJump: function() { showLoadingOverlay('jump'); },
    showWalk: function() { showLoadingOverlay('walk'); },
    wakeUp: function() {},
    ok: function() {},
    hide: hideLoadingOverlay,
    waitMin: waitMinDuration
  };

  hideErr();

  const email = (idEl?.value || '').trim();
  const pw = pwEl?.value || '';
  console.log('[doLogin] 入力email:', email, '/ パスワード長:', pw.length);

  // 入力バリデーション
  if (!email) {
    console.log('[doLogin] email未入力');
    showErr('メールアドレスを入力してください');
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
  // ローディングオーバーレイを表示（ジャンプモード：ようこそ！）
  showLoadingOverlay('jump');

  try {
    console.log('[doLogin] Supabase Auth signInWithPassword 開始');

    // Supabase Auth で認証
    const { data, error } = await sb.auth.signInWithPassword({
      email: email,
      password: pw
    });

    if (error || !data?.user) {
      console.log('[doLogin] 認証失敗:', error?.message);
      showErr('メールアドレスまたはパスワードが正しくありません');
      hideLoadingOverlay();
      return;
    }

    const user = data.user;
    console.log('[doLogin] 認証成功 uid:', user.id);

    // admin判定（app_metadata.role === 'admin'）
    // ※ user_metadataは本人改ざん可能なので使わない
    const role = user.app_metadata?.role;
    if (role === 'admin') {
      console.log('[doLogin] 管理者ログイン成功');
      currentClientId = 'admin';
      currentClientName = '管理者（全社）';
      isAdmin = true;
      await startApp();
      return;
    }

    // 一般クライアント：auth_user_id から対応する clients レコードを取得
    const { data: clientData, error: clientErr } = await sb.from('clients')
      .select('client_id, name')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (clientErr) {
      console.error('[doLogin] clients取得エラー', clientErr);
      showErr('アカウント情報の取得に失敗しました。管理者に確認してください');
      await sb.auth.signOut();
      hideLoadingOverlay();
      return;
    }

    if (!clientData) {
      console.log('[doLogin] clients紐付けなし');
      showErr('アカウント情報が見つかりません。管理者にお問い合わせください');
      await sb.auth.signOut();
      hideLoadingOverlay();
      return;
    }

    console.log('[doLogin] クライアントログイン成功:', clientData.name);
    currentClientId = clientData.client_id;
    currentClientName = clientData.name;
    isAdmin = false;
    // Phase B-2：担当者選択フロー
    // 1) 在籍中担当者を取得 → 0人ならスキップ、1人以上なら選択画面へ
    // 2) localStorageに前回選択がある＋まだ在籍中なら自動選択
    await loadActiveStaffList();
    const savedStaffId = loadSavedStaffSelection();
    if (savedStaffId) {
      const found = activeStaffList.find(s => String(s.id) === String(savedStaffId));
      if (found) {
        // 自動復元
        currentStaffId = found.id;
        currentStaffName = found.name;
        console.log('[doLogin] 担当者を自動復元:', currentStaffName);
        await startApp();
        return;
      }
    }
    if (activeStaffList.length === 0) {
      // 担当者ゼロ → そのまま続行（未設定状態）
      currentStaffId = null;
      currentStaffName = '';
      console.log('[doLogin] 担当者ゼロ、未設定で続行');
      await startApp();
      return;
    }
    // 担当者選択画面を表示
    // v2.9：jump演出の2秒最低待機を廃止 → ローディングを即消して担当者選択へ
    hideLoadingOverlay();
    showStaffSelectScreen();

  } catch (e) {
    console.error('[doLogin] 例外発生', e);
    showErr('ログイン処理でエラーが発生しました。管理者に確認してください');
    hideLoadingOverlay();
  } finally {
    setBtnLoading(false);
  }
}

async function startApp() {
  console.log('[startApp] 開始 (isAdmin=' + isAdmin + ', client=' + currentClientName + ', staff=' + currentStaffName + ')');
  // v2.9：startApp呼び出し時点で即ローディング非表示（メッセージ切替タイマーも全停止）
  try {
    if (window.__loadingMsgTimers) {
      window.__loadingMsgTimers.forEach(t => clearTimeout(t));
      window.__loadingMsgTimers = [];
    }
    const ov0 = document.getElementById('loginLoadingOverlay');
    if (ov0) { ov0.style.display = 'none'; ov0.style.opacity = '0'; }
    window.__loginLoadingStartedAt = 0;
  } catch(e) {}
  try {
    document.getElementById('loginScreen').style.display = 'none';
    const staffSel = document.getElementById('staffSelectScreen');
    if (staffSel) staffSel.style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('clientBadge').textContent = currentClientName;
    document.getElementById('adminNavBtn').style.display = isAdmin ? 'inline-flex' : 'none';
    // Phase B-2：ヘッダー担当者表示
    updateHeaderStaffDisplay();
    initFormOptions();
    await loadMasters();
    await loadDetailStatuses(); // 詳細ステータス読み込み
    // Phase C-1：担当者リストを先にロード（応募者一覧の担当列で使用）
    // adminも全クライアントの担当者を読む（RLSで自動的に admin=全件、client=自社のみ）
    try { await loadStaff(); } catch(e) { console.warn('[startApp] loadStaff失敗', e); }
    await loadApplicants();
    await loadMinutesAndTasks();
    await loadBudgetData();
    updateTaskBadge();
    // Step 1: モードシステム初期化（前回モード復元、サブナビ表示など）
    try { await initModeSystem(); } catch(e) { console.warn('[startApp] initModeSystem失敗', e); }
    // Step 2: 起動時の画面決定
    // - 担当者選択直後（window.__forceHomeAfterStaff）→ 必ずホーム
    // - localStorage に前回モードがあれば → そのモードのデフォルトセクションへ
    // - なければ → モード選択ホーム画面
    let savedMode = null;
    try { savedMode = localStorage.getItem(SAIYO_MODE_KEY); } catch(e) {}
    if (window.__forceHomeAfterStaff) {
      // 担当者選択経由：必ずホーム
      window.__forceHomeAfterStaff = false;
      showModeHome();
    } else if (savedMode && SAIYO_MODE_DEFS[savedMode]) {
      // ページリロードなど：前回モードへ
      setMode(savedMode);
    } else {
      // 初回 or モード未設定：ホーム
      showModeHome();
    }
    // ルーター連携：URLから現在の画面を復元（直URL/リロード対応）
    if (window.SaiyoRouter && typeof window.SaiyoRouter.onLoginComplete === 'function') {
      try { window.SaiyoRouter.onLoginComplete(); } catch(e) { console.warn('[startApp] router連携エラー', e); }
    }
    // v2.9：演出時間を完全廃止（5秒も500msも0msに）
    // データロードが終わった瞬間にローディングオーバーレイを消す
    try {
      if (window.__loadingMsgTimers) {
        window.__loadingMsgTimers.forEach(t => clearTimeout(t));
        window.__loadingMsgTimers = [];
      }
      if (window.__saiyoLoginLoading && window.__saiyoLoginLoading.hide) {
        window.__saiyoLoginLoading.hide();
      }
      const ov = document.getElementById('loginLoadingOverlay');
      if (ov) { ov.style.display = 'none'; ov.style.opacity = '0'; }
      window.__loginLoadingStartedAt = 0;
    } catch(e) { console.warn('[startApp] loading解除エラー', e); }
    console.log('[startApp] 完了');
  } catch (e) {
    console.error('[startApp] エラー発生', e);
    // ログイン画面に戻してエラー表示
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    // ローディングも閉じる
    if (window.__saiyoLoginLoading && window.__saiyoLoginLoading.hide) {
      try { window.__saiyoLoginLoading.hide(); } catch(_) {}
    }
    const err = document.getElementById('loginErr');
    if (err) {
      err.textContent = 'ログイン後の初期化でエラーが発生しました: ' + (e.message || '不明なエラー');
      err.style.display = 'block';
    }
  }
}

// ログアウト：確認ポップアップを表示する（doLogoutは互換のため残す）
function confirmLogout() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.style.display = 'flex';
}
// 確認ポップアップを閉じる
function closeLogoutConfirm() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.style.display = 'none';
}
// 背景をクリックしたらポップアップを閉じる（中の白いカードをクリックしても閉じないよう、子はevent.stopPropagation()済み）
function onLogoutModalBgClick(e) {
  if (e && e.target && e.target.id === 'logoutConfirmModal') {
    closeLogoutConfirm();
  }
}
// ESCキーでポップアップを閉じる（DOMContentLoaded後に1度だけ仕込む）
if (typeof window !== 'undefined' && !window.__logoutEscBound) {
  window.__logoutEscBound = true;
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      const modal = document.getElementById('logoutConfirmModal');
      if (modal && modal.style.display === 'flex') {
        closeLogoutConfirm();
      }
    }
  });
}
// 互換用のラッパー（既存呼び出し点でも動くように、確認画面を経由）
async function doLogout() {
  confirmLogout();
}

// 実際のログアウト処理（ポップアップ「はい」で呼び出される）
async function executeLogout() {
  // ポップアップを閉じる
  closeLogoutConfirm();
  // Supabase Auth のセッションを破棄（localStorageのJWTもクリア）
  try {
    await sb.auth.signOut();
  } catch (e) {
    console.warn('[executeLogout] signOut失敗（続行）', e);
  }
  // Phase B-2：担当者の保存も削除（ログアウト時はリセット）
  if (currentClientId) {
    try { localStorage.removeItem(getStaffStorageKey(currentClientId)); } catch(e) {}
  }
  currentClientId = null; isAdmin = false;
  currentStaffId = null; currentStaffName = ''; activeStaffList = [];
  applicants = []; masters = { media: [], status: [], agency: [] };
  _leadTimeMap = null; _leadTimeMapClientKey = null;
  editId = null; curId = null; tempDocs = [];
  if (typeof anChart !== 'undefined' && anChart) { anChart.destroy(); anChart = null; }
  document.getElementById('mainApp').style.display = 'none';
  const staffSel = document.getElementById('staffSelectScreen');
  if (staffSel) staffSel.style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginId').value = '';
  document.getElementById('loginPw').value = '';
  // ルーター連携：URLを/loginに戻す（履歴も置換）
  if (window.SaiyoRouter) {
    try {
      const base = window.SaiyoRouter.BASE || '';
      history.replaceState({ path: '/login' }, '', base + '/login');
    } catch(e) {}
  }
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
      address: r.address || '',
      clientId: r.client_id,
      updatedAt: r.updated_at || r.created_at || null,
      // 新ステータスからcoreStatusIdを再計算（旧データもこれで正しくマッピングされる）
      coreStatusId: STATUS_TO_CORE[newStatus] || r.core_status_id || 'applied',
      detailStatusId: r.detail_status_id || null,
      // Phase C-1：担当者は別途読み込む（loadApplicantStaff）
      staffIds: []
    };
  });
  // Phase C-1：応募者⇔担当者の紐付けを読み込む
  await loadApplicantStaff();
  // Phase D-2：応募者ごとの面接情報を読み込む（一覧表示の面接日列で使用）
  await loadApplicantInterviews();
  setStatus('');
}

// Phase D-2：応募者の面接情報を一括取得（一覧の面接日列で使用）
async function loadApplicantInterviews() {
  if (!applicants.length) return;
  const ids = applicants.map(a => a.id);
  const { data, error } = await sb.from('interviews')
    .select('applicant_id, scheduled_at, result, interview_type, type_other')
    .in('applicant_id', ids)
    .order('scheduled_at', { ascending: false, nullsFirst: false });
  if (error) {
    console.warn('[loadApplicantInterviews] エラー（無視）', error);
    return;
  }
  // 応募者IDごとにグループ化
  const map = {};
  (data || []).forEach(r => {
    if (!map[r.applicant_id]) map[r.applicant_id] = [];
    map[r.applicant_id].push(r);
  });
  applicants.forEach(a => { a.interviews = map[a.id] || []; });
}

// Phase C-1：応募者と担当者の紐付け（applicant_staff）を取得
async function loadApplicantStaff() {
  if (!applicants.length) return;
  const ids = applicants.map(a => a.id);
  // RLSで自動的に絞り込まれる
  const { data, error } = await sb.from('applicant_staff')
    .select('applicant_id, staff_id')
    .in('applicant_id', ids);
  if (error) {
    console.warn('[loadApplicantStaff] エラー（無視して続行）', error);
    return;
  }
  // 応募者IDごとにグループ化
  const map = {};
  (data || []).forEach(r => {
    if (!map[r.applicant_id]) map[r.applicant_id] = [];
    map[r.applicant_id].push(r.staff_id);
  });
  applicants.forEach(a => { a.staffIds = map[a.id] || []; });
}

async function loadMasters() {
  const cid = isAdmin ? 'admin' : currentClientId;
  const { data } = await sb.from('masters').select('*').eq('client_id', cid);
  if (data && data.length) {
    masters = { media: [], status: [], agency: [], hire: [], dept: [], assignee: [], jobType: [] };
    data.forEach(r => { if (masters[r.type] !== undefined) masters[r.type].push(r.value); });
    // assigneeが空なら初期値を投入（既存マスターはあるが担当者だけ未登録のケース）
    if (!masters.assignee.length) {
      masters.assignee = ['LinkCore', 'クライアント'];
      const aRows = masters.assignee.map(v => ({ client_id: cid, type: 'assignee', value: v }));
      try { await sb.from('masters').insert(aRows); } catch(e) {}
    }
    // jobTypeが空ならデフォルト職種9個を投入
    if (!masters.jobType.length) {
      masters.jobType = ['マーケティング','デザイナー','事務','人事','経理','財務','カスタマーサポート','不動産管理','コンサルタント'];
      const jRows = masters.jobType.map((v,i) => ({ client_id: cid, type: 'jobType', value: v, ord: i }));
      try { await sb.from('masters').insert(jRows); } catch(e) {}
    }
  } else {
    // デフォルトマスター（新体系ステータス）
    masters = {
      media: ['リクナビNEXT','マイナビ転職','Indeed','LinkedIn','ハローワーク','自社HP','紹介'],
      status: ['書類依頼中','書類到着','面接調整中','面接確定','1次面接','2次面接','選考通過','採用','不採用','不来場','内定','内定辞退','内定承諾','連絡不通','キャンセル','入社','退職'],
      agency: [],
      hire: ['内定','内定承諾','採用','不採用','保留'],
      dept: [],
      assignee: ['LinkCore','クライアント'],
      jobType: ['マーケティング','デザイナー','事務','人事','経理','財務','カスタマーサポート','不動産管理','コンサルタント']
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

// クライアントID から表示名を取得（adminグルーピング表示用）
function getClientDisplayName(cid) {
  if (!cid) return '（未割当）';
  if (cid === 'admin') return '管理者';
  const c = (clients || []).find(x => x.client_id === cid);
  return c ? c.name : cid;
}

// adminタスク画面用：クライアント絞り込みプルダウンを生成・表示制御
function populateTaskClientFilter() {
  const sel = document.getElementById('taskClientFilter');
  if (!sel) return;
  if (!isAdmin) {
    sel.style.display = 'none';
    return;
  }
  // タスクから登場するクライアントID一覧を集計
  const cidsInTasks = [...new Set(tasks.map(t => t.clientId).filter(Boolean))];
  // clients配列にあるもの + tasksに登場するもの両方を選択肢にする
  const allCids = new Set();
  (clients || []).forEach(c => { if (c.client_id) allCids.add(c.client_id); });
  cidsInTasks.forEach(c => allCids.add(c));
  const sortedCids = [...allCids].sort((a, b) => {
    const an = getClientDisplayName(a);
    const bn = getClientDisplayName(b);
    return an.localeCompare(bn, 'ja');
  });
  const cur = sel.value;
  sel.innerHTML = '<option value="">全クライアント</option>'
    + sortedCids.map(cid => `<option value="${escapeOwnerHtml(cid)}">${escapeOwnerHtml(getClientDisplayName(cid))}</option>`).join('');
  sel.style.display = 'inline-block';
  if (cur) sel.value = cur;
}

// admin応募者一覧画面用：クライアント絞り込みプルダウンを生成・表示制御
function populateAppClientFilter() {
  const sel = document.getElementById('appClientFilter');
  if (!sel) return;
  if (!isAdmin) {
    sel.style.display = 'none';
    return;
  }
  // applicantsから登場するクライアントID一覧を集計
  const cidsInApps = [...new Set(applicants.map(a => a.clientId).filter(Boolean))];
  const allCids = new Set();
  (clients || []).forEach(c => { if (c.client_id) allCids.add(c.client_id); });
  cidsInApps.forEach(c => allCids.add(c));
  const sortedCids = [...allCids].sort((a, b) => {
    const an = getClientDisplayName(a);
    const bn = getClientDisplayName(b);
    return an.localeCompare(bn, 'ja');
  });
  const cur = sel.value;
  sel.innerHTML = '<option value="">全クライアント</option>'
    + sortedCids.map(cid => `<option value="${escapeOwnerHtml(cid)}">${escapeOwnerHtml(getClientDisplayName(cid))}</option>`).join('');
  sel.style.display = 'inline-block';
  if (cur) sel.value = cur;
}

// admin議事録画面用：クライアント絞り込みプルダウンを生成・表示制御
function populateMinutesClientFilter() {
  const sel = document.getElementById('minutesClientFilter');
  if (!sel) return;
  if (!isAdmin) {
    sel.style.display = 'none';
    return;
  }
  const cidsInMinutes = [...new Set(minutes.map(m => m.clientId).filter(Boolean))];
  const allCids = new Set();
  (clients || []).forEach(c => { if (c.client_id) allCids.add(c.client_id); });
  cidsInMinutes.forEach(c => allCids.add(c));
  const sortedCids = [...allCids].sort((a, b) => {
    const an = getClientDisplayName(a);
    const bn = getClientDisplayName(b);
    return an.localeCompare(bn, 'ja');
  });
  const cur = sel.value;
  sel.innerHTML = '<option value="">全クライアント</option>'
    + sortedCids.map(cid => `<option value="${escapeOwnerHtml(cid)}">${escapeOwnerHtml(getClientDisplayName(cid))}</option>`).join('');
  sel.style.display = 'inline-block';
  if (cur) sel.value = cur;
}

// admin予算管理画面用：クライアント絞り込みプルダウンを生成・表示制御
function populateBudgetClientFilter() {
  const sel = document.getElementById('budgetClientFilter');
  if (!sel) return;
  if (!isAdmin) {
    sel.style.display = 'none';
    return;
  }
  // applicants と budgetData 両方から登場するクライアントID一覧を集計
  const cidsInApps = [...new Set(applicants.map(a => a.clientId).filter(Boolean))];
  const cidsInBudget = [...new Set(budgetData.map(d => d.clientId).filter(Boolean))];
  const allCids = new Set();
  (clients || []).forEach(c => { if (c.client_id) allCids.add(c.client_id); });
  cidsInApps.forEach(c => allCids.add(c));
  cidsInBudget.forEach(c => allCids.add(c));
  const sortedCids = [...allCids].sort((a, b) => {
    const an = getClientDisplayName(a);
    const bn = getClientDisplayName(b);
    return an.localeCompare(bn, 'ja');
  });
  const cur = sel.value;
  sel.innerHTML = '<option value="">全クライアント</option>'
    + sortedCids.map(cid => `<option value="${escapeOwnerHtml(cid)}">${escapeOwnerHtml(getClientDisplayName(cid))}</option>`).join('');
  sel.style.display = 'inline-block';
  if (cur) sel.value = cur;
}

// タスク配列をクライアントIDでグループ化（admin時用）
// 戻り値: [{ cid, name, items: [...] }, ...]（応募数降順）
function groupTasksByClient(taskArr) {
  const groups = {};
  taskArr.forEach(t => {
    const cid = t.clientId || '_no_client';
    if (!groups[cid]) groups[cid] = [];
    groups[cid].push(t);
  });
  // クライアント名でソート（_no_clientは末尾）
  return Object.entries(groups)
    .map(([cid, items]) => ({
      cid: cid === '_no_client' ? null : cid,
      name: cid === '_no_client' ? '（未割当）' : getClientDisplayName(cid),
      items
    }))
    .sort((a, b) => {
      if (!a.cid && b.cid) return 1;
      if (a.cid && !b.cid) return -1;
      return a.name.localeCompare(b.name, 'ja');
    });
}

// セクション内をクライアント別にグルーピングしたHTMLを返す（admin時のみ呼ばれる）
// section: { items: [...], headColor: '...', headLabel: '...', icon: '...' }
function buildGroupedSectionHTML(items, headColor, headLabel) {
  if (!items.length) return '';
  const groups = groupTasksByClient(items);
  let html = `<div style="margin-bottom:1rem;">
    <div style="font-size:11px;font-weight:600;color:${headColor};margin-bottom:8px;">${headLabel}（${items.length}件）</div>`;
  groups.forEach(g => {
    html += `<div style="margin-bottom:10px;padding-left:6px;border-left:3px solid #c8d6d2;">
      <div style="font-size:11px;font-weight:700;color:#2a4a3e;margin-bottom:4px;padding:3px 8px;background:#f0faf6;border-radius:4px;display:inline-block;">
        🏢 ${escapeOwnerHtml(g.name)}（${g.items.length}件）
      </div>
      ${g.items.map(t => renderTaskRow(t)).join('')}
    </div>`;
  });
  html += '</div>';
  return html;
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
  // Step 3: 'dashboard' は採用運用ダッシュとして通常表示する（Step 2のリダイレクトは廃止）
  // ホーム画面は別途 showModeHome() / goHome() で表示
  // ルーター連携：URLを更新（ルーター起因の呼び出しでない場合のみ）
  if (window.SaiyoRouter && typeof window.SaiyoRouter.syncUrlFromSection === 'function') {
    window.SaiyoRouter.syncUrlFromSection(s);
  }
  // Step 1: セクション → モードのマッピング、セクション切替時に該当モードへ自動移行
  const sectionToMode = {
    'dashboard': 'operation',  // Step 3: ダッシュは採用運用モード配下
    'list': 'operation', 'add': 'operation', 'add-choice': 'operation',
    'add-paste': 'operation', 'import': 'operation',
    'schedule': 'operation', 'minutes': 'operation', 'tasks': 'operation',
    'analytics-dash': 'analytics',  // Step 4: 分析ダッシュは採用分析モードのデフォルト
    'analytics': 'analytics', 'budget': 'analytics', 'ads': 'analytics',
    'master': 'admin_settings', 'staff': 'admin_settings', 'admin': 'admin_settings'
  };
  const targetMode = sectionToMode[s];
  if (targetMode && typeof setMode === 'function') {
    setMode(targetMode, true);  // silent=true: モード切替時の追加処理をスキップ
  }
  // 前のセクションのキャラを非表示
  document.querySelectorAll('[id^="char_sec-"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.sec').forEach(e => {
    e.classList.remove('active');
    // mode-home がデフォルトで display:none なので、それを尊重
    if (e.id === 'sec-mode-home') e.style.display = 'none';
  });
  // サブナビ・旧navのactive解除
  document.querySelectorAll('.nb, .snb').forEach(e => e.classList.remove('active'));
  // 新しいセクションのキャラを表示
  const charEl = document.getElementById('char_' + 'sec-' + s);
  if (charEl && s !== 'dashboard') charEl.style.display = 'block';
  const secEl = document.getElementById('sec-' + s);
  if (secEl) secEl.classList.add('active');
  // サブナビのactive表示
  const sectionToSnb = {
    'list': 0, 'schedule': 1, 'minutes': 2, 'tasks': 3,  // operation
    'analytics-dash': 0, 'analytics': 1, 'budget': 2, 'ads': 3,  // analytics
    'master': 0, 'staff': 1, 'admin': 2  // admin_settings
  };
  if (targetMode && sectionToSnb[s] !== undefined) {
    const subNavId = targetMode === 'admin_settings' ? 'subNavAdminSettings' :
                     targetMode === 'analytics' ? 'subNavAnalytics' : 'subNavOperation';
    const navContainer = document.getElementById(subNavId);
    if (navContainer) {
      const btns = navContainer.querySelectorAll('.snb');
      // index指定のactive、ただしadd/import等は応募者一覧をactive扱い
      let activeIdx = sectionToSnb[s];
      if (s === 'add' || s === 'import' || s === 'add-choice' || s === 'add-paste') activeIdx = 0;
      if (btns[activeIdx]) btns[activeIdx].classList.add('active');
    }
  }
  // Phase C-2：addセクション以外に切り替えるときは編集ヘッダーを必ず隠す
  if (s !== 'add' && typeof hideEditModeHeader === 'function') hideEditModeHeader();
  if (s === 'dashboard') renderDashboard();
  if (s === 'list') { closeDetail(); renderList(); }
  if (s === 'schedule') renderSchedule();
  if (s === 'analytics') { setPeriod('all'); }
  if (s === 'master') renderManage();
  if (s === 'admin') renderAdmin();
  if (s === 'staff') renderStaff();
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
  if (s === 'ads') {
    // 初回表示は分析タブから（データがあれば表示、無ければ案内）
    if (typeof adsLoadAnalytics === 'function') adsLoadAnalytics();
  }
  if (s === 'analytics-dash') {
    // Step 4: 採用分析ダッシュ
    if (typeof renderAnalyticsDash === 'function') renderAnalyticsDash();
  }
}

// ========================================================
// Step 1: モード制御
// ========================================================
// localStorage キー
const SAIYO_MODE_KEY = 'saiyoCoreActiveMode';
// クライアントごとの有効モード（DB から読み込み、デフォルトは全モード）
let saiyoEnabledModes = ['operation', 'analytics', 'admin_settings'];
// 現在のモード
let saiyoActiveMode = null;

// モード定義（表示用）
const SAIYO_MODE_DEFS = {
  operation:      { label: '採用運用',   icon: '🏃', defaultSection: 'dashboard',      contextLabel: '応募対応・面接・タスクを進める' },
  analytics:      { label: '採用分析',   icon: '📊', defaultSection: 'analytics-dash', contextLabel: '採用と広告のデータを見る' },
  admin_settings: { label: '管理設定',   icon: '⚙️', defaultSection: 'master',         contextLabel: 'マスター・担当者の管理' },
};

// モードを切り替える
// silent=true のとき：showSec から呼ばれた、画面遷移はしない
function setMode(mode, silent) {
  if (!SAIYO_MODE_DEFS[mode]) return;
  // adminは全モード許可、それ以外は enabled_modes をチェック
  if (!isAdmin && !saiyoEnabledModes.includes(mode)) {
    // グレーアウトされたタブをクリック → アップグレード案内（将来用）
    showUpgradeModal(mode);
    return;
  }
  saiyoActiveMode = mode;
  // localStorage に保存（次回ログイン時に復元）
  try { localStorage.setItem(SAIYO_MODE_KEY, mode); } catch(e) {}
  // body の data-active-mode 属性を更新（CSSセレクタ用）
  document.body.setAttribute('data-active-mode', mode);
  // モードタブの active クラス更新
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  // サブナビの表示切替
  document.querySelectorAll('.sub-nav').forEach(nav => {
    nav.style.display = nav.dataset.mode === mode ? 'flex' : 'none';
  });
  // モード概要ラベル更新
  const ctxEl = document.getElementById('modeContextLabel');
  if (ctxEl) ctxEl.textContent = SAIYO_MODE_DEFS[mode].contextLabel;
  // Step 3: 採用運用モード時のみ自動更新タイマーを動かす
  if (mode === 'operation') {
    if (typeof startDashAutoRefresh === 'function') startDashAutoRefresh();
    if (typeof stopAnDashAutoRefresh === 'function') stopAnDashAutoRefresh();
  } else if (mode === 'analytics') {
    // Step 4: 採用分析モード時はan-dash自動更新
    if (typeof stopDashAutoRefresh === 'function') stopDashAutoRefresh();
    if (typeof startAnDashAutoRefresh === 'function') startAnDashAutoRefresh();
  } else {
    if (typeof stopDashAutoRefresh === 'function') stopDashAutoRefresh();
    if (typeof stopAnDashAutoRefresh === 'function') stopAnDashAutoRefresh();
  }
  // Step 5: モード概要バーを更新
  if (typeof renderModeQuickStats === 'function') renderModeQuickStats();
  // silent=true ならここで終了（showSec から呼ばれた場合）
  if (silent) return;
  // silent=false なら、デフォルトセクションへ遷移
  const defaultSec = SAIYO_MODE_DEFS[mode].defaultSection;
  if (defaultSec && typeof showSec === 'function') {
    showSec(defaultSec);
  }
}

// 「ホームに戻る」：モード選択ホーム画面へ
function goHome() {
  // Step 2: 既存ダッシュではなく、モード選択ホーム画面を表示
  showModeHome();
}

// Step 2: モード選択ホーム画面を表示
function showModeHome() {
  // 全セクションを非表示にして mode-home だけ表示
  document.querySelectorAll('.sec').forEach(e => {
    e.classList.remove('active');
    e.style.display = '';
  });
  document.querySelectorAll('[id^="char_sec-"]').forEach(el => el.style.display = 'none');
  const home = document.getElementById('sec-mode-home');
  if (home) {
    home.classList.add('active');
    home.style.display = 'block';
  }
  // モードタブの active を解除（どのモードにも属していない状態）
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
  // body の data-active-mode を解除
  document.body.removeAttribute('data-active-mode');
  // Step 5: 現在モードもクリア
  saiyoActiveMode = null;
  // モード概要ラベル & クイックスタッツクリア
  const ctx = document.getElementById('modeContextLabel');
  if (ctx) ctx.textContent = '';
  const qs = document.getElementById('modeQuickStats');
  if (qs) { qs.style.display = 'none'; qs.innerHTML = ''; }
  // 自動更新タイマー停止
  if (typeof stopDashAutoRefresh === 'function') stopDashAutoRefresh();
  if (typeof stopAnDashAutoRefresh === 'function') stopAnDashAutoRefresh();
  // URL同期：/home
  if (window.SaiyoRouter && typeof window.SaiyoRouter.syncUrlFromSection === 'function') {
    try {
      const base = window.SaiyoRouter.BASE || '';
      history.replaceState({ path: '/home' }, '', base + '/home');
    } catch(e) {}
  }
  // ホーム画面のコンテンツ更新
  refreshModeHome();
}

// Step 2: モード選択ホーム画面のコンテンツ更新（KPI・コアラ表情）
function refreshModeHome() {
  // 挨拶
  const greetEl = document.getElementById('mhGreeting');
  const dateEl = document.getElementById('mhDate');
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'こんばんは';
  const name = currentStaffName || (isAdmin ? '管理者' : currentClientName || '');
  if (greetEl) greetEl.textContent = name ? `${greet}、${name}さん` : greet;
  if (dateEl) {
    const d = new Date();
    const wd = ['日','月','火','水','木','金','土'][d.getDay()];
    dateEl.textContent = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${wd}） · どの世界に入りますか？`;
  }
  // コアラの判定＋画像差し替え
  updateModeHomeKoalas();
}

// Step 2: コアラ表情をデータ連動で更新
function updateModeHomeKoalas() {
  try {
    // ===== 採用運用カードのコアラ判定 =====
    const opMetrics = computeOperationMetrics();
    let opMood = 'koala-good';
    let opMsg = '対応待ちはなし、いい感じ！';
    if (opMetrics.todayInterviews >= 3) {
      opMood = 'koala-pc';
      opMsg = `今日の面接が${opMetrics.todayInterviews}件、頑張ろう`;
    } else if (opMetrics.pendingCount >= 3 || opMetrics.delayedCount >= 1) {
      opMood = 'koala-think';
      opMsg = `対応待ちが${opMetrics.pendingCount}名${opMetrics.delayedCount > 0 ? `、うち${opMetrics.delayedCount}名は遅延` : ''}`;
    } else if (opMetrics.thisMonthApplyGrowth >= 30) {
      opMood = 'koala-kira';
      opMsg = `今月の応募が好調！+${opMetrics.thisMonthApplyGrowth}%`;
    }
    setKoalaImage('mhKoalaOperation', opMood);
    const opBubble = document.getElementById('mhBubbleOperationText');
    if (opBubble) opBubble.textContent = opMsg;

    // ===== 採用分析カードのコアラ判定 =====
    const anMetrics = computeAnalyticsMetrics();
    let anMood = 'koala-pc';
    let anMsg = 'データをチェックしよう';
    if (anMetrics.cpaImprovementPct >= 10 || anMetrics.applyGrowthPct >= 20) {
      anMood = 'koala-kira';
      const goodNews = anMetrics.cpaImprovementPct >= 10
        ? `CPA改善${anMetrics.cpaImprovementPct}%！`
        : `応募+${anMetrics.applyGrowthPct}%！`;
      anMsg = goodNews;
    } else if (anMetrics.budgetWarning || anMetrics.cpaWorseningPct >= 15) {
      anMood = 'koala-think';
      anMsg = anMetrics.budgetWarning
        ? '予算消化が早いぞ、要チェック'
        : `CPAが+${anMetrics.cpaWorseningPct}%悪化`;
    } else if (anMetrics.hasData) {
      anMood = 'koala-good';
      anMsg = '採用順調、いいペース';
    } else {
      anMood = 'koala-pc';
      anMsg = 'データを見てみよう';
    }
    setKoalaImage('mhKoalaAnalytics', anMood);
    const anBubble = document.getElementById('mhBubbleAnalyticsText');
    if (anBubble) anBubble.textContent = anMsg;

    // ===== フッターコアラの一言 =====
    const footer = document.getElementById('mhFooterText');
    if (footer) {
      const phrases = [
        '今日も一緒にがんばろう',
        '採用、いい流れにしていこう',
        'ひとつずつ進めていこう',
        'あなたのペースで大丈夫',
      ];
      footer.textContent = phrases[Math.floor(Math.random() * phrases.length)];
    }
  } catch(e) {
    console.warn('[updateModeHomeKoalas] エラー', e);
  }
}

// Step 2: コアラ画像をフェードで差し替え
function setKoalaImage(imgId, mood) {
  const img = document.getElementById(imgId);
  if (!img) return;
  const newSrc = `assets/${mood}.png`;
  if (img.src.endsWith(newSrc)) return;  // 同じなら何もしない
  // フェードアウト → src変更 → フェードイン
  img.classList.add('koala-fade-out');
  setTimeout(() => {
    img.src = newSrc;
    img.alt = mood;
    img.classList.remove('koala-fade-out');
  }, 200);
}

// Step 2: 採用運用モードの指標を計算
function computeOperationMetrics() {
  const res = { pendingCount: 0, delayedCount: 0, todayInterviews: 0, thisMonthApplyGrowth: 0 };
  if (!Array.isArray(applicants) || applicants.length === 0) return res;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const thisMonth = today.toISOString().slice(0, 7);
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7);

  applicants.forEach(a => {
    // 対応待ち：コアステータスが「応募」「対応中」
    const cid = a.coreStatusId || (typeof STATUS_TO_CORE !== 'undefined' ? STATUS_TO_CORE[a.status] : null);
    if (cid === 'applied' || cid === 'in_progress' || !a.status || a.status === '応募') {
      res.pendingCount++;
      // 遅延：3日以上更新がない
      const updated = a.updatedAt || a.appDate;
      if (updated) {
        const d = new Date(updated);
        if (d < threeDaysAgo) res.delayedCount++;
      } else {
        res.delayedCount++;
      }
    }
    // 今日の面接
    const i1 = a.int1Date ? String(a.int1Date).slice(0, 10) : '';
    const i2 = a.int2Date ? String(a.int2Date).slice(0, 10) : '';
    if (i1 === todayStr) res.todayInterviews++;
    if (i2 === todayStr) res.todayInterviews++;
  });

  // 今月応募数 vs 先月応募数
  const thisMonthCount = applicants.filter(a => a.appDate && a.appDate.startsWith(thisMonth)).length;
  const prevMonthCount = applicants.filter(a => a.appDate && a.appDate.startsWith(prevMonth)).length;
  if (prevMonthCount > 0) {
    res.thisMonthApplyGrowth = Math.round((thisMonthCount - prevMonthCount) / prevMonthCount * 100);
  }
  return res;
}

// Step 2: 採用分析モードの指標を計算
function computeAnalyticsMetrics() {
  const res = {
    hasData: false,
    cpaImprovementPct: 0, cpaWorseningPct: 0,
    applyGrowthPct: 0,
    budgetWarning: false
  };
  // 広告データを使う（ad_performance_rowsから）
  if (typeof adsRows !== 'undefined' && Array.isArray(adsRows) && adsRows.length > 0) {
    res.hasData = true;
    try {
      // 当月と前月のCPA・応募を比較
      const months = {};
      adsRows.forEach(r => {
        const m = r._month;
        if (!m) return;
        if (!months[m]) months[m] = { cost: 0, apply: 0 };
        months[m].cost += Number(r.cost) || 0;
        months[m].apply += Number(r.apply) || 0;
      });
      const sortedMonths = Object.keys(months).sort();
      if (sortedMonths.length >= 2) {
        const cur = months[sortedMonths[sortedMonths.length - 1]];
        const prev = months[sortedMonths[sortedMonths.length - 2]];
        const curCpa = cur.apply > 0 ? cur.cost / cur.apply : 0;
        const prevCpa = prev.apply > 0 ? prev.cost / prev.apply : 0;
        if (prevCpa > 0 && curCpa > 0) {
          const diff = (prevCpa - curCpa) / prevCpa * 100;
          if (diff > 0) res.cpaImprovementPct = Math.round(diff);
          else res.cpaWorseningPct = Math.round(-diff);
        }
        if (prev.apply > 0) {
          res.applyGrowthPct = Math.round((cur.apply - prev.apply) / prev.apply * 100);
        }
      }
      // 予算警告：CP内予算消化率が90%超のキャンペーンがあるか
      const cpData = {};
      adsRows.forEach(r => {
        const cp = r.campaign || '';
        if (!cp) return;
        if (!cpData[cp]) cpData[cp] = { cost: 0, budget: null };
        cpData[cp].cost += Number(r.cost) || 0;
        if (cpData[cp].budget === null) {
          const budM = cp.match(/[¥￥]\s*([0-9,]+)/);
          if (budM) cpData[cp].budget = parseInt(budM[1].replace(/,/g, ''), 10);
        }
      });
      Object.values(cpData).forEach(d => {
        if (d.budget && d.budget > 0 && (d.cost / d.budget) >= 0.9) {
          res.budgetWarning = true;
        }
      });
    } catch(e) {
      console.warn('[computeAnalyticsMetrics] 広告データ集計エラー', e);
    }
  }
  // 広告データが無い場合は応募者DBで補完
  if (!res.hasData && Array.isArray(applicants) && applicants.length > 0) {
    res.hasData = true;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const prevMonthD = new Date(); prevMonthD.setMonth(prevMonthD.getMonth() - 1);
    const prevMonth = prevMonthD.toISOString().slice(0, 7);
    const thisCount = applicants.filter(a => a.appDate && a.appDate.startsWith(thisMonth)).length;
    const prevCount = applicants.filter(a => a.appDate && a.appDate.startsWith(prevMonth)).length;
    if (prevCount > 0) {
      const diff = (thisCount - prevCount) / prevCount * 100;
      if (diff >= 0) res.applyGrowthPct = Math.round(diff);
    }
  }
  return res;
}

// Step 2: モードカードクリック → 該当モードへ入る
function enterMode(mode, event) {
  // Step 5: クリック演出（リップル）
  if (event && typeof rippleEffect === 'function') {
    try { rippleEffect(event); } catch(e) {}
  }
  // 少し待ってモード遷移（リップルが見えるように）
  setTimeout(() => {
    if (typeof setMode === 'function') setMode(mode);
  }, 120);
}

// 起動時：localStorage から前回モードを復元
function restoreModeFromStorage() {
  let mode = null;
  try { mode = localStorage.getItem(SAIYO_MODE_KEY); } catch(e) {}
  if (!mode || !SAIYO_MODE_DEFS[mode]) mode = 'operation';
  // 権限チェック
  if (!isAdmin && !saiyoEnabledModes.includes(mode)) {
    mode = saiyoEnabledModes[0] || 'operation';
  }
  return mode;
}

// adminの場合のモードタブ表示制御（admin_settingsタブ常時表示）
// クライアントの場合は enabled_modes に応じてグレーアウト
function applyModeTabPermissions() {
  document.querySelectorAll('.mode-tab').forEach(btn => {
    const m = btn.dataset.mode;
    if (isAdmin) {
      btn.classList.remove('disabled');
      btn.style.display = 'inline-flex';
    } else {
      // クライアントの場合
      if (saiyoEnabledModes.includes(m)) {
        btn.classList.remove('disabled');
        btn.style.display = 'inline-flex';
      } else {
        // 将来：グレーアウト＋アップグレードモーダル
        btn.classList.add('disabled');
        btn.style.display = 'inline-flex'; // 今は全クライアント全モード許可なので実質非表示にはならない
      }
    }
    // admin_settingsはadmin向けだが、クライアントもマスター/担当者管理は触れる仕様なので
    // 表示はそのまま
  });
}

// アップグレード案内モーダル
function showUpgradeModal(targetMode) {
  const def = SAIYO_MODE_DEFS[targetMode];
  const label = def ? `${def.icon} ${def.label}` : targetMode;
  const name = def ? def.label : targetMode;
  const overlay = document.getElementById('upgradeModalOverlay');
  const modeEl = document.getElementById('upgradeModalMode');
  const nameEl = document.getElementById('upgradeModalModeName');
  if (modeEl) modeEl.textContent = label;
  if (nameEl) nameEl.textContent = `${name}モード`;
  if (overlay) overlay.style.display = 'flex';
}
function closeUpgradeModal(event) {
  // overlayクリック or 閉じるボタン
  if (event && event.target && event.target.id !== 'upgradeModalOverlay' && !event.target.classList.contains('upgrade-modal-close')) {
    return;
  }
  const overlay = document.getElementById('upgradeModalOverlay');
  if (overlay) overlay.style.display = 'none';
}
function contactForUpgrade() {
  // 将来は問い合わせフォームへリンクなど
  alert('プランのアップグレードについては、運営までお問い合わせください。');
  closeUpgradeModal();
}

// クライアントの enabled_modes を Supabase から取得
async function loadEnabledModes() {
  if (isAdmin) {
    saiyoEnabledModes = ['operation', 'analytics', 'admin_settings'];
    return;
  }
  if (!currentClientId) {
    saiyoEnabledModes = ['operation', 'analytics', 'admin_settings'];
    return;
  }
  try {
    const { data, error } = await sb.from('clients')
      .select('enabled_modes')
      .eq('client_id', currentClientId)
      .maybeSingle();
    if (!error && data && Array.isArray(data.enabled_modes) && data.enabled_modes.length > 0) {
      saiyoEnabledModes = data.enabled_modes;
    } else {
      // フィールドが無い or NULL の場合は全モード許可（デフォルト）
      saiyoEnabledModes = ['operation', 'analytics', 'admin_settings'];
    }
  } catch(e) {
    console.warn('[loadEnabledModes] エラー', e);
    saiyoEnabledModes = ['operation', 'analytics', 'admin_settings'];
  }
}

// 起動時のモード初期化（startApp から呼ばれる）
async function initModeSystem() {
  await loadEnabledModes();
  applyModeTabPermissions();
  const initialMode = restoreModeFromStorage();
  // silent=trueで初期セット（showSecからも呼ばれるため初期画面とは別管理）
  setMode(initialMode, true);
  // Step 3: 採用運用ダッシュ用「自分の担当のみ」設定の復元
  if (typeof initDashMineToggle === 'function') initDashMineToggle();
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
  if (!el) return;  // Phase D-3：書類管理セクションは削除済み
  el.innerHTML = tempDocs.map(d => `
    <div class="doc-item">
      <span class="badge bb">${d.type}</span>
      <span style="flex:1;font-size:12px;">${d.name}</span>
      <a href="${d.url}" target="_blank" style="font-size:11px;color:#378ADD;">開く</a>
      <button class="btn-del" onclick="removeDoc('${d.id}')">削除</button>
    </div>`).join('');
}

// ========================================
// Phase E：スケジュール管理
// ========================================
let _schExpanded = { today: true, interview: false, stale: false };
let _schState = { today: [], interview: [], stale: [] };

// スケジュール画面のメイン描画
async function renderSchedule() {
  // 面接データを最新化
  await buildScheduleInterviewMap();

  // adminクライアント絞り込みプルダウンを更新
  populateSchClientFilter();
  // 担当者フィルタUIを更新
  updateSchStaffFilterUI();

  // 絞り込み条件を取得
  const clientFilter = isAdmin ? (document.getElementById('schClientFilter')?.value || '') : '';
  let staffFilterId = '';
  if (isAdmin) {
    const sv = document.getElementById('schStaffFilterSelect')?.value || '';
    if (sv) staffFilterId = sv;
  } else {
    const ck = document.getElementById('schSelfFilterCheck');
    if (ck && ck.checked && currentStaffId) {
      staffFilterId = String(currentStaffId);
    }
  }

  // 対象応募者を絞り込み
  let pool = applicants.filter(a => {
    if (clientFilter && a.clientId !== clientFilter) return false;
    if (staffFilterId) {
      const sids = (a.staffIds || []).map(String);
      if (!sids.includes(staffFilterId)) return false;
    }
    // 採用/入社/退職/その他は対象外
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || '';
    if (['hired','joined','resigned','other'].includes(cid)) return false;
    return true;
  });

  // 各カテゴリ振り分け
  const today = computeTodayList(pool);
  const interview = computeWeekInterviewList(pool);
  const stale = computeStaleList(pool);

  _schState.today = today;
  _schState.interview = interview;
  _schState.stale = stale;

  // KPI数を更新
  document.getElementById('schKpiTodayN').textContent = today.length;
  document.getElementById('schKpiInterviewN').textContent = interview.length;
  document.getElementById('schKpiStaleN').textContent = stale.length;

  // パネル開閉状態を反映＆描画
  ['today','interview','stale'].forEach(cat => {
    const panel = document.getElementById('schPanel' + cat.charAt(0).toUpperCase() + cat.slice(1));
    const card  = document.getElementById('schKpi'   + cat.charAt(0).toUpperCase() + cat.slice(1));
    if (panel) panel.style.display = _schExpanded[cat] ? 'block' : 'none';
    if (card) card.style.borderColor = _schExpanded[cat] ? '#1a1a1a' : 'transparent';
  });
  renderSchList('today', today);
  renderSchList('interview', interview);
  renderSchList('stale', stale);

  // ベル通知も更新
  refreshBellNotifications();
}

// admin用クライアント絞り込みプルダウン
function populateSchClientFilter() {
  const sel = document.getElementById('schClientFilter');
  if (!sel) return;
  if (!isAdmin) {
    sel.style.display = 'none';
    return;
  }
  sel.style.display = '';
  const cur = sel.value;
  const cids = [...new Set(applicants.map(a => a.clientId).filter(Boolean))];
  sel.innerHTML = `<option value="">全クライアント</option>` + cids.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  sel.value = cur;
}

// 担当者フィルタUI（クライアント=チェック、admin=プルダウン）
function updateSchStaffFilterUI() {
  const selfLabel = document.getElementById('schSelfFilterLabel');
  const adminSel  = document.getElementById('schStaffFilterSelect');
  if (isAdmin) {
    if (selfLabel) selfLabel.style.display = 'none';
    if (adminSel) {
      adminSel.style.display = '';
      const cur = adminSel.value;
      const opts = (staffList || []).filter(s => !s.is_resigned);
      const byClient = {};
      opts.forEach(s => {
        const cid = s.client_id || '_';
        if (!byClient[cid]) byClient[cid] = [];
        byClient[cid].push(s);
      });
      let html = `<option value="">担当者で絞り込み（全て）</option>`;
      Object.entries(byClient).forEach(([cid, list]) => {
        html += `<optgroup label="${escapeHtml(cid)}">`;
        list.forEach(s => {
          html += `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.name)}</option>`;
        });
        html += `</optgroup>`;
      });
      adminSel.innerHTML = html;
      adminSel.value = cur;
    }
  } else {
    if (selfLabel) selfLabel.style.display = 'inline-flex';
    if (adminSel) adminSel.style.display = 'none';
    const ck = document.getElementById('schSelfFilterCheck');
    if (ck && !currentStaffId) {
      ck.checked = false;
      ck.disabled = true;
      if (selfLabel) selfLabel.style.opacity = '0.5';
    } else if (ck) {
      ck.disabled = false;
      if (selfLabel) selfLabel.style.opacity = '';
    }
  }
}

// 「今日対応すべき人」の判定
// 未選択(NULL)/応募/対応中/面接日程未確定/面接前日・当日・翌日 を抽出
function computeTodayList(pool) {
  const result = [];
  const todayStr = new Date().toISOString().slice(0,10);
  pool.forEach(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || null;
    let reason = '';
    let highlight = '';
    if (!a.status || !cid) {
      reason = 'ステータス未入力';
      highlight = '対応';
    } else if (cid === 'applied') {
      reason = '初回連絡';
      highlight = '応募';
    } else if (cid === 'in_progress') {
      reason = '対応中';
      highlight = '対応中';
    } else if (cid === 'interview') {
      // 面接の日程確認
      const ivs = (window._scheduleInterviewMap && window._scheduleInterviewMap[a.id]) || [];
      const pendingIvs = ivs.filter(iv => iv.result === 'pending' || !iv.result);
      // 日程未確定の面接があれば対象
      const unsetIv = pendingIvs.find(iv => !iv.scheduled_at);
      if (unsetIv) {
        reason = '面接日程未確定';
        highlight = '日程確定要';
      } else {
        // 直近の面接日が前日/当日/翌日なら対象
        const nearestIv = pendingIvs
          .filter(iv => iv.scheduled_at)
          .sort((x,y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
        if (nearestIv) {
          const ivDate = nearestIv.scheduled_at.slice(0,10);
          const diff = dateDiffDays(todayStr, ivDate); // ivDate - today
          if (diff >= -1 && diff <= 1) {
            reason = diff === 0 ? '本日面接' : (diff === 1 ? '明日面接' : '昨日面接');
            highlight = ivDate;
          } else if (diff >= 2) {
            // 翌々日以降は「今日対応」ではないのでスキップ
            return;
          }
        } else {
          return; // 面接ステータスだが面接予定なし → スキップ
        }
      }
    } else {
      return;
    }
    if (reason) result.push({ applicant: a, reason, highlight });
  });
  return result;
}

// 「今週の面接」リスト
function computeWeekInterviewList(pool) {
  const result = [];
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  // 今週末日（日曜まで）
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 6);
  const endStr = endDate.toISOString().slice(0,10);
  pool.forEach(a => {
    const ivs = (window._scheduleInterviewMap && window._scheduleInterviewMap[a.id]) || [];
    ivs.forEach(iv => {
      if (!iv.scheduled_at) return;
      const ivDate = iv.scheduled_at.slice(0,10);
      if (ivDate >= todayStr && ivDate <= endStr) {
        if (iv.result === 'pending' || !iv.result) {
          result.push({ applicant: a, interview: iv });
        }
      }
    });
  });
  result.sort((x,y) => x.interview.scheduled_at.localeCompare(y.interview.scheduled_at));
  return result;
}

// 「放置警告」リスト
function computeStaleList(pool) {
  const result = [];
  const todayStr = new Date().toISOString().slice(0,10);
  pool.forEach(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || null;
    let threshold = 0; // 何日経過で警告か
    let baseDate = '';
    let reason = '';

    if (!a.status || !cid) {
      threshold = 2;
      baseDate = a.appDate || a.createdAt || '';
      reason = 'ステータス未入力';
    } else if (cid === 'applied') {
      threshold = 2;
      baseDate = a.appDate || a.createdAt || '';
      reason = '応募から動きなし';
    } else if (cid === 'in_progress') {
      threshold = 3;
      baseDate = a.updatedAt || a.appDate || '';
      reason = '対応中で動きなし';
    } else if (cid === 'interview') {
      const ivs = (window._scheduleInterviewMap && window._scheduleInterviewMap[a.id]) || [];
      const pendingIvs = ivs.filter(iv => iv.result === 'pending' || !iv.result);
      const unsetIv = pendingIvs.find(iv => !iv.scheduled_at);
      if (unsetIv) {
        threshold = 3;
        baseDate = a.updatedAt || a.appDate || '';
        reason = '面接日程未確定（3日経過）';
      } else {
        const lastIv = pendingIvs
          .filter(iv => iv.scheduled_at)
          .sort((x,y) => y.scheduled_at.localeCompare(x.scheduled_at))[0];
        if (lastIv) {
          const ivDate = lastIv.scheduled_at.slice(0,10);
          const diff = dateDiffDays(ivDate, todayStr); // today - ivDate
          if (diff >= 2) {
            threshold = 0;
            baseDate = ivDate;
            reason = `面接から${diff}日経過`;
          } else {
            return;
          }
        } else {
          return;
        }
      }
    } else {
      return;
    }

    if (!baseDate) return;
    const diff = dateDiffDays(baseDate, todayStr);
    if (diff >= threshold) {
      result.push({ applicant: a, reason, days: diff });
    }
  });
  return result.sort((x,y) => y.days - x.days);
}

// 日付差を返す（dateB - dateA、日数）
function dateDiffDays(dateA, dateB) {
  if (!dateA || !dateB) return 0;
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// パネル開閉
function toggleSchPanel(cat) {
  _schExpanded[cat] = !_schExpanded[cat];
  const panel = document.getElementById('schPanel' + cat.charAt(0).toUpperCase() + cat.slice(1));
  const card  = document.getElementById('schKpi'   + cat.charAt(0).toUpperCase() + cat.slice(1));
  if (panel) panel.style.display = _schExpanded[cat] ? 'block' : 'none';
  if (card) card.style.borderColor = _schExpanded[cat] ? '#1a1a1a' : 'transparent';
}

// リスト描画（カテゴリごと）
function renderSchList(cat, items) {
  const cont = document.getElementById('schList' + cat.charAt(0).toUpperCase() + cat.slice(1));
  if (!cont) return;
  if (!items.length) {
    cont.innerHTML = `<div style="padding:14px;font-size:11px;color:#aaa;text-align:center;">該当者はいません 🎉</div>`;
    return;
  }
  cont.innerHTML = items.map(it => {
    const a = it.applicant;
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    const coreName = getCoreStatusName(cid);
    const coreColor = getCoreStatusColor(cid);
    let rightHtml = '';
    if (cat === 'today') {
      rightHtml = `<span style="font-size:10px;background:#FAFAFA;color:#666;padding:2px 7px;border-radius:9px;border:1px solid #eee;">${escapeHtml(it.reason)}</span>`;
      if (it.highlight) {
        rightHtml += ` <span style="font-size:10px;color:#993C1D;font-weight:600;margin-left:4px;">${escapeHtml(it.highlight)}</span>`;
      }
    } else if (cat === 'interview') {
      const iv = it.interview;
      const dt = iv.scheduled_at ? formatDateTime(iv.scheduled_at) : '日程未定';
      const typ = iv.interview_type === 'other' ? (iv.type_other || 'その他') : (iv.interview_type || '面接');
      rightHtml = `<span style="font-size:10px;background:#EEEDFE;color:#3C3489;padding:2px 7px;border-radius:9px;font-weight:600;">${escapeHtml(typ)}</span> <span style="font-size:11px;color:#3C3489;font-weight:600;margin-left:6px;">${escapeHtml(dt)}</span>`;
    } else if (cat === 'stale') {
      rightHtml = `<span style="font-size:10px;color:#854F0B;font-weight:600;">${it.days}日経過</span> <span style="font-size:10px;color:#aaa;margin-left:6px;">${escapeHtml(it.reason)}</span>`;
    }
    const subInfo = `${escapeHtml(a.jobType||'')} ${escapeHtml(a.media ? '/'+a.media : '')}`;
    return `<div onclick="openApplicantEdit('${escapeHtml(String(a.id))}')" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#FAFAFA;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid transparent;" onmouseover="this.style.borderColor='#1a1a1a';this.style.background='#fff'" onmouseout="this.style.borderColor='transparent';this.style.background='#FAFAFA'">
      <div>
        <span style="font-weight:600;">${escapeHtml(a.name||'(名前なし)')}</span>
        <span style="color:#aaa;font-size:10px;margin-left:6px;">${subInfo}</span>
        <span style="font-size:10px;background:${coreColor};color:#fff;padding:2px 7px;border-radius:9px;margin-left:6px;">${escapeHtml(coreName)}</span>
      </div>
      <div>${rightHtml}</div>
    </div>`;
  }).join('');
}

// 日時フォーマット（YYYY-MM-DDTHH:MM 形式 → "5/8(月) 14:00"）
function formatDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const wk = ['日','月','火','水','木','金','土'][d.getDay()];
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${m}/${day}(${wk}) ${hh}:${mm}`;
  } catch(e) { return iso; }
}

// スケジュール画面で使う面接マップを構築（applicant_id → interviews配列）
async function buildScheduleInterviewMap() {
  try {
    let q = sb.from('interviews').select('*');
    if (!isAdmin && currentClientId && currentClientId !== 'admin') {
      q = q.eq('client_id', currentClientId);
    }
    const { data, error } = await q;
    if (error) { console.warn('interviews fetch error', error); return; }
    const map = {};
    (data || []).forEach(iv => {
      const aid = iv.applicant_id;
      if (!map[aid]) map[aid] = [];
      map[aid].push(iv);
    });
    window._scheduleInterviewMap = map;
  } catch(e) { console.warn('buildScheduleInterviewMap error', e); }
}

// ========================================
// Phase E：ベル通知
// ========================================
function toggleBellPanel() {
  const panel = document.getElementById('bellPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // 開く時に最新化
    refreshBellNotifications();
    setTimeout(() => {
      document.addEventListener('click', function closeBP(e) {
        if (!panel.contains(e.target) && !e.target.closest('#bellBtn')) {
          panel.style.display = 'none';
          document.removeEventListener('click', closeBP);
        }
      });
    }, 100);
  }
}

// ベル通知の中身を更新
function refreshBellNotifications() {
  const list = document.getElementById('bellList');
  const badge = document.getElementById('bellBadge');
  if (!list) return;
  // 通知 = 今日対応・今週の面接（前日/当日のみ）・放置警告
  const notifications = [];
  // 今日対応
  (_schState.today || []).slice(0, 5).forEach(it => {
    notifications.push({
      type: 'today',
      title: it.applicant.name || '(名前なし)',
      desc: it.reason,
      applicantId: it.applicant.id,
      color: '#993C1D'
    });
  });
  // 今週の面接（明日まで）
  const todayStr = new Date().toISOString().slice(0,10);
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
  (_schState.interview || []).forEach(it => {
    if (!it.interview.scheduled_at) return;
    const ivDate = it.interview.scheduled_at.slice(0,10);
    if (ivDate <= tomorrowStr) {
      const dt = formatDateTime(it.interview.scheduled_at);
      notifications.push({
        type: 'interview',
        title: it.applicant.name || '(名前なし)',
        desc: `面接予定 ${dt}`,
        applicantId: it.applicant.id,
        color: '#3C3489'
      });
    }
  });
  // 放置警告
  (_schState.stale || []).slice(0, 5).forEach(it => {
    notifications.push({
      type: 'stale',
      title: it.applicant.name || '(名前なし)',
      desc: `${it.days}日経過 / ${it.reason}`,
      applicantId: it.applicant.id,
      color: '#854F0B'
    });
  });
  // 描画
  if (notifications.length === 0) {
    list.innerHTML = `<div style="padding:14px;font-size:11px;color:#aaa;text-align:center;">通知はありません 🎉</div>`;
    if (badge) badge.style.display = 'none';
  } else {
    list.innerHTML = notifications.map(n => {
      return `<div onclick="openApplicantEdit('${escapeHtml(String(n.applicantId))}');toggleBellPanel();" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f5f5f3;" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background='transparent'">
        <div style="font-size:12px;font-weight:600;color:#1a1a1a;">${escapeHtml(n.title)}</div>
        <div style="font-size:10px;color:${n.color};margin-top:2px;">${escapeHtml(n.desc)}</div>
      </div>`;
    }).join('');
    if (badge) {
      badge.style.display = 'inline-block';
      badge.textContent = String(notifications.length);
    }
  }
}

// ========================================
// 一覧
// ========================================
function clearDateFilter() {
  const a = document.getElementById('fDateFrom'); if (a) a.value = '';
  const b = document.getElementById('fDateTo');   if (b) b.value = '';
  renderList();
}

// ========================================
// Phase E/F：詳細絞り込みパネル
// ========================================
// 新方式の絞り込み状態（パネルで決めて適用すると multiFilterState に反映される）
// 単一値のみ管理する
let panelFilterState = {
  coreStatus: '',
  detailStatus: '',
  media: '',
  jobType: '',
  dept: '',
  dateFrom: '',
  dateTo: ''
};

// パネルを開く
function openFilterPanel() {
  // パネル内のセレクトを最新の選択肢で埋める
  populateFilterPanelSelects();
  // 現在の状態をパネルに反映
  document.getElementById('fpCoreStatus').value = panelFilterState.coreStatus || '';
  document.getElementById('fpDetailStatus').value = panelFilterState.detailStatus || '';
  document.getElementById('fpMedia').value = panelFilterState.media || '';
  document.getElementById('fpJobType').value = panelFilterState.jobType || '';
  document.getElementById('fpDept').value = panelFilterState.dept || '';
  const df = document.getElementById('fDateFrom'); if (df) df.value = panelFilterState.dateFrom || '';
  const dt = document.getElementById('fDateTo');   if (dt) dt.value = panelFilterState.dateTo || '';
  // 表示
  const overlay = document.getElementById('filterPanelOverlay');
  if (overlay) overlay.style.display = 'block';
}

function closeFilterPanel(e) {
  if (e && e.target.id !== 'filterPanelOverlay') return;
  const overlay = document.getElementById('filterPanelOverlay');
  if (overlay) overlay.style.display = 'none';
}

// パネル内セレクトに選択肢を流し込む
function populateFilterPanelSelects() {
  // 詳細ステータス
  const dsEl = document.getElementById('fpDetailStatus');
  if (dsEl) {
    const cur = dsEl.value;
    const list = (detailStatuses || []).map(s => s.name);
    dsEl.innerHTML = `<option value="">全て</option>` + list.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    dsEl.value = cur;
  }
  // 媒体
  fillSelectFromApplicants('fpMedia', 'media');
  // 職種
  fillSelectFromApplicants('fpJobType', 'jobType');
  // 部署
  fillSelectFromApplicants('fpDept', 'dept');
}

function fillSelectFromApplicants(elId, fieldName) {
  const el = document.getElementById(elId);
  if (!el) return;
  const cur = el.value;
  const set = new Set();
  applicants.forEach(a => { if (a[fieldName]) set.add(a[fieldName]); });
  const opts = [...set].sort();
  el.innerHTML = `<option value="">全て</option>` + opts.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  el.value = cur;
}

// パネルの「適用」
function applyFilterPanel() {
  panelFilterState.coreStatus = document.getElementById('fpCoreStatus').value || '';
  panelFilterState.detailStatus = document.getElementById('fpDetailStatus').value || '';
  panelFilterState.media = document.getElementById('fpMedia').value || '';
  panelFilterState.jobType = document.getElementById('fpJobType').value || '';
  panelFilterState.dept = document.getElementById('fpDept').value || '';
  panelFilterState.dateFrom = document.getElementById('fDateFrom').value || '';
  panelFilterState.dateTo = document.getElementById('fDateTo').value || '';
  closeFilterPanel({ target: { id: 'filterPanelOverlay' } });
  renderList();
}

// パネルの「クリア」 と 全てクリア
function clearAllFilters() {
  panelFilterState = { coreStatus:'', detailStatus:'', media:'', jobType:'', dept:'', dateFrom:'', dateTo:'' };
  // パネルのUIもリセット
  ['fpCoreStatus','fpDetailStatus','fpMedia','fpJobType','fpDept'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const df = document.getElementById('fDateFrom'); if (df) df.value = '';
  const dt = document.getElementById('fDateTo');   if (dt) dt.value = '';
  renderList();
}

// 個別チップの×でその条件だけ解除
function removePanelFilter(key) {
  if (key === 'date') {
    panelFilterState.dateFrom = '';
    panelFilterState.dateTo = '';
    const df = document.getElementById('fDateFrom'); if (df) df.value = '';
    const dt = document.getElementById('fDateTo');   if (dt) dt.value = '';
  } else {
    panelFilterState[key] = '';
    const el = document.getElementById('fp' + key.charAt(0).toUpperCase() + key.slice(1));
    if (el) el.value = '';
  }
  renderList();
}

// 並び替えセレクトの変更
function onSortChange() {
  const v = document.getElementById('sortSelect').value;
  if (!v) return;
  const [key, dir] = v.split(':');
  sortKeys = [{ key, dir: dir === 'asc' ? 1 : -1 }];
  renderList();
}

// アクティブチップを描画
function renderActiveFilterChips() {
  const cont = document.getElementById('activeFilterChips');
  if (!cont) return;
  const chips = [];
  const labels = {
    coreStatus: 'ステータス', detailStatus: '詳細', media: '媒体',
    jobType: '職種', dept: '部署'
  };
  // コアステータスはIDから日本語名へ
  const coreLabelMap = { applied:'応募', in_progress:'対応中', interview:'面接', hired:'採用', joined:'入社', resigned:'退職', other:'その他' };
  Object.entries(panelFilterState).forEach(([key, val]) => {
    if (key === 'dateFrom' || key === 'dateTo') return;
    if (!val) return;
    let display = val;
    if (key === 'coreStatus') display = coreLabelMap[val] || val;
    chips.push(`<span class="fchip">${labels[key]}：${escapeHtml(display)}<span class="fchip-x" onclick="removePanelFilter('${key}')">×</span></span>`);
  });
  if (panelFilterState.dateFrom || panelFilterState.dateTo) {
    const f = panelFilterState.dateFrom || '...';
    const t = panelFilterState.dateTo || '...';
    chips.push(`<span class="fchip">応募日：${f}〜${t}<span class="fchip-x" onclick="removePanelFilter('date')">×</span></span>`);
  }
  if (chips.length === 0) {
    cont.style.display = 'none';
    cont.innerHTML = '';
  } else {
    cont.style.display = 'flex';
    cont.innerHTML = chips.join('') + `<span class="fchip-clear" onclick="clearAllFilters()">全てクリア</span>`;
  }
  // バッジ更新（パネルボタンの数字）
  const badge = document.getElementById('filterCountBadge');
  if (badge) {
    const cnt = chips.length;
    if (cnt > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = String(cnt);
    } else {
      badge.style.display = 'none';
    }
  }
}

// 担当者プルダウン（admin用）／自分の担当のみチェックボックス（クライアント用）の表示切替
function updateStaffFilterUIForListPage() {
  const selfLabel = document.getElementById('selfFilterLabel');
  const adminSel  = document.getElementById('staffFilterSelect');
  if (isAdmin) {
    if (selfLabel) selfLabel.style.display = 'none';
    if (adminSel) {
      adminSel.style.display = '';
      // 担当者プルダウンに値を流し込む（admin時：staff全件）
      const cur = adminSel.value;
      const opts = (staffList || []).filter(s => !s.is_resigned).map(s => s);
      // クライアント別グループ表示
      const byClient = {};
      opts.forEach(s => {
        const cid = s.client_id || '_';
        if (!byClient[cid]) byClient[cid] = [];
        byClient[cid].push(s);
      });
      let html = `<option value="">担当者で絞り込み（全て）</option><option value="__none__">未割当のみ</option>`;
      Object.entries(byClient).forEach(([cid, list]) => {
        html += `<optgroup label="${escapeHtml(cid)}">`;
        list.forEach(s => {
          html += `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.name)}</option>`;
        });
        html += `</optgroup>`;
      });
      adminSel.innerHTML = html;
      adminSel.value = cur;
    }
  } else {
    // クライアント：自分の担当のみチェックボックスを表示
    if (selfLabel) selfLabel.style.display = 'inline-flex';
    if (adminSel) adminSel.style.display = 'none';
    // 担当者選択していなかったらチェックを外す＋無効化
    const ck = document.getElementById('selfFilterCheck');
    if (ck && !currentStaffId) {
      ck.checked = false;
      ck.disabled = true;
      if (selfLabel) selfLabel.style.opacity = '0.5';
    } else if (ck) {
      ck.disabled = false;
      if (selfLabel) selfLabel.style.opacity = '';
    }
  }
}

function toggleSortPanel() {
  // 旧UI互換のため残置（新UIでは未使用）
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
  ['appDate','name','jobType','dept','media','status','updatedAt'].forEach(k=>{
    const el=document.getElementById('sck_'+k); if(el) el.checked=(k===key);
  });
  const descEl=document.getElementById('sDirDesc');
  const ascEl=document.getElementById('sDirAsc');
  if(descEl&&ascEl){ const d=sortKeys[0].dir===-1; descEl.checked=d; ascEl.checked=!d; }
  const lbl=document.getElementById('sortLabel');
  const labels={appDate:'応募日',name:'名前',jobType:'職種',dept:'部署',media:'媒体',status:'ステータス',updatedAt:'更新日'};
  if(lbl) lbl.textContent=(labels[key]||key)+(sortKeys[0]&&sortKeys[0].dir===-1?'↓':'↑');
  // ヘッダーのスパン更新
  ['appDate','name','jobType','dept','updatedAt'].forEach(k=>{
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
  // adminのクライアント絞り込みプルダウンを毎回更新
  populateAppClientFilter();
  // Phase E/F：担当者フィルタUIを更新
  updateStaffFilterUIForListPage();
  // Phase G：重複応募者マップを再構築
  buildDuplicateMap();

  const q = (document.getElementById('srch').value || '').toLowerCase();
  // 新方式：パネル状態から取得
  const fDateFrom = panelFilterState.dateFrom || '';
  const fDateTo = panelFilterState.dateTo || '';
  const fpCore = panelFilterState.coreStatus || '';
  const fpDetail = panelFilterState.detailStatus || '';
  const fpMedia = panelFilterState.media || '';
  const fpJobType = panelFilterState.jobType || '';
  const fpDept = panelFilterState.dept || '';

  // adminのクライアント絞り込み値
  const appClientFilter = isAdmin ? (document.getElementById('appClientFilter')?.value || '') : '';

  // Phase F：担当者フィルタ（admin = プルダウン、クライアント = チェックボックス）
  let staffFilterId = '';
  let staffFilterMode = ''; // '' | 'self' | 'admin' | 'unassigned'
  if (isAdmin) {
    const sv = document.getElementById('staffFilterSelect')?.value || '';
    if (sv === '__none__') staffFilterMode = 'unassigned';
    else if (sv) { staffFilterMode = 'admin'; staffFilterId = sv; }
  } else {
    const ck = document.getElementById('selfFilterCheck');
    if (ck && ck.checked && currentStaffId) {
      staffFilterMode = 'self';
      staffFilterId = String(currentStaffId);
    }
  }

  let fil = applicants.filter(a => {
    if (q && !(a.name||'').toLowerCase().includes(q) && !(a.email||'').toLowerCase().includes(q)) return false;
    if (fpCore && a.coreStatusId !== fpCore) return false;
    if (fpDetail && a.status !== fpDetail) return false;
    if (fpMedia && a.media !== fpMedia) return false;
    if (fpJobType && a.jobType !== fpJobType) return false;
    if (fpDept && a.dept !== fpDept) return false;
    if (fDateFrom && a.appDate && a.appDate < fDateFrom) return false;
    if (fDateTo && a.appDate && a.appDate > fDateTo) return false;
    if (appClientFilter && a.clientId !== appClientFilter) return false;
    // Phase F：担当者フィルタ
    if (staffFilterMode === 'unassigned') {
      if ((a.staffIds || []).length > 0) return false;
    } else if (staffFilterMode === 'self' || staffFilterMode === 'admin') {
      if (!(a.staffIds || []).map(String).includes(staffFilterId)) return false;
    }
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
  // 表示中のリストを保持（CSV出力で参照）
  window._currentListView = fil;
  document.getElementById('listCnt').textContent = fil.length + '件' + (fil.length !== applicants.length ? ' / 全'+applicants.length+'件' : '');
  // チップ描画
  renderActiveFilterChips();
  const tb = document.getElementById('listBody');
  const em = document.getElementById('emptyList');
  if (!fil.length) { tb.innerHTML = ''; em.style.display = 'block'; return; }
  em.style.display = 'none';

  // admin かつ クライアント絞り込みなし時はグルーピング表示
  const useGrouping = isAdmin && !appClientFilter;

  if (useGrouping) {
    // クライアントID別にグループ化
    const groups = {};
    fil.forEach(a => {
      const cid = a.clientId || '_no_client';
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push(a);
    });
    const sortedGroups = Object.entries(groups)
      .map(([cid, items]) => ({
        cid: cid === '_no_client' ? null : cid,
        name: cid === '_no_client' ? '（未割当）' : getClientDisplayName(cid),
        items
      }))
      .sort((a, b) => {
        if (!a.cid && b.cid) return 1;
        if (a.cid && !b.cid) return -1;
        return a.name.localeCompare(b.name, 'ja');
      });
    tb.innerHTML = sortedGroups.map(g => {
      const headerRow = `<tr class="client-group-header">
        <td colspan="13" style="padding:10px 12px;background:linear-gradient(90deg,#f0faf6,#fafcfb);border-top:2px solid #5aaa8e;border-bottom:1px solid #c8d6d2;font-size:12px;font-weight:700;color:#2a4a3e;">
          🏢 ${escapeOwnerHtml(g.name)}　<span style="font-size:11px;color:#888;font-weight:500;">（${g.items.length}件）</span>
        </td>
      </tr>`;
      const rows = g.items.map(a => buildAppRowHTML(a)).join('');
      return headerRow + rows;
    }).join('');
  } else {
    // 通常表示（client、またはadminで特定クライアント絞り込み中）
    tb.innerHTML = fil.map(a => buildAppRowHTML(a)).join('');
  }
}

// 応募者1行分のHTMLを生成（共通化）
function buildAppRowHTML(a) {
  // 面接日時を MM/DD コンパクト形式に
  const fmtIntDate = (v) => {
    if (!v) return '<span class="list-col-int list-col-empty">-</span>';
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return `<span class="list-col-int has-value">${v}</span>`;
    return `<span class="list-col-int has-value">${m[2]}/${m[3]}</span>`;
  };
  const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

  // Phase C-1：コアステータスバッジ
  const coreColor = getCoreStatusColor(coreId);
  const coreName = getCoreStatusName(coreId);
  const coreBadge = `<span class="core-badge" style="background:${coreColor}1f;color:${coreColor};border:1px solid ${coreColor}40;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:600;white-space:nowrap;">${coreName}</span>`;

  // Phase C-1：詳細ステータス（テキスト）
  const detailText = a.status ? esc(a.status) : '<span class="list-col-empty">-</span>';

  // Phase C-1（D-2修正）：面接日（interviewsテーブルから「予定」あるいは「最新」を表示）
  let interviewCell = '<span class="list-col-empty">-</span>';
  const ivList = a.interviews || [];
  if (ivList.length) {
    // 優先順位：
    //   1) 結果=未実施 かつ 日程あり の中で日付が一番新しいもの（次の予定）
    //   2) 結果に関わらず 日程あり で一番新しいもの
    let pick = null;
    const futureUnscheduled = ivList.filter(iv => iv.scheduled_at && iv.result === 'pending');
    if (futureUnscheduled.length) {
      futureUnscheduled.sort((x, y) => String(y.scheduled_at).localeCompare(String(x.scheduled_at)));
      pick = futureUnscheduled[0];
    } else {
      const withDate = ivList.filter(iv => iv.scheduled_at);
      if (withDate.length) {
        withDate.sort((x, y) => String(y.scheduled_at).localeCompare(String(x.scheduled_at)));
        pick = withDate[0];
      }
    }
    if (pick && pick.scheduled_at) {
      const m = String(pick.scheduled_at).match(/^(\d{4})-(\d{2})-(\d{2})/);
      const dispDate = m ? `${m[2]}/${m[3]}` : pick.scheduled_at;
      const typeShort = (pick.interview_type === 'その他' ? (pick.type_other || 'その他') : (pick.interview_type || ''));
      // 短縮表示（例：「1次面接」→「1次」、「最終面接」→「最終」）
      const shortLabel = typeShort.replace('面接', '').replace('面談', '');
      interviewCell = `<span style="font-weight:500;">${dispDate}</span><span style="color:#aaa;font-size:10px;margin-left:3px;">${esc(shortLabel)}</span>`;
    }
  }

  // Phase C-1：担当者バッジ（人数バッジ形式）
  let staffCell = '<span class="list-col-empty" style="font-size:10.5px;">未割当</span>';
  if (a.staffIds && a.staffIds.length) {
    const staffNames = a.staffIds.map(sid => {
      const s = staffList.find(x => String(x.id) === String(sid));
      return s ? s.name : null;
    }).filter(Boolean);
    if (staffNames.length === 1) {
      staffCell = `<span style="font-size:11px;">${esc(staffNames[0])}</span>`;
    } else if (staffNames.length > 1) {
      const tip = staffNames.join('、');
      staffCell = `<span style="font-size:11px;" title="${esc(tip)}">${esc(staffNames[0])}</span><span style="background:#e8f1fc;color:#185FA5;padding:1px 5px;border-radius:8px;font-size:9.5px;margin-left:2px;" title="${esc(tip)}">+${staffNames.length - 1}</span>`;
    }
  }

  // Phase C-1：更新日（MM/DD）
  let updatedCell = '<span class="list-col-empty">-</span>';
  if (a.updatedAt) {
    const m = String(a.updatedAt).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) updatedCell = `<span style="color:#888;">${m[2]}/${m[3]}</span>`;
  }

  // 名前を青リンク化（クリックで詳細展開、Phase C-2で編集画面へ変更予定）
  // 名前の右に「30/男」のような年齢/性別の補足を追加（性別で色分け）
  let ageGenderText = '';
  if (a.age || a.gender) {
    // 性別による色分け
    let agColor = '#888';
    const g = String(a.gender || '').trim();
    if (g === '男' || g === '男性' || /^m(ale)?$/i.test(g)) {
      agColor = '#378ADD'; // 青
    } else if (g === '女' || g === '女性' || /^f(emale)?$/i.test(g)) {
      agColor = '#D4537E'; // ピンク
    }
    const parts = [];
    if (a.age) parts.push(a.age);
    if (a.gender) parts.push(a.gender);
    ageGenderText = `<span style="color:${agColor};font-size:10.5px;margin-left:6px;font-weight:500;">${esc(parts.join('/'))}</span>`;
  }
  const dupBadge = getDuplicateBadge(a.id);
  const nameLink = `<a href="javascript:void(0)" onclick="event.stopPropagation();openApplicantEdit('${a.id}')" style="color:#185FA5;text-decoration:underline;text-underline-offset:2px;font-weight:500;cursor:pointer;">${esc(a.name||'')}</a>${dupBadge}${ageGenderText}`;

  return `<tr id="row_${a.id}" style="${rowBg}">
      <td style="width:36px;" onclick="event.stopPropagation()">
        <input type="checkbox" class="rowCheck" value="${a.id}" onchange="onCheckChange()" style="cursor:pointer;width:14px;height:14px;">
      </td>
      <td>${a.appDate||''}</td>
      <td>${nameLink}</td>
      <td>${jobNoCell}</td>
      <td>${jobNameCell}</td>
      <td title="${esc(a.jobType||'')}">${a.jobType||''}</td>
      <td title="${esc(a.dept||'')}">${a.dept ? esc(a.dept) : '<span class="list-col-empty">-</span>'}</td>
      <td class="list-col-email">${a.email ? `<span title="${esc(a.email)}">${esc(a.email)}</span>` : '<span class="list-col-empty">-</span>'}</td>
      <td>${a.media?`<span class="badge bb">${a.media}</span>`:''}</td>
      <td id="coreBadgeCell_${a.id}">${coreBadge}</td>
      <td onclick="event.stopPropagation()">
        <select onchange="updateStatus('${a.id}', this.value)" style="padding:3px 6px;border:1px solid #ddd;border-radius:6px;font-size:11px;font-family:inherit;background:#fafafa;color:#1a1a1a;cursor:pointer;max-width:130px;" onclick="event.stopPropagation()">
          <option value="">-</option>
          ${(masters.status||[]).map(s=>`<option value="${s}" ${a.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>${interviewCell}</td>
      <td class="list-col-memo" title="${esc(a.memo||'')}">${a.memo ? esc(a.memo) : '<span class="list-col-empty">-</span>'}</td>
      <td>${updatedCell}</td>
      <td onclick="event.stopPropagation()" style="text-align:center;white-space:nowrap;">
        <button onclick="openApplicantEdit('${a.id}')" title="編集" style="padding:4px 10px;background:#fff;border:0.5px solid #5aaa8e;border-radius:6px;font-size:10.5px;cursor:pointer;color:#5aaa8e;font-family:inherit;font-weight:500;white-space:nowrap;">✏ 編集</button>
        ${a.email ? `<button onclick="openEmailComposer('${a.id}')" title="メール送信" style="padding:4px 8px;background:#fff;border:0.5px solid #185FA5;border-radius:6px;font-size:10.5px;cursor:pointer;color:#185FA5;font-family:inherit;font-weight:500;margin-left:4px;">📧</button>` : ''}
      </td>
    </tr>
    <tr id="detail_${a.id}" style="display:none;"><td colspan="15" style="padding:0;"></td></tr>`;
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
  // 旧値を保持
  const a = applicants.find(x => x.id === id);
  const oldStatus = a ? a.status : '';
  let query = sb.from('applicants').update({ status: val, core_status_id: newCoreId }).eq('id', id);
  if (!isAdmin) query = query.eq('client_id', currentClientId);
  const { error } = await query;
  if (error) { alert('更新に失敗しました: ' + error.message); return; }
  if (a) {
    a.status = val;
    a.coreStatusId = newCoreId;
  }
  // 平均リードタイムのキャッシュをクリア（次の分析画面表示時に再計算）
  _leadTimeMap = null;
  setStatus('ステータスを更新しました', 'ok');
  // 親ステータスバッジ（左隣の「対応中/面接/採用…」のセル）を即時更新
  const coreCell = document.getElementById('coreBadgeCell_' + id);
  if (coreCell && newCoreId) {
    const coreColor = getCoreStatusColor(newCoreId);
    const coreName = getCoreStatusName(newCoreId);
    coreCell.innerHTML = `<span class="core-badge" style="background:${coreColor}1f;color:${coreColor};border:1px solid ${coreColor}40;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:600;white-space:nowrap;">${coreName}</span>`;
  }
  // Phase D-1：ステータス変更イベント記録
  if (oldStatus !== val) {
    const oldDisp = oldStatus || '(未設定)';
    const newDisp = val || '(未設定)';
    await recordEvent(id, 'status_change', `ステータス変更：${oldDisp} → ${newDisp}`, null, { old: oldStatus, new: val });
  }
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
// 応募者編集画面（Phase C-2：タブUI、担当者選択）
// ========================================

// 編集する応募者の現在のtabをグローバルで保持
let editCurrentTab = 'basic';
// 編集中の選択担当者ID配列
let editSelectedStaffIds = [];

// 一覧から名前リンクをクリックしたときに呼ばれる：編集画面を開く
async function openApplicantEdit(id) {
  const a = applicants.find(x => x.id === id);
  if (!a) return;
  editId = a.id;
  // 担当者リストを最新化（admin時は読み込まれていない可能性もある）
  try { await loadStaff(); } catch(e) { console.warn('[openApplicantEdit] loadStaff失敗', e); }
  // フォームに値をロード（既存editApp相当）
  const map = {fAD:'appDate',fJT:'jobType',fJobNo:'jobNo',fJobName:'jobName',fLoc:'location',fNm:'name',fKn:'kana',fEm:'email',fTel:'tel',fGe:'gender',fAg:'age',fMed:'media',fAg2:'agency',fSt2:'status',fCD:'contactDate',fRD:'resignDate',fMemo:'memo',fDept2:'dept',fHire2:'hireStatus'};
  Object.entries(map).forEach(([fid,key])=>{
    const el=document.getElementById(fid);
    if(el) el.value = (a[key] != null ? a[key] : '');
  });
  if(a.birthYear) document.getElementById('fBY').value=a.birthYear;
  if(a.birthMonth) document.getElementById('fBM').value=a.birthMonth;
  if(a.birthDay) document.getElementById('fBD').value=a.birthDay;
  tempDocs = [...(a.docs||[])];
  renderDocList();
  // 編集モードヘッダー表示・タブ初期化
  showEditModeHeader(a);
  switchEditTab('basic');
  // 担当者チェックボックス描画
  editSelectedStaffIds = [...(a.staffIds || [])];
  renderStaffCheckboxes();
  // Phase D-2：既存の int1_date / int2_date を interviews テーブルに自動移行
  try { await migrateLegacyInterviewsForApplicant(a); } catch(e) { console.warn('[migrateLegacy] エラー', e); }
  // Phase D-1：タイムラインのバッジカウントだけ先に取得（タブ切替前にバッジを出す）
  try {
    const { count } = await sb.from('events')
      .select('*', { count: 'exact', head: true })
      .eq('applicant_id', editId);
    const tlBadge = document.getElementById('emtBadgeTimeline');
    if (tlBadge && typeof count === 'number') {
      if (count > 0) {
        tlBadge.style.display = 'inline-block';
        tlBadge.textContent = String(count);
      } else {
        tlBadge.style.display = 'none';
      }
    }
  } catch(e) {}
  // Phase D-2：面接履歴のバッジカウントも先に取得
  try {
    const { count } = await sb.from('interviews')
      .select('*', { count: 'exact', head: true })
      .eq('applicant_id', editId);
    const ivBadge = document.getElementById('emtBadgeInterviews');
    if (ivBadge && typeof count === 'number') {
      if (count > 0) {
        ivBadge.style.display = 'inline-block';
        ivBadge.textContent = String(count);
      } else {
        ivBadge.style.display = 'none';
      }
    }
  } catch(e) {}
  // Phase D-3：ファイルのバッジカウントも先に取得（event_type='file' & deleted!=true）
  try {
    const { data: fileEvs, error: feErr } = await sb.from('events')
      .select('id, metadata')
      .eq('applicant_id', editId)
      .eq('event_type', 'file');
    const fBadge = document.getElementById('emtBadgeFiles');
    if (fBadge) {
      const validCount = (fileEvs || []).filter(e => !(e.metadata && e.metadata.deleted)).length;
      if (validCount > 0) {
        fBadge.style.display = 'inline-block';
        fBadge.textContent = String(validCount);
      } else {
        fBadge.style.display = 'none';
      }
    }
  } catch(e) {}
  showSec('add');
  // ルーター連携：編集モードの場合は ID 付きURLに書き換え
  if (window.SaiyoRouter && typeof window.SaiyoRouter.syncUrlFromSection === 'function') {
    window.SaiyoRouter.syncUrlFromSection('add', { editId: editId, replace: true });
  }
}

// 編集モードのヘッダーを表示
function showEditModeHeader(a) {
  const h = document.getElementById('editModeHeader');
  if (!h) return;
  h.style.display = 'block';
  // 名前
  const nameEl = document.getElementById('editModeName');
  if (nameEl) {
    let nameHtml = escapeHtml(a.name || '');
    const ageGenderParts = [];
    if (a.age) ageGenderParts.push(a.age);
    if (a.gender) ageGenderParts.push(a.gender);
    if (ageGenderParts.length) {
      let agColor = '#888';
      const g = String(a.gender || '').trim();
      if (g === '男' || g === '男性') agColor = '#378ADD';
      else if (g === '女' || g === '女性') agColor = '#D4537E';
      nameHtml += ` <span style="color:${agColor};font-size:12px;font-weight:500;margin-left:6px;">${escapeHtml(ageGenderParts.join('/'))}</span>`;
    }
    // 重複バッジ
    const dupBadge = getDuplicateBadge(a.id);
    if (dupBadge) nameHtml += ' ' + dupBadge;
    nameEl.innerHTML = nameHtml;
  }
  // 求人情報
  const jobEl = document.getElementById('editModeJobInfo');
  if (jobEl) {
    const jobParts = [];
    if (a.jobNo) jobParts.push(a.jobNo);
    if (a.jobName) jobParts.push(a.jobName);
    if (a.jobType) jobParts.push(a.jobType);
    jobEl.textContent = jobParts.length ? jobParts.join(' ／ ') : '（求人情報未設定）';
  }
  // コアステータスバッジ
  const badgeEl = document.getElementById('editModeCoreBadge');
  if (badgeEl) {
    const coreId = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    const color = getCoreStatusColor(coreId);
    const name = getCoreStatusName(coreId);
    badgeEl.innerHTML = `<span style="background:${color}1f;color:${color};border:1px solid ${color}40;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:600;">${escapeHtml(name)}</span>`;
  }
  // 新規モードのヘッダーは隠す
  const head = document.querySelector('.addform-head');
  if (head) head.style.display = 'none';
}

// 編集モードヘッダーを隠す（新規モード時など）
function hideEditModeHeader() {
  const h = document.getElementById('editModeHeader');
  if (h) h.style.display = 'none';
  // 新規モードのヘッダーを戻す
  const head = document.querySelector('.addform-head');
  if (head) head.style.display = '';
  // Phase D-1：新規モード時は他のタブコンテンツを必ず閉じて基本情報タブだけ表示
  const basic = document.getElementById('editTabContent_basic');
  const timeline = document.getElementById('editTabContent_timeline');
  const interviews = document.getElementById('editTabContent_interviews');
  const files = document.getElementById('editTabContent_files');
  if (basic) basic.style.display = '';
  if (timeline) timeline.style.display = 'none';
  if (interviews) interviews.style.display = 'none';
  if (files) files.style.display = 'none';
  editCurrentTab = 'basic';
}

// 左メニュー「新規登録」ボタン専用：editIdをクリアして新規モードへ
function goNewApplicantForm() {
  editId = null;
  editSelectedStaffIds = [];
  hideEditModeHeader();
  resetForm();
  showSec('add');
}

// タブ切替
function switchEditTab(tabName) {
  editCurrentTab = tabName;
  // タブのactive表示を切替
  document.querySelectorAll('.emt-tab').forEach(el => {
    if (el.dataset.tab === tabName) {
      el.style.borderBottomColor = '#5aaa8e';
      el.style.color = '#5aaa8e';
      el.style.fontWeight = '600';
    } else {
      el.style.borderBottomColor = 'transparent';
      el.style.color = '#888';
      el.style.fontWeight = '500';
    }
  });
  // タブコンテンツの表示切替
  const basic = document.getElementById('editTabContent_basic');
  const timeline = document.getElementById('editTabContent_timeline');
  const interviews = document.getElementById('editTabContent_interviews');
  const files = document.getElementById('editTabContent_files');
  if (basic) basic.style.display = (tabName === 'basic') ? '' : 'none';
  if (timeline) timeline.style.display = (tabName === 'timeline') ? 'block' : 'none';
  if (interviews) interviews.style.display = (tabName === 'interviews') ? 'block' : 'none';
  if (files) files.style.display = (tabName === 'files') ? 'block' : 'none';
  // Phase D-1：タイムラインタブが選ばれたら、過去データの疑似イベントをチェック→ロード
  if (tabName === 'timeline') {
    (async () => {
      try {
        await ensureTimelineForExistingApplicants();
        await loadAndRenderTimeline();
      } catch(e) {
        console.warn('[switchEditTab] タイムライン処理エラー', e);
      }
    })();
  }
  // Phase D-2：面接履歴タブが選ばれたらロード
  if (tabName === 'interviews') {
    (async () => {
      try {
        await loadAndRenderInterviews();
      } catch(e) {
        console.warn('[switchEditTab] 面接履歴処理エラー', e);
      }
    })();
  }
  // Phase D-3：ファイルタブが選ばれたらロード
  if (tabName === 'files') {
    (async () => {
      try {
        await loadAndRenderFiles();
      } catch(e) {
        console.warn('[switchEditTab] ファイル処理エラー', e);
      }
    })();
  }
}

// 一覧へ戻る（編集画面から）
function backToList() {
  hideEditModeHeader();
  showSec('list');
}

// 担当者チェックボックスを描画
function renderStaffCheckboxes() {
  const container = document.getElementById('staffCheckboxList');
  if (!container) return;
  // 編集中の応募者のclient_idに合致する担当者だけを表示（adminは応募者のクライアント基準で絞る）
  let targetClientId = null;
  if (editId) {
    const a = applicants.find(x => x.id === editId);
    if (a) targetClientId = a.clientId;
  }
  if (!targetClientId) targetClientId = currentClientId;
  // 在籍中・対象クライアントの担当者
  const candidates = staffList.filter(s => {
    if (s.is_active === false) return false;
    if (targetClientId && s.client_id !== targetClientId) return false;
    return true;
  });
  if (!candidates.length) {
    container.innerHTML = '<span style="font-size:11px;color:#aaa;align-self:center;">在籍中の担当者がいません。「担当者管理」から追加してください。</span>';
    return;
  }
  container.innerHTML = candidates.map(s => {
    const checked = editSelectedStaffIds.some(sid => String(sid) === String(s.id));
    return `
      <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1.5px solid ${checked ? '#5aaa8e' : '#e4e8e7'};border-radius:8px;background:${checked ? '#f3faf6' : '#fff'};font-size:12px;cursor:pointer;transition:all .15s;">
        <input type="checkbox" value="${escapeHtml(String(s.id))}" ${checked ? 'checked' : ''} onchange="toggleStaffCheckbox(this)" style="cursor:pointer;width:13px;height:13px;">
        <span style="color:#1a1a1a;font-weight:500;">${escapeHtml(s.name || '')}</span>
      </label>
    `;
  }).join('');
}

// 担当者チェックボックスのトグル
function toggleStaffCheckbox(input) {
  const sid = input.value;
  if (input.checked) {
    if (!editSelectedStaffIds.some(x => String(x) === String(sid))) {
      editSelectedStaffIds.push(sid);
    }
  } else {
    editSelectedStaffIds = editSelectedStaffIds.filter(x => String(x) !== String(sid));
  }
  // ラベルの見た目を更新
  renderStaffCheckboxes();
}

// 担当者紐付けを保存（applicant_staff テーブル）
async function saveApplicantStaff(applicantId) {
  if (!applicantId) return;
  // 既存の紐付けを削除
  let delQ = sb.from('applicant_staff').delete().eq('applicant_id', applicantId);
  if (!isAdmin) delQ = delQ.eq('client_id', currentClientId);
  const { error: delErr } = await delQ;
  if (delErr) {
    console.warn('[saveApplicantStaff] 旧紐付け削除失敗', delErr);
  }
  if (!editSelectedStaffIds.length) return;
  // 応募者のclient_idを取得
  const a = applicants.find(x => x.id === applicantId);
  const cid = a ? a.clientId : currentClientId;
  // 新しい紐付けを挿入
  const rows = editSelectedStaffIds.map(sid => ({
    applicant_id: applicantId,
    staff_id: sid,
    client_id: cid
  }));
  const { error: insErr } = await sb.from('applicant_staff').insert(rows);
  if (insErr) {
    console.warn('[saveApplicantStaff] 新紐付け挿入失敗', insErr);
  }
  // ローカルのstaffIdsも更新
  if (a) a.staffIds = [...editSelectedStaffIds];
}

// ========================================
// 詳細パネル（Phase C-2でopenApplicantEditに統合済み、互換のため残置）
// ========================================
function openDetail(id) {
  // Phase C-2：詳細展開は廃止、新編集画面に統合
  openApplicantEdit(id);
}

function closeDetail() {
  if (curId) {
    const prev = document.getElementById('detail_'+curId);
    if (prev) { prev.style.display='none'; prev.querySelector('td').innerHTML=''; }
  }
  curId = null;
}

function editApp() {
  // Phase C-2：既存の詳細展開からの編集も新タブUIに統一
  if (!curId) return;
  closeDetail();
  openApplicantEdit(curId);
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
  ['fAD','fJT','fJobNo','fJobName','fLoc','fNm','fKn','fEm','fTel','fAg','fCD','fRD','fMemo','fBY'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['fGe','fMed','fAg2','fSt2','fBM','fBD','fDept2','fHire2'].forEach(id=>{const e=document.getElementById(id);if(e)e.selectedIndex=0;});
  document.getElementById('fAD').value = new Date().toISOString().split('T')[0];
  // Phase D-3：書類管理セクションは削除済み。docList/docName/docUrlも削除済みなので
  //   要素が存在する場合のみ操作する（後方互換）
  const _dl = document.getElementById('docList'); if (_dl) _dl.innerHTML = '';
  const _dn = document.getElementById('docName'); if (_dn) _dn.value = '';
  const _du = document.getElementById('docUrl'); if (_du) _du.value = '';
  // 自動年齢計算の状態をリセット
  if (typeof window._ageAutoOverride !== 'undefined') window._ageAutoOverride = false;
  const ageAuto = document.getElementById('fAgAuto'); if (ageAuto) ageAuto.style.display = 'none';
  // Phase C-2：編集ヘッダーを隠して新規モードに戻す
  hideEditModeHeader();
  // 担当者選択もクリア
  editSelectedStaffIds = [];
  // 担当者チェックボックスを描画（新規モード時は currentClientId に紐づく担当者を表示）
  renderStaffCheckboxes();
}

// ========================================
// 重複応募者検知（Phase G）
// ========================================
// メールor電話番号で過去の応募者をチェック
function findDuplicateApplicant(newEmail, newTel, newName) {
  for (const a of applicants) {
    // クライアントが違う場合は重複とみなさない（admin時は別クライアントの応募者は見えてもOK）
    if (!isAdmin && a.clientId !== currentClientId) continue;
    const aEmail = (a.email || '').trim().toLowerCase();
    const aTel = (a.tel || '').replace(/[\s-]/g, '');
    if (newEmail && aEmail && newEmail === aEmail) {
      return { applicant: a, matchType: 'email' };
    }
    if (newTel && aTel && newTel === aTel) {
      return { applicant: a, matchType: 'tel' };
    }
  }
  return null;
}

// 既存の応募者リスト全体に対して、重複IDマップを構築
// 返り値: { applicantId: { matchType: 'email'|'tel'|'both', count: 重複している件数 } }
let _duplicateMap = null;
function buildDuplicateMap() {
  const map = {};
  // メールアドレス→応募者ID配列
  const byEmail = {};
  const byTel = {};
  applicants.forEach(a => {
    // クライアントごとに重複を見るが、admin時は全件を比較対象とせず同じclientId内のみ
    const cid = a.clientId || '';
    const email = (a.email || '').trim().toLowerCase();
    const tel = (a.tel || '').replace(/[\s-]/g, '');
    if (email) {
      const key = `${cid}::${email}`;
      if (!byEmail[key]) byEmail[key] = [];
      byEmail[key].push(a.id);
    }
    if (tel) {
      const key = `${cid}::${tel}`;
      if (!byTel[key]) byTel[key] = [];
      byTel[key].push(a.id);
    }
  });
  // 2件以上ある同一キーの全IDをマップに登録
  Object.values(byEmail).forEach(ids => {
    if (ids.length >= 2) {
      ids.forEach(id => {
        if (!map[id]) map[id] = { matchType: 'email', count: ids.length };
        else { map[id].matchType = map[id].matchType === 'tel' ? 'both' : map[id].matchType; }
      });
    }
  });
  Object.values(byTel).forEach(ids => {
    if (ids.length >= 2) {
      ids.forEach(id => {
        if (!map[id]) map[id] = { matchType: 'tel', count: ids.length };
        else if (map[id].matchType === 'email') map[id].matchType = 'both';
      });
    }
  });
  _duplicateMap = map;
  return map;
}

// 名前の右に出す重複バッジHTML
function getDuplicateBadge(applicantId) {
  if (!_duplicateMap) buildDuplicateMap();
  const info = _duplicateMap[applicantId];
  if (!info) return '';
  const tip = info.matchType === 'email' ? 'メールアドレスが重複' : info.matchType === 'tel' ? '電話番号が重複' : 'メール・電話どちらも重複';
  return `<span title="${tip}（${info.count}名で重複）" style="display:inline-block;font-size:9px;background:#FAECE7;color:#993C1D;padding:1px 6px;border-radius:9px;margin-left:6px;font-weight:600;border:1px solid #F0997B;cursor:help;">🔁 重複</span>`;
}

// 警告ダイアログを表示し、続行するかどうかを返す
function showDuplicateWarning(dup, newName) {
  return new Promise(resolve => {
    const a = dup.applicant;
    const matchLabel = dup.matchType === 'email' ? 'メールアドレス' : '電話番号';
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || '';
    const coreName = getCoreStatusName(cid);
    const existingDate = a.appDate || '不明';
    const msg = `🚨 重複応募者の可能性\n\n${matchLabel}が一致する応募者が既に登録されています。\n\n` +
      `【既存】\n  名前：${a.name}\n  応募日：${existingDate}\n  ステータス：${coreName}\n  職種：${a.jobType || '-'}\n\n` +
      `【新規入力】\n  名前：${newName}\n\nこのまま登録を続けますか？\n` +
      `（OK = 重複承知で登録 / キャンセル = 中止して既存を確認）`;
    const ok = confirm(msg);
    resolve(ok);
  });
}

async function saveApp() {
  const req = {fAD:'応募日',fNm:'名前',fGe:'性別'};
  for (const [id,lbl] of Object.entries(req)) {
    if (!document.getElementById(id).value) { alert(`「${lbl}」は必須項目です`); document.getElementById(id).focus(); return; }
  }
  // 重複応募者チェック（新規登録時のみ）
  if (!editId) {
    const newEmail = (document.getElementById('fEm').value || '').trim().toLowerCase();
    const newTel = (document.getElementById('fTel').value || '').replace(/[\s-]/g, '');
    const newName = (document.getElementById('fNm').value || '').trim();
    const dup = findDuplicateApplicant(newEmail, newTel, newName);
    if (dup) {
      const proceed = await showDuplicateWarning(dup, newName);
      if (!proceed) return;
    }
  }
  const by=document.getElementById('fBY').value, bm=document.getElementById('fBM').value, bd=document.getElementById('fBD').value;
  // admin の場合：編集中なら応募者のclientIdを継承、新規登録ならクライアント選択必須
  let cid;
  if (isAdmin) {
    if (editId) {
      // 編集モード：その応募者の所属クライアントをそのまま使う
      const editingApp = applicants.find(x => x.id === editId);
      cid = editingApp?.clientId;
      if (!cid || cid === 'admin') {
        alert('この応募者には所属クライアントが正しく設定されていません。\n本来は管理者がクライアントとして応募者を新規登録することはできません。');
        return;
      }
    } else {
      // 新規登録モード：管理者がクライアントを選んで登録するUIはまだないので、
      // とりあえず警告して保存を中止する
      alert('管理者は応募者を新規登録できません。\nクライアントアカウントでログインして登録してください。');
      return;
    }
  } else {
    cid = currentClientId;
  }
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
    resign_date: document.getElementById('fRD').value || null,
    memo: document.getElementById('fMemo').value,
    birth_year: by || null, birth_month: bm || null, birth_day: bd || null,
    birthdate: by&&bm&&bd ? `${by}年${bm}月${bd}日` : null,
    docs: tempDocs,
    dept: document.getElementById('fDept2') ? document.getElementById('fDept2').value : '',
    hire_status: document.getElementById('fHire2') ? document.getElementById('fHire2').value : '',
    address: document.getElementById('fAddr') ? document.getElementById('fAddr').value : ''
  };
  let error;
  let savedId = editId;
  // Phase D-1：旧データを保持（差分検知用）
  const oldData = editId ? applicants.find(x => x.id === editId) : null;
  const oldStaffIds = oldData ? [...(oldData.staffIds || [])] : [];
  if (editId) {
    let query = sb.from('applicants').update(row).eq('id', editId);
    if (!isAdmin) query = query.eq('client_id', currentClientId);
    ({ error } = await query);
  } else {
    const { data: insData, error: insErr } = await sb.from('applicants').insert(row).select('id').single();
    error = insErr;
    if (insData && insData.id) savedId = insData.id;
  }
  if (error) { alert('保存に失敗しました: ' + error.message); return; }
  // Phase C-2：担当者紐付けを保存
  if (savedId) {
    try {
      const tmpA = applicants.find(x => x.id === savedId) || { clientId: currentClientId, id: savedId };
      const cidForStaff = tmpA.clientId || currentClientId;
      // 古い紐付けを削除
      await sb.from('applicant_staff').delete().eq('applicant_id', savedId);
      // 新しい紐付けを挿入
      if (editSelectedStaffIds.length) {
        const rows = editSelectedStaffIds.map(sid => ({
          applicant_id: savedId,
          staff_id: sid,
          client_id: cidForStaff
        }));
        const { error: staffErr } = await sb.from('applicant_staff').insert(rows);
        if (staffErr) console.warn('[saveApp] 担当者紐付け失敗（無視）', staffErr);
      }
    } catch (e) {
      console.warn('[saveApp] 担当者紐付け処理で例外', e);
    }
  }
  // Phase D-1：イベント記録
  try {
    if (!editId && savedId) {
      // 新規登録
      await recordEvent(savedId, 'applicant_created', '応募受付', `${row.name || ''}さんの応募を受け付けました`, null);
      // 初期ステータスがあれば「ステータス変更」も記録
      if (row.status) {
        await recordEvent(savedId, 'status_change', `ステータス：${row.status}`, null, { old: '', new: row.status });
      }
    } else if (editId && oldData) {
      // 更新時の差分検知
      const diffs = [];
      const trackFields = [
        { key: 'status', oldVal: oldData.status, newVal: row.status, label: 'ステータス' },
        { key: 'memo', oldVal: oldData.memo, newVal: row.memo, label: 'メモ' },
        { key: 'name', oldVal: oldData.name, newVal: row.name, label: '名前' },
        { key: 'email', oldVal: oldData.email, newVal: row.email, label: 'メール' },
        { key: 'tel', oldVal: oldData.tel, newVal: row.tel, label: '電話' },
        { key: 'job_type', oldVal: oldData.jobType, newVal: row.job_type, label: '応募職種' },
        { key: 'dept', oldVal: oldData.dept, newVal: row.dept, label: '部署' },
        { key: 'media', oldVal: oldData.media, newVal: row.media, label: '媒体' },
      ];
      trackFields.forEach(f => {
        const o = (f.oldVal == null ? '' : String(f.oldVal));
        const n = (f.newVal == null ? '' : String(f.newVal));
        if (o !== n) diffs.push({ ...f, o, n });
      });
      // ステータス変更だけは独立イベント（updateStatusと別経路でここに来る）
      const statusDiff = diffs.find(d => d.key === 'status');
      if (statusDiff) {
        await recordEvent(savedId, 'status_change', `ステータス変更：${statusDiff.o || '(未設定)'} → ${statusDiff.n || '(未設定)'}`, null, { old: statusDiff.o, new: statusDiff.n });
      }
      // それ以外をまとめて field_change として1件記録
      const otherDiffs = diffs.filter(d => d.key !== 'status');
      if (otherDiffs.length) {
        const titleParts = otherDiffs.map(d => d.label);
        const descParts = otherDiffs.map(d => `${d.label}：${d.o || '(空)'} → ${d.n || '(空)'}`);
        await recordEvent(savedId, 'field_change', `情報更新：${titleParts.join('、')}`, descParts.join('\n'), { changes: otherDiffs });
      }
      // 担当者の差分
      const oldSet = new Set(oldStaffIds.map(String));
      const newSet = new Set(editSelectedStaffIds.map(String));
      const added = [...newSet].filter(x => !oldSet.has(x));
      const removed = [...oldSet].filter(x => !newSet.has(x));
      if (added.length || removed.length) {
        const addedNames = added.map(getStaffNameById);
        const removedNames = removed.map(getStaffNameById);
        const parts = [];
        if (addedNames.length) parts.push(`追加：${addedNames.join('、')}`);
        if (removedNames.length) parts.push(`解除：${removedNames.join('、')}`);
        await recordEvent(savedId, 'staff_change', '担当者変更', parts.join(' / '), { added, removed });
      }
    }
  } catch (e) {
    console.warn('[saveApp] イベント記録で例外（無視）', e);
  }
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
  // 現在画面に表示されている応募者を対象にする（絞り込み・クライアント絞り込み反映）
  const target = (window._currentListView && window._currentListView.length) ? window._currentListView : applicants;
  const rows = target.map(a => {
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
  // ファイル名：admin時はクライアント絞り込み中ならその名前、未絞り込みなら「全クライアント」
  let labelForFilename = currentClientName;
  if (isAdmin) {
    const cf = document.getElementById('appClientFilter')?.value || '';
    if (cf) {
      labelForFilename = getClientDisplayName(cf);
    } else {
      labelForFilename = '全クライアント';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `採用コア_${labelForFilename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ========================================
// PDF出力
// ========================================
// ========================================
// 月次レポート（Phase G）
// ========================================
function openMonthlyReportDialog() {
  // 月選択ダイアログを表示
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const defYm = lastMonth.toISOString().slice(0, 7);
  const ym = prompt('月次レポートを出力する対象月を入力してください（YYYY-MM形式）：', defYm);
  if (!ym) return;
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    alert('YYYY-MM形式で入力してください（例：2026-04）');
    return;
  }
  generateMonthlyReport(ym);
}

function generateMonthlyReport(ym) {
  // 対象月の応募者を抽出（応募日が ym で始まるもの）
  let pool = applicants.filter(a => (a.appDate || '').startsWith(ym));
  // admin時はクライアント絞り込みを尊重
  if (isAdmin) {
    const cf = document.getElementById('anClient')?.value || '';
    if (cf) pool = pool.filter(a => a.clientId === cf);
  }
  if (pool.length === 0) {
    alert(`${ym} の応募データがありません。`);
    return;
  }
  const total = pool.length;

  // 集計
  const coreCounts = {};
  CORE_STATUS.forEach(cs => coreCounts[cs.id] = 0);
  pool.forEach(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    if (coreCounts[cid] !== undefined) coreCounts[cid]++;
  });
  const hired = (coreCounts.hired || 0) + (coreCounts.joined || 0);
  const dropped = (coreCounts.resigned || 0) + (coreCounts.other || 0);
  const inProgress = total - hired - dropped;
  const hireRate = total > 0 ? (hired / total * 100) : 0;

  // 媒体別
  const mediaCounts = {};
  pool.forEach(a => {
    const m = a.media || '(媒体未入力)';
    mediaCounts[m] = (mediaCounts[m] || 0) + 1;
  });
  const mediaRows = Object.entries(mediaCounts).sort((a,b) => b[1]-a[1])
    .map(([k,v]) => `<tr><td>${escapeHtml(k)}</td><td align="right">${v}件</td><td align="right">${Math.round(v/total*100)}%</td></tr>`).join('');

  // 職種別
  const jobCounts = {};
  pool.forEach(a => { if (a.jobType) jobCounts[a.jobType] = (jobCounts[a.jobType] || 0) + 1; });
  const jobRows = Object.entries(jobCounts).sort((a,b) => b[1]-a[1])
    .map(([k,v]) => `<tr><td>${escapeHtml(k)}</td><td align="right">${v}件</td></tr>`).join('');

  // 部署別
  const deptCounts = {};
  pool.forEach(a => { if (a.dept) deptCounts[a.dept] = (deptCounts[a.dept] || 0) + 1; });
  const deptRows = Object.entries(deptCounts).sort((a,b) => b[1]-a[1])
    .map(([k,v]) => `<tr><td>${escapeHtml(k)}</td><td align="right">${v}件</td></tr>`).join('');

  // コアラコーチの提案（同じロジック）
  const advices = analyzeAndAdvise(pool);
  const adviceHtml = advices.length === 0
    ? '<div style="padding:14px;background:#E1F5EE;border-radius:6px;color:#0F6E56;font-size:12px;">特筆すべき改善ポイントはありませんでした。良好な状態です。</div>'
    : advices.map((adv, i) => {
        const sevLabel = { high:'要対応', mid:'要注意', low:'参考' }[adv.severity];
        const sevColor = { high:'#D85A30', mid:'#BA7517', low:'#1D9E75' }[adv.severity];
        return `<div style="margin-bottom:10px;padding:10px 12px;border-left:3px solid ${sevColor};background:#fafafa;border-radius:4px;">
          <div style="font-size:11px;color:${sevColor};font-weight:600;margin-bottom:4px;">[${sevLabel}] ${escapeHtml(adv.title)}</div>
          <div style="font-size:11px;color:#555;margin-bottom:5px;">${escapeHtml(adv.observation)}</div>
          <div style="font-size:11px;color:#1a1a1a;"><strong>改善案：</strong></div>
          <ol style="margin:3px 0 0 18px;padding:0;font-size:11px;color:#1a1a1a;">${adv.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
        </div>`;
      }).join('');

  // 月次の主要指標カード
  const ymLabel = ym.replace(/^(\d{4})-(\d{2})$/, '$1年$2月');
  const todayStr = new Date().toLocaleDateString('ja-JP');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ymLabel} 月次採用レポート</title><style>
body{font-family:'Helvetica Neue','Hiragino Kaku Gothic ProN',Arial,sans-serif;font-size:12px;color:#1a1a1a;margin:0;padding:32px;background:#fff;}
.cover{padding-bottom:24px;border-bottom:2px solid #1D9E75;margin-bottom:24px;}
h1{font-size:24px;font-weight:700;margin:0 0 6px;color:#0F6E56;}
.sub{font-size:11px;color:#888;}
h2{font-size:14px;font-weight:600;margin:24px 0 10px;padding-bottom:6px;border-bottom:1.5px solid #e0e0e0;color:#1D9E75;}
.mg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
.mc{background:#f5f9f7;border-radius:6px;padding:14px;}
.ml{font-size:10px;color:#888;margin-bottom:3px;}
.mv{font-size:24px;font-weight:700;color:#0F6E56;}
table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;}
th{background:#f5f5f5;text-align:left;padding:7px 9px;font-weight:600;border-bottom:2px solid #ddd;}
td{padding:6px 9px;border-bottom:1px solid #f0f0f0;}
.footer{margin-top:28px;padding-top:14px;border-top:1px solid #ddd;font-size:10px;color:#aaa;text-align:right;}
@media print{body{padding:20px;}}
</style></head><body>
<div class="cover">
  <h1>📊 ${ymLabel} 月次採用レポート</h1>
  <div class="sub">クライアント：${escapeHtml(currentClientName || '-')}　／　出力日：${todayStr}</div>
</div>

<h2>📌 主要指標サマリー</h2>
<div class="mg">
  <div class="mc"><div class="ml">総応募数</div><div class="mv">${total}</div></div>
  <div class="mc"><div class="ml">採用・入社</div><div class="mv">${hired}</div></div>
  <div class="mc"><div class="ml">選考中</div><div class="mv">${inProgress}</div></div>
  <div class="mc"><div class="ml">採用率</div><div class="mv">${hireRate.toFixed(1)}%</div></div>
</div>

<h2>📈 ステータス別内訳</h2>
<table>
  <thead><tr><th>ステータス</th><th align="right">人数</th><th align="right">構成比</th></tr></thead>
  <tbody>
    ${CORE_STATUS.map(cs => `<tr><td>${cs.name}</td><td align="right">${coreCounts[cs.id] || 0}件</td><td align="right">${total ? Math.round((coreCounts[cs.id]||0)/total*100) : 0}%</td></tr>`).join('')}
  </tbody>
</table>

<h2>📰 媒体別応募状況</h2>
<table>
  <thead><tr><th>媒体名</th><th align="right">応募数</th><th align="right">構成比</th></tr></thead>
  <tbody>${mediaRows || '<tr><td colspan="3" style="color:#aaa">データなし</td></tr>'}</tbody>
</table>

<h2>👔 職種別応募状況</h2>
<table>
  <thead><tr><th>職種</th><th align="right">応募数</th></tr></thead>
  <tbody>${jobRows || '<tr><td colspan="2" style="color:#aaa">データなし</td></tr>'}</tbody>
</table>

${deptRows ? `<h2>🏢 部署別応募状況</h2>
<table>
  <thead><tr><th>部署</th><th align="right">応募数</th></tr></thead>
  <tbody>${deptRows}</tbody>
</table>` : ''}

<h2>🐨 コアラからの改善提案</h2>
${adviceHtml}

<div class="footer">採用コア｜${ymLabel} 月次レポート　・　生成日時：${new Date().toLocaleString('ja-JP')}</div>
<script>window.onload=function(){setTimeout(()=>window.print(),300);}<\/script>
</body></html>`;

  window.open(URL.createObjectURL(new Blob([html], {type:'text/html;charset=utf-8'})), '_blank');
}

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
  // 月別集計を生成（応募月ベース、コアステータスで内訳）
  const monthly = {};
  data.forEach(a => {
    const ym = (a.appDate || '').slice(0, 7);
    if (!ym) return;
    if (!monthly[ym]) monthly[ym] = { applied:0, int1:0, int2:0, hired:0, fail:0 };
    monthly[ym].applied++;
    if (a.int1Date) monthly[ym].int1++;
    if (a.int2Date) monthly[ym].int2++;
    const cs = a.coreStatusId;
    if (cs === 'hired' || cs === 'joined') monthly[ym].hired++;
    if (cs === 'other' || cs === 'resigned') monthly[ym].fail++;
  });
  const monthR = Object.keys(monthly).sort().reverse().map(ym => {
    const m = monthly[ym];
    const ir = m.applied ? Math.round(m.int1 / m.applied * 100) : 0;
    const hr = m.applied ? Math.round(m.hired / m.applied * 100) : 0;
    return `<tr><td>${ym}</td><td align="right">${m.applied}</td><td align="right">${m.int1}</td><td align="right">${m.int2}</td><td align="right">${m.hired}</td><td align="right">${m.fail}</td><td align="right">${ir}%</td><td align="right">${hr}%</td></tr>`;
  }).join('');
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

// 期間フィルタの選択状態（モジュール変数）
let dashPeriod = 'month'; // 'today' | 'week' | 'month' | 'all'

// 期間フィルタの切替
function setDashPeriod(period) {
  dashPeriod = period;
  // タブのアクティブ表示を更新
  document.querySelectorAll('.dash-period-tab').forEach(btn => {
    if (btn.dataset.period === period) {
      btn.classList.add('active');
      btn.style.background = '#fff';
      btn.style.color = '#1a1a1a';
      btn.style.fontWeight = '700';
      btn.style.boxShadow = '0 1px 3px rgba(0,0,0,.08)';
    } else {
      btn.classList.remove('active');
      btn.style.background = 'transparent';
      btn.style.color = '#666';
      btn.style.fontWeight = '600';
      btn.style.boxShadow = 'none';
    }
  });
  renderDashboard();
}

function renderDashboard() {
  // Step 3: 「自分の担当のみ」の場合、applicants を一時的に絞り込む
  let __origApplicants = null;
  try {
    if (dashMineOnly && currentStaffId) {
      const myIds = getMyApplicantIdSet();
      if (myIds) {
        __origApplicants = applicants;
        applicants = applicants.filter(a => myIds.has(a.id));
      }
    }
  } catch(e) { console.warn('[renderDashboard] mineOnly差し替えエラー', e); }

  try {
    _renderDashboardCore();
  } finally {
    // 必ず元に戻す
    if (__origApplicants) applicants = __origApplicants;
  }
}

function _renderDashboardCore() {
  const now = new Date();
  const toStr = d => d.toISOString().split('T')[0];
  const ym = now.toISOString().slice(0,7);
  const monthStart = ym + '-01';
  const days30Ago = new Date(now); days30Ago.setDate(days30Ago.getDate() - 29);
  const h = now.getHours();
  const greet = h < 12 ? 'おはようございます' : h < 18 ? 'こんにちは' : 'お疲れ様です';
  // Step 3: タイトルは「採用運用ダッシュ」固定、挨拶は日付欄に統合
  const dashGreetEl = document.getElementById('dashGreet');
  if (dashGreetEl) dashGreetEl.textContent = '採用運用ダッシュ';
  const dashDateEl = document.getElementById('dashDate');
  if (dashDateEl) {
    const dateStr = now.toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
    const name = currentStaffName || currentClientName || '';
    dashDateEl.textContent = `${dateStr} · ${greet}${name ? '、' + name + ' さん' : ''}`;
  }

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

  // ===== 1段目：本日のKPI（固定・期間フィルタ非連動）=====
  const todayStr = toStr(now); // YYYY-MM-DD
  // 本日の応募数：応募日が今日と一致
  const todayApps = applicants.filter(a => a.appDate === todayStr).length;
  // 本日の面接数：1次/2次の日時が今日と一致（同日に両方なら2件）
  const todayInterviews = applicants.reduce((cnt, a) => {
    const i1 = a.int1Date ? String(a.int1Date).slice(0,10) : '';
    const i2 = a.int2Date ? String(a.int2Date).slice(0,10) : '';
    if (i1 === todayStr) cnt++;
    if (i2 === todayStr) cnt++;
    return cnt;
  }, 0);

  document.getElementById('dashKpiToday').innerHTML = `
    <div class="mc mc-today" style="border-left:3px solid #EF9F27;">
      <span class="badge-today">TODAY</span>
      <div class="mc-lbl">本日の応募数</div><div class="mc-val">${todayApps}<span style="font-size:14px;color:#888;font-weight:500;">件</span></div><div class="mc-sub">応募日が今日</div>
    </div>
    <div class="mc mc-today" style="border-left:3px solid #9B59B6;">
      <span class="badge-today">TODAY</span>
      <div class="mc-lbl">本日の面接数</div><div class="mc-val">${todayInterviews}<span style="font-size:14px;color:#888;font-weight:500;">件</span></div><div class="mc-sub">1次/2次の合算</div>
    </div>`;

  // ===== 2段目：期間フィルタ連動KPI =====
  // 期間範囲を計算
  let periodStart, periodLabel;
  if (dashPeriod === 'today') {
    periodStart = todayStr;
    periodLabel = '今日';
  } else if (dashPeriod === 'week') {
    // 今週の月曜日
    const d = new Date(now);
    const day = d.getDay(); // 0=日曜, 1=月曜...
    const diff = day === 0 ? -6 : 1 - day; // 月曜まで戻す
    d.setDate(d.getDate() + diff);
    periodStart = toStr(d);
    periodLabel = '今週';
  } else if (dashPeriod === 'month') {
    periodStart = monthStart;
    periodLabel = '今月';
  } else {
    periodStart = null; // 累計
    periodLabel = '累計';
  }

  // 期間内の応募者を絞り込み
  const periodApplicants = periodStart
    ? applicants.filter(a => a.appDate && a.appDate >= periodStart)
    : applicants;
  const cumPeriod = calcFunnelCumulative(periodApplicants);
  const pTotal = periodApplicants.length;
  const pInProgress = cumPeriod['in_progress'] || 0;
  const pInterview = cumPeriod['interview'] || 0;
  const pHired = cumPeriod['hired'] || 0;
  const pJoined = cumPeriod['joined'] || 0;
  const pRate = pTotal ? Math.round(pHired / pTotal * 100) : 0;

  document.getElementById('dashKpi').innerHTML = `
    <div class="mc" style="border-left:3px solid #378ADD;">
      <div class="mc-lbl">${periodLabel}の応募数</div><div class="mc-val">${pTotal}</div><div class="mc-sub">${dashPeriod==='all'?'累計':'期間内'}</div>
    </div>
    <div class="mc" style="border-left:3px solid #1D9E75;">
      <div class="mc-lbl">${periodLabel}の対応中</div><div class="mc-val">${pInProgress}</div><div class="mc-sub">選考中</div>
    </div>
    <div class="mc" style="border-left:3px solid #9B59B6;">
      <div class="mc-lbl">${periodLabel}の面接数</div><div class="mc-val">${pInterview}</div><div class="mc-sub">面接段階</div>
    </div>
    <div class="mc" style="border-left:3px solid #639922;">
      <div class="mc-lbl">${periodLabel}の内定・採用</div><div class="mc-val">${pHired}</div><div class="mc-sub">${dashPeriod==='all'?'累計':'期間内'}</div>
    </div>
    <div class="mc" style="border-left:3px solid #1D9E75;">
      <div class="mc-lbl">${periodLabel}の入社</div><div class="mc-val">${pJoined}</div><div class="mc-sub">${dashPeriod==='all'?'累計':'期間内'}</div>
    </div>
    <div class="mc" style="border-left:3px solid #EF9F27;">
      <div class="mc-lbl">${periodLabel}の採用率</div><div class="mc-val">${pRate}%</div><div class="mc-sub">採用 / 応募</div>
    </div>`;

  // 下部: 当月ベースの集計（既存のTODOカードは保持）
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
  // Step 3: 採用運用ダッシュ追加機能
  try {
    renderDashWeekInterviews();
    renderDashRecentMinutes();
    applyKpiClickability();
    renderDashKoalaAdvice();
  } catch(e) { console.warn('[renderDashboard] Step3拡張エラー', e); }
  // Step 5: モード概要バーも更新
  try { if (typeof renderModeQuickStats === 'function') renderModeQuickStats(); } catch(e) {}
}

// =====================================================
// Step 3: 採用運用ダッシュ拡張機能
// =====================================================

// 「自分の担当のみ」フィルタの状態（ダッシュ用）
let dashMineOnly = false;
// 5分ごと更新タイマー
let dashRefreshTimer = null;

// 「自分の担当のみ」切替
function onDashMineToggle(checked) {
  dashMineOnly = !!checked;
  try { localStorage.setItem('saiyoCoreDashMineOnly', dashMineOnly ? '1' : '0'); } catch(e) {}
  renderDashboard();
}

// 「自分の担当のみ」の対象応募者IDセットを返す
function getMyApplicantIdSet() {
  // 担当者が未選択 or applicants が空なら絞り込みなし扱い
  if (!currentStaffId) return null;
  if (!Array.isArray(applicants) || applicants.length === 0) return null;
  const ids = new Set();
  try {
    applicants.forEach(a => {
      if (Array.isArray(a.staffIds) && a.staffIds.some(sid => String(sid) === String(currentStaffId))) {
        ids.add(a.id);
      }
    });
  } catch(e) { return null; }
  return ids;
}

// 5分ごとの自動更新を開始（採用運用ダッシュ表示中だけ動作）
function startDashAutoRefresh() {
  stopDashAutoRefresh();
  dashRefreshTimer = setInterval(() => {
    // ダッシュが表示中のみ更新
    const sec = document.getElementById('sec-dashboard');
    if (sec && sec.classList.contains('active')) {
      refreshOperationDash(true);
    }
  }, 5 * 60 * 1000); // 5分
}
function stopDashAutoRefresh() {
  if (dashRefreshTimer) {
    clearInterval(dashRefreshTimer);
    dashRefreshTimer = null;
  }
}

// 採用運用ダッシュ：今すぐ更新（手動 or 自動から）
async function refreshOperationDash(silent) {
  const txtEl = document.getElementById('dashRefreshText');
  if (!silent && txtEl) txtEl.textContent = '更新中...';
  try {
    // データ再取得（applicants/tasks/minutes/budgets）
    if (typeof loadApplicants === 'function') await loadApplicants();
    if (typeof loadMinutesAndTasks === 'function') await loadMinutesAndTasks();
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch(e) {
    console.warn('[refreshOperationDash] エラー', e);
  } finally {
    if (txtEl) {
      txtEl.textContent = '5分ごと更新';
    }
  }
}

// 今週の面接スケジュール（月〜日）
function renderDashWeekInterviews() {
  const el = document.getElementById('dashWeekInterviews');
  if (!el) return;
  if (!Array.isArray(applicants)) { el.innerHTML = ''; return; }

  const today = new Date();
  const day = today.getDay();
  const diffMon = day === 0 ? -6 : 1 - day;  // 月曜
  const monday = new Date(today); monday.setDate(monday.getDate() + diffMon);
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const mondayStr = monday.toISOString().slice(0,10);
  const sundayStr = sunday.toISOString().slice(0,10);
  const todayStr = today.toISOString().slice(0,10);

  // 「自分の担当のみ」絞り込み
  const myIds = dashMineOnly ? getMyApplicantIdSet() : null;

  // 今週内の面接を収集
  const items = [];
  applicants.forEach(a => {
    if (myIds && !myIds.has(a.id)) return;
    // 1次面接
    if (a.int1Date) {
      const d = String(a.int1Date).slice(0, 10);
      if (d >= mondayStr && d <= sundayStr) {
        items.push({ applicantId: a.id, name: a.name, date: d, type: '1次', dateTimeStr: a.int1Date });
      }
    }
    if (a.int2Date) {
      const d = String(a.int2Date).slice(0, 10);
      if (d >= mondayStr && d <= sundayStr) {
        items.push({ applicantId: a.id, name: a.name, date: d, type: '2次', dateTimeStr: a.int2Date });
      }
    }
  });
  // 日付昇順
  items.sort((a, b) => a.dateTimeStr.localeCompare(b.dateTimeStr));

  if (items.length === 0) {
    el.innerHTML = '<div class="op-dash-week-empty">今週の面接予定はありません</div>';
    return;
  }
  el.innerHTML = items.slice(0, 8).map(it => {
    const d = new Date(it.date);
    const wd = ['日','月','火','水','木','金','土'][d.getDay()];
    const isToday = it.date === todayStr;
    // 時刻部分（YYYY-MM-DDTHH:MM形式から）
    let timePart = '';
    if (it.dateTimeStr && it.dateTimeStr.length >= 16) {
      timePart = ` ${it.dateTimeStr.slice(11, 16)}`;
    }
    return `<div class="op-dash-week-item" onclick="openApplicantEdit('${escapeHtml(it.applicantId)}')">
      <div class="op-dash-week-day ${isToday ? 'today' : ''}">${d.getMonth()+1}/${d.getDate()}(${wd})</div>
      <div style="flex:1;">
        <div style="font-weight:500;color:#1a1a1a;">${escapeHtml(it.name || '(名前なし)')}</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">${it.type}面接${timePart}</div>
      </div>
      <span style="font-size:11px;color:#5a8a48;">詳細 →</span>
    </div>`;
  }).join('');
}

// 議事録：直近5件
function renderDashRecentMinutes() {
  const el = document.getElementById('dashRecentMinutes');
  if (!el) return;
  if (typeof minutes === 'undefined' || !Array.isArray(minutes) || minutes.length === 0) {
    el.innerHTML = '<div class="op-dash-minute-empty">議事録がまだありません</div>';
    return;
  }
  // 日付降順で上位5件
  const sorted = [...minutes].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
  el.innerHTML = sorted.map(m => {
    const title = m.title || '(無題)';
    const dateStr = m.date ? new Date(m.date).toLocaleDateString('ja-JP', { month:'short', day:'numeric' }) : '';
    return `<div class="op-dash-minute-item" onclick="showSec('minutes')">
      <div style="font-size:10px;color:#888;width:60px;flex-shrink:0;">${dateStr}</div>
      <div style="flex:1;font-weight:500;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(title)}</div>
      <span style="font-size:11px;color:#5a8a48;">→</span>
    </div>`;
  }).join('');
}

// KPIカードにクリック誘導を付与（応募者一覧 等へ遷移）
function applyKpiClickability() {
  // 1段目の本日のKPI
  const todayWrap = document.getElementById('dashKpiToday');
  if (todayWrap) {
    const cards = todayWrap.querySelectorAll('.mc');
    cards.forEach((card, idx) => {
      card.classList.add('op-dash-clickable');
      card.onclick = () => {
        if (idx === 0) {
          // 本日の応募 → 応募者一覧（応募日が今日のもの）
          showSec('list');
          setTimeout(() => filterListByToday(), 100);
        } else if (idx === 1) {
          // 本日の面接 → スケジュール画面
          showSec('schedule');
        }
      };
    });
  }
  // 2段目：期間KPI
  const periodWrap = document.getElementById('dashKpi');
  if (periodWrap) {
    const cards = periodWrap.querySelectorAll('.mc');
    cards.forEach((card, idx) => {
      card.classList.add('op-dash-clickable');
      card.onclick = () => {
        showSec('list');
      };
    });
  }
  // TODO/Insightsもクリック可能に
  const todoWrap = document.getElementById('dashTodo');
  if (todoWrap) {
    const cards = todoWrap.querySelectorAll('.mc, .todo-card');
    cards.forEach(card => {
      card.classList.add('op-dash-clickable');
      // 既存onclickあれば触らない
      if (!card.onclick) card.onclick = () => showSec('list');
    });
  }
}

// 応募者一覧を「今日応募」で絞り込み（簡易実装）
function filterListByToday() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const fDateFrom = document.getElementById('fDateFrom');
  const fDateTo = document.getElementById('fDateTo');
  if (fDateFrom) fDateFrom.value = todayStr;
  if (fDateTo) fDateTo.value = todayStr;
  if (typeof applyFilterPanel === 'function') applyFilterPanel();
  else if (typeof renderList === 'function') renderList();
}

// コアラのアドバイス枠（運用ダッシュ用）
function renderDashKoalaAdvice() {
  const box = document.getElementById('dashKoalaAdvice');
  const img = document.getElementById('dashChar');
  const txt = document.getElementById('dashBubbleText');
  if (!box || !img || !txt) return;
  const metrics = (typeof computeOperationMetrics === 'function') ? computeOperationMetrics() : null;
  if (!metrics) { box.style.display = 'none'; return; }

  let mood = 'koala-good';
  let msg = '対応待ちもなくいい流れ！この調子でいこう。';
  if (metrics.delayedCount >= 3) {
    mood = 'koala-think';
    msg = `${metrics.delayedCount}名の対応が3日以上止まってる。早めに見てあげよう。`;
  } else if (metrics.todayInterviews >= 3) {
    mood = 'koala-pc';
    msg = `今日は面接が${metrics.todayInterviews}件。集中していこう。`;
  } else if (metrics.pendingCount >= 5) {
    mood = 'koala-think';
    msg = `対応待ちが${metrics.pendingCount}名。ひとつずつ進めていこう。`;
  } else if (metrics.thisMonthApplyGrowth >= 30) {
    mood = 'koala-kira';
    msg = `今月の応募が好調！前月比+${metrics.thisMonthApplyGrowth}%、その調子！`;
  } else if (metrics.pendingCount === 0 && metrics.todayInterviews === 0) {
    mood = 'koala-good';
    msg = '今日はゆったり進められそう。応募者ケアやマスター整備にどうぞ。';
  }
  // 画像をフェードで差し替え
  const newSrc = `assets/${mood}.png`;
  if (!img.src.endsWith(newSrc)) {
    img.style.transition = 'opacity 0.3s ease';
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = newSrc;
      img.style.opacity = '1';
    }, 200);
  }
  txt.textContent = msg;
  box.style.display = 'flex';
}

// 「自分の担当のみ」設定を復元、トグル表示制御
function initDashMineToggle() {
  const wrap = document.getElementById('dashMineToggleWrap');
  const chk = document.getElementById('dashMineOnly');
  if (!wrap || !chk) return;
  // currentStaffId 無し or admin の場合は非表示
  if (!currentStaffId) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'inline-flex';
  // localStorageから復元
  let saved = '0';
  try { saved = localStorage.getItem('saiyoCoreDashMineOnly') || '0'; } catch(e) {}
  dashMineOnly = (saved === '1');
  chk.checked = dashMineOnly;
}

// ============================================================================
// Step 4: 採用分析ダッシュボード
// ============================================================================

// 採用分析モード時の自動更新タイマー
let anDashRefreshTimer = null;

function startAnDashAutoRefresh() {
  stopAnDashAutoRefresh();
  anDashRefreshTimer = setInterval(() => {
    const sec = document.getElementById('sec-analytics-dash');
    if (sec && sec.classList.contains('active')) {
      refreshAnalyticsDash(true);
    }
  }, 5 * 60 * 1000);
}
function stopAnDashAutoRefresh() {
  if (anDashRefreshTimer) {
    clearInterval(anDashRefreshTimer);
    anDashRefreshTimer = null;
  }
}

// 採用分析ダッシュ：今すぐ更新
async function refreshAnalyticsDash(silent) {
  try {
    // 広告データを再ロード（存在する場合）
    if (typeof adsLoadAnalytics === 'function') {
      try { await adsLoadAnalytics(); } catch(e) {}
    }
    renderAnalyticsDash();
  } catch(e) { console.warn('[refreshAnalyticsDash] エラー', e); }
}

// メイン：採用分析ダッシュを描画
function renderAnalyticsDash() {
  // 日付ラベル更新
  const dateEl = document.getElementById('anDashDate');
  if (dateEl) {
    const now = new Date();
    const wd = ['日','月','火','水','木','金','土'][now.getDay()];
    dateEl.textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日（${wd}）の分析サマリー`;
  }

  // 各パートを描画
  renderAnDashKpiCards();
  renderAnDashKoala();
  renderAnDashMonthly();
  renderAnDashWorstTop3();
  renderAnDashAlerts();
  // Step 5: モード概要バーも更新
  try { if (typeof renderModeQuickStats === 'function') renderModeQuickStats(); } catch(e) {}
}

// 採用分析ダッシュ：KPIカード（CPA・応募完了・採用数・消化率）
function renderAnDashKpiCards() {
  const el = document.getElementById('anDashKpiGrid');
  if (!el) return;

  // ad_performance_rows から最新月のデータを集計
  const metrics = computeAnDashMetrics();

  const trendHtml = (cur, prev, smallerIsBetter, suffix) => {
    if (!prev || prev === 0) return `<div class="an-dash-kpi-trend flat">前期データなし</div>`;
    if (cur === prev) return `<div class="an-dash-kpi-trend flat">→ ±0${suffix||''}</div>`;
    const diff = cur - prev;
    const pct = Math.round(Math.abs(diff) / prev * 100);
    const arrow = diff > 0 ? '▲' : '▼';
    const isGood = smallerIsBetter ? diff < 0 : diff > 0;
    const cls = (diff > 0)
      ? (isGood ? 'up-good' : 'up-bad')
      : (isGood ? 'down-good' : 'down-bad');
    return `<div class="an-dash-kpi-trend ${cls}">${arrow} 前期比 ${pct}%</div>`;
  };

  el.innerHTML = `
    <div class="an-dash-kpi-card" onclick="showSec('ads')">
      <div class="an-dash-kpi-label">CPA（応募単価）</div>
      <div class="an-dash-kpi-value" data-cu="cpa">${metrics.cpa ? '¥' + metrics.cpa.toLocaleString() : '—'}</div>
      ${trendHtml(metrics.cpa, metrics.prevCpa, true)}
    </div>
    <div class="an-dash-kpi-card" onclick="showSec('ads')">
      <div class="an-dash-kpi-label">応募完了</div>
      <div class="an-dash-kpi-value" data-cu="apply"><span class="cu-num">${metrics.apply.toLocaleString()}</span><span class="an-dash-kpi-unit">件</span></div>
      ${trendHtml(metrics.apply, metrics.prevApply, false)}
    </div>
    <div class="an-dash-kpi-card" onclick="showSec('analytics')">
      <div class="an-dash-kpi-label">採用数</div>
      <div class="an-dash-kpi-value" data-cu="hired"><span class="cu-num">${metrics.hired.toLocaleString()}</span><span class="an-dash-kpi-unit">名</span></div>
      ${trendHtml(metrics.hired, metrics.prevHired, false)}
    </div>
    <div class="an-dash-kpi-card" onclick="showSec('budget')">
      <div class="an-dash-kpi-label">費用</div>
      <div class="an-dash-kpi-value" data-cu="cost">¥${Math.round(metrics.cost).toLocaleString()}</div>
      ${trendHtml(metrics.cost, metrics.prevCost, false)}
    </div>
  `;

  // Step 5: 数値カウントアップアニメ（初回表示時のみ）
  if (!el.dataset.cuDone) {
    el.dataset.cuDone = '1';
    setTimeout(() => {
      try {
        const cpaEl = el.querySelector('[data-cu="cpa"]');
        if (cpaEl && metrics.cpa) animateCountUp(cpaEl, 0, metrics.cpa, 700, { prefix: '¥' });
        const applyNum = el.querySelector('[data-cu="apply"] .cu-num');
        if (applyNum) animateCountUp(applyNum, 0, metrics.apply, 700);
        const hiredNum = el.querySelector('[data-cu="hired"] .cu-num');
        if (hiredNum) animateCountUp(hiredNum, 0, metrics.hired, 700);
        const costEl = el.querySelector('[data-cu="cost"]');
        if (costEl && metrics.cost) animateCountUp(costEl, 0, Math.round(metrics.cost), 800, { prefix: '¥' });
      } catch(e) {}
    }, 80);
  }
}

// 採用分析ダッシュ：指標計算
function computeAnDashMetrics() {
  const res = {
    cpa: 0, prevCpa: 0,
    apply: 0, prevApply: 0,
    hired: 0, prevHired: 0,
    cost: 0, prevCost: 0,
    hasAdsData: false,
    months: []  // 月別推移用
  };

  // 広告データから集計
  if (typeof adsRows !== 'undefined' && Array.isArray(adsRows) && adsRows.length > 0) {
    res.hasAdsData = true;
    const byMonth = {};
    adsRows.forEach(r => {
      const m = r._month;
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = { cost: 0, apply: 0 };
      byMonth[m].cost += Number(r.cost) || 0;
      byMonth[m].apply += Number(r.apply) || 0;
    });
    const sortedMonths = Object.keys(byMonth).sort();
    if (sortedMonths.length > 0) {
      const latestM = sortedMonths[sortedMonths.length - 1];
      const cur = byMonth[latestM];
      res.apply = cur.apply;
      res.cost = cur.cost;
      res.cpa = cur.apply > 0 ? Math.round(cur.cost / cur.apply) : 0;
      if (sortedMonths.length >= 2) {
        const prevM = sortedMonths[sortedMonths.length - 2];
        const prev = byMonth[prevM];
        res.prevApply = prev.apply;
        res.prevCost = prev.cost;
        res.prevCpa = prev.apply > 0 ? Math.round(prev.cost / prev.apply) : 0;
      }
      // 月別推移用（直近6ヶ月）
      const recent = sortedMonths.slice(-6);
      res.months = recent.map(m => ({ month: m, apply: byMonth[m].apply || 0 }));
    }
  }

  // 採用数は applicants から（広告データだけでは判断不可）
  if (Array.isArray(applicants)) {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevD.toISOString().slice(0, 7);
    const isHired = a => {
      const cid = a.coreStatusId || (typeof STATUS_TO_CORE !== 'undefined' ? STATUS_TO_CORE[a.status] : null);
      return cid === 'hired' || cid === 'joined' || ['内定','内定承諾','採用'].includes(a.hireStatus);
    };
    res.hired = applicants.filter(a => a.appDate && a.appDate.startsWith(thisMonth) && isHired(a)).length;
    res.prevHired = applicants.filter(a => a.appDate && a.appDate.startsWith(prevMonth) && isHired(a)).length;
  }

  return res;
}

// 採用分析ダッシュ：コアラ診断（要約版）
function renderAnDashKoala() {
  const img = document.getElementById('anDashKoalaImg');
  const txt = document.getElementById('anDashKoalaText');
  const acts = document.getElementById('anDashKoalaActions');
  if (!img || !txt) return;

  const m = computeAnDashMetrics();

  let mood = 'koala-pc';
  let comment = 'まだ広告データが少ないみたい。データを取り込んでから分析するともっと深いことが分かるよ！';

  if (m.hasAdsData) {
    // 改善判定
    const cpaImp = m.prevCpa > 0 && m.cpa > 0 ? (m.prevCpa - m.cpa) / m.prevCpa * 100 : 0;
    const applyGrowth = m.prevApply > 0 ? (m.apply - m.prevApply) / m.prevApply * 100 : 0;

    if (cpaImp >= 10 && applyGrowth >= 10) {
      mood = 'koala-kira';
      comment = `すばらしい！CPAが前月比${Math.round(cpaImp)}%改善、応募完了も+${Math.round(applyGrowth)}%！この調子で行こう✨`;
    } else if (cpaImp >= 10) {
      mood = 'koala-kira';
      comment = `CPAが前月比${Math.round(cpaImp)}%改善！広告の費用対効果が上がってる感じ、その調子！`;
    } else if (applyGrowth >= 20) {
      mood = 'koala-kira';
      comment = `応募完了が前月比+${Math.round(applyGrowth)}%！注目度が上がってる、いいタイミング！`;
    } else if (cpaImp <= -15) {
      mood = 'koala-think';
      comment = `CPAが前月比+${Math.round(-cpaImp)}%悪化…広告原稿や入札を見直すタイミングかも。ワーストランキングを覗いてみよう。`;
    } else if (applyGrowth <= -20) {
      mood = 'koala-think';
      comment = `応募完了が前月比${Math.round(applyGrowth)}%減ってる。媒体ミックスや求人タイトルの見直しを検討しよう。`;
    } else {
      mood = 'koala-good';
      comment = `今月もデータは順調に推移中。詳しい改善ポイントは「応募者分析」や「有料広告実績」で見てみよう。`;
    }
  } else if (Array.isArray(applicants) && applicants.length > 0) {
    mood = 'koala-pc';
    comment = '広告データはまだだけど、応募者データは見れるよ。「応募者分析」で媒体別・職種別の傾向を見てみよう。';
  }

  // 画像フェード切替
  const newSrc = `assets/${mood}.png`;
  if (!img.src.endsWith(newSrc)) {
    img.style.transition = 'opacity 0.3s ease';
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = newSrc;
      img.style.opacity = '1';
    }, 200);
  }
  txt.textContent = comment;

  // アクションボタン
  if (acts) {
    const buttons = [];
    if (m.hasAdsData) {
      buttons.push(`<button class="an-dash-more" onclick="showSec('ads')">📣 有料広告実績を見る →</button>`);
    }
    buttons.push(`<button class="an-dash-more" onclick="showSec('analytics')">📈 応募者分析を見る →</button>`);
    acts.innerHTML = buttons.join('');
  }
}

// 採用分析ダッシュ：月別推移バー
function renderAnDashMonthly() {
  const el = document.getElementById('anDashMonthly');
  if (!el) return;
  const m = computeAnDashMetrics();

  if (!m.months || m.months.length === 0) {
    // 広告データが無い場合は応募者DBで補完
    if (Array.isArray(applicants) && applicants.length > 0) {
      const byMonth = {};
      applicants.forEach(a => {
        if (!a.appDate) return;
        const mm = a.appDate.slice(0, 7);
        byMonth[mm] = (byMonth[mm] || 0) + 1;
      });
      const sm = Object.keys(byMonth).sort();
      if (sm.length === 0) {
        el.innerHTML = '<div class="an-dash-empty">データがありません</div>';
        return;
      }
      m.months = sm.slice(-6).map(mm => ({ month: mm, apply: byMonth[mm] }));
    } else {
      el.innerHTML = '<div class="an-dash-empty">データがありません</div>';
      return;
    }
  }

  const maxV = Math.max(...m.months.map(d => d.apply), 1);
  const latestIdx = m.months.length - 1;

  el.innerHTML = m.months.map((d, idx) => {
    const h = Math.max(2, (d.apply / maxV) * 110);
    const isLatest = idx === latestIdx;
    const monthLabel = d.month.slice(5).replace(/^0/, '') + '月';
    return `<div class="an-dash-bar">
      <div class="an-dash-bar-num">${d.apply}</div>
      <div class="an-dash-bar-fill ${isLatest ? 'latest' : ''}" style="height:${h}px;"></div>
      <div class="an-dash-bar-label ${isLatest ? 'latest' : ''}">${monthLabel}</div>
    </div>`;
  }).join('');
}

// 採用分析ダッシュ：改善が必要な求人 TOP3
function renderAnDashWorstTop3() {
  const el = document.getElementById('anDashWorstTop3');
  if (!el) return;

  if (typeof adsRows === 'undefined' || !Array.isArray(adsRows) || adsRows.length === 0) {
    el.innerHTML = '<div class="an-dash-empty">広告データがまだありません</div>';
    return;
  }

  // 費用かかってるのに応募ゼロ
  const worst = adsRows
    .filter(r => (r.apply || 0) === 0 && (Number(r.cost) || 0) > 0)
    .sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0))
    .slice(0, 3);

  if (worst.length === 0) {
    el.innerHTML = `<div style="background:#eaf3de;border:0.5px solid #c0dd97;border-radius:7px;padding:14px;font-size:11px;color:#3B6D11;text-align:center;">✓ 改善が必要な求人はありません<br><span style="font-size:10px;opacity:0.8;">広告が効率よく回ってます！</span></div>`;
    return;
  }

  el.innerHTML = worst.map(r => {
    const title = r.job_title || '(無題)';
    const cost = Math.round(Number(r.cost) || 0);
    const cl = (r.click || 0).toLocaleString();
    return `<div class="an-dash-worst-item" onclick="showSec('ads')" title="${escapeHtml(title)}">
      <div class="an-dash-worst-title">${escapeHtml(title)}</div>
      <div class="an-dash-worst-meta">¥${cost.toLocaleString()} 消費 ／ クリック${cl} ／ 応募 0</div>
    </div>`;
  }).join('');
}

// 採用分析ダッシュ：重要アラート（予算枯渇 など）
function renderAnDashAlerts() {
  const el = document.getElementById('anDashAlerts');
  if (!el) return;
  const alerts = [];

  // 1) 予算消化警告
  if (typeof adsRows !== 'undefined' && Array.isArray(adsRows)) {
    const cpData = {};
    adsRows.forEach(r => {
      const cp = r.campaign || '';
      if (!cp) return;
      if (!cpData[cp]) cpData[cp] = { cost: 0, budget: null };
      cpData[cp].cost += Number(r.cost) || 0;
      if (cpData[cp].budget === null) {
        const budM = cp.match(/[¥￥]\s*([0-9,]+)/);
        if (budM) cpData[cp].budget = parseInt(budM[1].replace(/,/g, ''), 10);
      }
    });
    Object.entries(cpData).forEach(([cp, d]) => {
      if (d.budget && d.budget > 0) {
        const pct = (d.cost / d.budget) * 100;
        if (pct >= 95) {
          const shortCp = cp.length > 40 ? cp.slice(0, 38) + '…' : cp;
          alerts.push({
            type: 'danger',
            icon: '🚨',
            text: `<strong>${escapeHtml(shortCp)}</strong> の予算消化率が ${Math.round(pct)}%！もうすぐ枯渇します。`
          });
        } else if (pct >= 85) {
          const shortCp = cp.length > 40 ? cp.slice(0, 38) + '…' : cp;
          alerts.push({
            type: 'warning',
            icon: '⚠️',
            text: `<strong>${escapeHtml(shortCp)}</strong> の予算消化率が ${Math.round(pct)}%。要チェック。`
          });
        }
      }
    });
  }

  // 2) CPAが急悪化
  const m = computeAnDashMetrics();
  if (m.hasAdsData && m.prevCpa > 0 && m.cpa > 0) {
    const diff = (m.cpa - m.prevCpa) / m.prevCpa * 100;
    if (diff >= 25) {
      alerts.push({
        type: 'warning',
        icon: '📊',
        text: `CPAが前月比 <strong>+${Math.round(diff)}%</strong> 悪化中。広告原稿の見直しを推奨します。`
      });
    }
  }

  if (alerts.length === 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = `<div style="font-size:11px;color:#888;margin-bottom:8px;font-weight:500;">🔔 重要アラート</div>` +
    alerts.map(a => `<div class="an-dash-alert-item ${a.type === 'danger' ? 'danger' : ''}">
      <span style="font-size:16px;">${a.icon}</span>
      <span style="flex:1;line-height:1.6;">${a.text}</span>
    </div>`).join('');
}

// ============================================================================
// Step 5: 仕上げ - モード概要バー / 数値カウントアップ / クリックリップル
// ============================================================================

// モード概要バー（KPI帯）を描画
function renderModeQuickStats() {
  const el = document.getElementById('modeQuickStats');
  if (!el) return;
  // モード未選択（ホーム表示中）は非表示
  if (!saiyoActiveMode) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  let html = '';
  try {
    if (saiyoActiveMode === 'operation') {
      // 採用運用モード：対応待ち / 今日の面接 / 遅延警告
      const m = (typeof computeOperationMetrics === 'function') ? computeOperationMetrics() : null;
      if (m) {
        const pendCls = m.pendingCount >= 5 ? 'warn' : 'mqs-value';
        const delCls = m.delayedCount > 0 ? 'danger' : '';
        html = `
          <span class="mqs-item"><span class="mqs-label">対応待ち</span><span class="mqs-value ${pendCls}">${m.pendingCount}<span style="font-size:9px;color:#888;">名</span></span></span>
          <span class="mqs-divider"></span>
          <span class="mqs-item"><span class="mqs-label">今日の面接</span><span class="mqs-value">${m.todayInterviews}<span style="font-size:9px;color:#888;">件</span></span></span>
          ${m.delayedCount > 0 ? `<span class="mqs-divider"></span><span class="mqs-item"><span class="mqs-label">遅延</span><span class="mqs-value danger">${m.delayedCount}<span style="font-size:9px;color:#888;">名</span></span></span>` : ''}
        `;
      }
    } else if (saiyoActiveMode === 'analytics') {
      // 採用分析モード：CPA / 応募完了 / 改善トレンド
      const m = (typeof computeAnDashMetrics === 'function') ? computeAnDashMetrics() : null;
      if (m && m.hasAdsData) {
        const cpaDiff = m.prevCpa > 0 && m.cpa > 0 ? (m.prevCpa - m.cpa) / m.prevCpa * 100 : 0;
        const cpaCls = cpaDiff >= 5 ? 'good' : (cpaDiff <= -5 ? 'danger' : 'mqs-value');
        const cpaArrow = cpaDiff >= 5 ? '↓' : (cpaDiff <= -5 ? '↑' : '→');
        html = `
          <span class="mqs-item"><span class="mqs-label">CPA</span><span class="mqs-value">¥${m.cpa.toLocaleString()}</span></span>
          ${m.prevCpa > 0 ? `<span class="mqs-item"><span class="mqs-value ${cpaCls}">${cpaArrow} ${Math.abs(Math.round(cpaDiff))}%</span></span>` : ''}
          <span class="mqs-divider"></span>
          <span class="mqs-item"><span class="mqs-label">応募</span><span class="mqs-value">${m.apply}<span style="font-size:9px;color:#888;">件</span></span></span>
        `;
      } else if (Array.isArray(applicants) && applicants.length > 0) {
        // 広告データなくても応募者だけで簡易表示
        const thisMonth = new Date().toISOString().slice(0, 7);
        const cnt = applicants.filter(a => a.appDate && a.appDate.startsWith(thisMonth)).length;
        html = `<span class="mqs-item"><span class="mqs-label">今月応募</span><span class="mqs-value">${cnt}<span style="font-size:9px;color:#888;">名</span></span></span>`;
      }
    }
    // admin_settings は概要バーなし
  } catch(e) {
    console.warn('[renderModeQuickStats] エラー', e);
  }
  if (html) {
    el.innerHTML = html;
    el.style.display = 'inline-flex';
  } else {
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

// 数値カウントアップアニメ
// 使い方：animateCountUp(element, fromValue, toValue, durationMs, { prefix, suffix, formatter })
function animateCountUp(el, from, to, duration, options) {
  if (!el) return;
  options = options || {};
  const dur = duration || 600;
  const start = performance.now();
  const fmt = options.formatter || ((v) => Math.round(v).toLocaleString());
  const prefix = options.prefix || '';
  const suffix = options.suffix || '';
  el.classList.add('countup');
  function step(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / dur);
    // ease-out
    const e = 1 - Math.pow(1 - t, 3);
    const cur = from + (to - from) * e;
    el.textContent = prefix + fmt(cur) + suffix;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = prefix + fmt(to) + suffix;
    }
  }
  requestAnimationFrame(step);
}

// モードカードクリック時のリップル演出
function rippleEffect(event) {
  try {
    const card = event.currentTarget;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const r = document.createElement('span');
    r.className = 'ripple';
    r.style.width = r.style.height = size + 'px';
    r.style.left = (event.clientX - rect.left - size / 2) + 'px';
    r.style.top = (event.clientY - rect.top - size / 2) + 'px';
    card.appendChild(r);
    setTimeout(() => r.remove(), 700);
  } catch(e) {}
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
  // Step 3: 採用運用ダッシュへの昇格に伴い、renderDashKoalaAdvice() に統合
  // この関数は呼ばれても何もしない（互換性維持のため残す）
  return;
}
function updateDashBubbleInner(total, inProgress, hired, rate, thisMonth) {
  // Step 3: 無効化（renderDashKoalaAdvice に統合）
  return;
  // === 以下は旧コード（実行されない） ===
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
  // 設計通り4種類のコアラを状況に応じて切り替え
  // 通常=PC、達成系=キラキラ、完了=グッド、注意=考える
  let charSrc = 'assets/koala-pc.png';

  // 優先度高：注意・対応必要 → 考える顔
  if (overdueTasks > 0) {
    lines.push(`あっ、タスクが<br><strong style="color:#D85A30;">${overdueTasks}件</strong>期限切れだよ〜<br>見てあげて！`);
    charSrc = 'assets/koala-think.png';
  } else if (uncontacted > 0) {
    lines.push(`<strong style="color:#D85A30;">${uncontacted}名</strong>のことが気になるなぁ。<br>連絡してあげて〜！`);
    charSrc = 'assets/koala-think.png';
  }
  // 優先度中：タスク残り → PC作業中
  else if (pendingTasks > 0) {
    lines.push(`タスクが<strong>${pendingTasks}件</strong>残ってるよ〜<br>一緒にがんばろ！`);
    charSrc = 'assets/koala-pc.png';
  }
  // 嬉しいニュース：採用達成 → キラキラ
  else if (hired > 0 && total > 0 && (hired / total) >= 0.3) {
    lines.push(`採用率<strong style="color:#1f8a5e;">${rate}%</strong>！<br>すごい成果だよ〜✨`);
    charSrc = 'assets/koala-kira.png';
  }
  else if (thisMonth >= 5) {
    lines.push(`今月は<strong>${thisMonth}名</strong>も<br>応募が来たね〜！すごい！`);
    charSrc = 'assets/koala-kira.png';
  }
  // 何もない＝完了状態 → グッド
  else if (pendingTasks === 0 && uncontacted === 0 && overdueTasks === 0) {
    lines.push(`今日のやることは全部済んでるね、<br>お疲れさま〜👍`);
    charSrc = 'assets/koala-good.png';
  }
  // フォールバック：通常 → PC
  if (lines.length === 0) {
    lines.push(`今日もみんな元気だよ〜！<br>採用率<strong>${rate}%</strong>、<br>総応募<strong>${total}名</strong>！`);
    charSrc = 'assets/koala-pc.png';
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
  const clientFilter = isAdmin ? (document.getElementById('anClient')?.value || '') : '';
  return applicants.filter(a=>{
    if(from&&a.appDate<from)return false;
    if(to&&a.appDate>to)return false;
    if(dept&&a.dept!==dept)return false;
    if(job&&a.jobType!==job)return false;
    if(clientFilter&&a.clientId!==clientFilter)return false;
    return true;
  });
}

// admin分析画面用：クライアント絞り込みプルダウンを生成・表示制御
function populateAnClientFilter() {
  const sel = document.getElementById('anClient');
  if (!sel) return;
  if (!isAdmin) {
    sel.style.display = 'none';
    return;
  }
  const cidsInApps = [...new Set(applicants.map(a => a.clientId).filter(Boolean))];
  const allCids = new Set();
  (clients || []).forEach(c => { if (c.client_id) allCids.add(c.client_id); });
  cidsInApps.forEach(c => allCids.add(c));
  const sortedCids = [...allCids].sort((a, b) => {
    const an = getClientDisplayName(a);
    const bn = getClientDisplayName(b);
    return an.localeCompare(bn, 'ja');
  });
  const cur = sel.value;
  sel.innerHTML = '<option value="">全クライアント</option>'
    + sortedCids.map(cid => `<option value="${escapeOwnerHtml(cid)}">${escapeOwnerHtml(getClientDisplayName(cid))}</option>`).join('');
  sel.style.display = 'inline-block';
  if (cur) sel.value = cur;
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
// 平均リードタイム（events テーブルから各コアステータスの初到達日を割り出す）
// ========================================

// クライアント単位でキャッシュするリードタイムマップ
// 構造: { applicantId: { applied:'YYYY-MM-DD', in_progress:..., interview:..., hired:..., joined:... } }
let _leadTimeMap = null;
let _leadTimeMapClientKey = null;

// 詳細ステータス名 → コアステータス（events.metadata.new から逆引き）
function _detailNameToCore(detailName) {
  if (!detailName) return null;
  // 1) 現クライアントの detailStatuses から（DBに登録済みのもの）
  const ds = (detailStatuses || []).find(d => d.name === detailName);
  if (ds) return ds.core_status_id;
  // 2) DEFAULT_DETAIL_STATUS から（フォールバック）
  const def = DEFAULT_DETAIL_STATUS.find(d => d.name === detailName);
  if (def) return def.core_status_id;
  // 3) 旧→新の名称マップ（STATUS_TO_CORE）
  if (STATUS_TO_CORE[detailName]) return STATUS_TO_CORE[detailName];
  return null;
}

// events を読み込んで「応募者ごとのコアステータス初到達日マップ」を構築
async function buildLeadTimeMap() {
  // クライアントが切り替わったらキャッシュクリア
  const ck = (isAdmin ? 'admin' : (currentClientId || '')) + '|' + applicants.length;
  if (_leadTimeMap && _leadTimeMapClientKey === ck) return _leadTimeMap;

  const map = {};
  // 全応募者に「応募日 = applied 到達日」を入れる（events に頼らず確定）
  applicants.forEach(a => {
    map[a.id] = {};
    if (a.appDate) map[a.id].applied = String(a.appDate).slice(0, 10);
  });

  try {
    let q = sb.from('events')
      .select('applicant_id, event_type, metadata, created_at')
      .eq('event_type', 'status_change')
      .order('created_at', { ascending: true }); // 古い順
    if (!isAdmin && currentClientId) q = q.eq('client_id', currentClientId);
    const { data, error } = await q;
    if (error) { console.warn('[buildLeadTimeMap] events取得失敗', error); _leadTimeMap = map; _leadTimeMapClientKey = ck; return map; }

    (data || []).forEach(ev => {
      const aid = ev.applicant_id;
      if (!aid || !map[aid]) return;
      const newName = ev.metadata && ev.metadata.new;
      const cid = _detailNameToCore(newName);
      if (!cid) return;
      // 初到達のみ記録（古い順なので、すでに値があればスキップ）
      if (!map[aid][cid]) {
        map[aid][cid] = String(ev.created_at).slice(0, 10);
      }
    });
  } catch (e) {
    console.warn('[buildLeadTimeMap] 例外', e);
  }

  // applied → in_progress のフォールバック：
  // events で in_progress 日が取れていない応募者は、applicants.contact_date を使う
  // contact_date もなければ、現在のステータスが applied より先（in_progress 以降）の場合は appDate と同日扱い
  applicants.forEach(a => {
    if (!map[a.id]) return;
    if (map[a.id].in_progress) return; // 既にあればスキップ
    if (a.contactDate) {
      map[a.id].in_progress = String(a.contactDate).slice(0, 10);
    } else {
      // 現在のコアステータスが in_progress 以降なら、applied 日を流用
      // （古いデータで events も contact_date もないが、状態は進んでいるケースの救済）
      const cid = a.coreStatusId || STATUS_TO_CORE[a.status];
      const advancedStates = ['in_progress', 'interview', 'hired', 'joined'];
      if (cid && advancedStates.includes(cid) && map[a.id].applied) {
        // events に詳細日がない場合は in_progress = applied 日とみなす（リードタイム0日）
        map[a.id].in_progress = map[a.id].applied;
      }
    }
  });

  _leadTimeMap = map;
  _leadTimeMapClientKey = ck;
  return map;
}

// 2つの YYYY-MM-DD の差（dateB - dateA、日数）。失敗時は null
function _diffDays(a, b) {
  if (!a || !b) return null;
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  if (isNaN(da) || isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
}

// data（フィルタ済み応募者配列）から平均リードタイムを算出
function calcLeadTimes(data, ltMap) {
  const pairs = [
    { key: 'app_to_in',   fromKey: 'applied',     toKey: 'in_progress' },
    { key: 'in_to_int',   fromKey: 'in_progress', toKey: 'interview'   },
    { key: 'int_to_hire', fromKey: 'interview',   toKey: 'hired'       },
    { key: 'hire_to_join',fromKey: 'hired',       toKey: 'joined'      },
    { key: 'app_to_join', fromKey: 'applied',     toKey: 'joined'      },
  ];
  const result = {};
  pairs.forEach(p => {
    const diffs = [];
    data.forEach(a => {
      const m = ltMap[a.id];
      if (!m) return;
      const d = _diffDays(m[p.fromKey], m[p.toKey]);
      if (d == null) return;        // 片方欠けている → 除外
      if (d < 0) return;             // 逆順は異常データなので除外
      diffs.push(d);
    });
    if (diffs.length === 0) {
      result[p.key] = { count: 0, avg: null };
    } else {
      const sum = diffs.reduce((s, x) => s + x, 0);
      result[p.key] = { count: diffs.length, avg: sum / diffs.length };
    }
  });
  return result;
}

// リードタイム描画（renderAn から呼ばれる）
async function renderLeadTime(data) {
  const el = document.getElementById('anLeadTime');
  if (!el) return;
  const ltMap = await buildLeadTimeMap();
  const lt = calcLeadTimes(data, ltMap);

  const cards = [
    { label: '応募 → 対応中', key: 'app_to_in',    color: '#EF9F27', bg: '#FAEEDA' },
    { label: '対応中 → 面接', key: 'in_to_int',    color: '#9B59B6', bg: '#F5F4FD' },
    { label: '面接 → 採用',   key: 'int_to_hire',  color: '#27AE60', bg: '#EAF5EC' },
    { label: '採用 → 入社',   key: 'hire_to_join', color: '#1D9E75', bg: '#E1F5EE' },
    { label: '応募 → 入社',   key: 'app_to_join',  color: '#185FA5', bg: '#E6F1FB' },
  ];
  el.innerHTML = cards.map(c => {
    const r = lt[c.key];
    const valHtml = (r.avg == null)
      ? `<span style="font-size:24px;font-weight:600;color:#aaa;">-</span>`
      : `<span style="font-size:26px;font-weight:700;color:#1a1a1a;">${r.avg.toFixed(1)}</span><span style="font-size:11px;color:#888;font-weight:500;margin-left:3px;">日</span>`;
    const subHtml = (r.count === 0)
      ? `<span style="color:#aaa;">対象0名</span>`
      : `対象 ${r.count}名 / 平均`;
    return `
      <div style="background:#fff;border:1px solid #e8e8e6;border-radius:10px;padding:12px 14px;border-top:3px solid ${c.color};">
        <div style="font-size:10.5px;color:#666;font-weight:600;margin-bottom:6px;">${c.label}</div>
        <div style="line-height:1.1;margin-bottom:4px;">${valHtml}</div>
        <div style="font-size:10px;color:#888;">${subHtml}</div>
      </div>`;
  }).join('');

  // 月別リードタイム集計（応募月ベース）
  renderLeadTimeMonthly(data, ltMap);
}

// 月別リードタイム集計テーブル描画
// 応募月（appDate の YYYY-MM）でグルーピングし、各リードタイムの平均を計算
function renderLeadTimeMonthly(data, ltMap) {
  const el = document.getElementById('anLeadTimeMonthly');
  if (!el) return;

  // 応募月ごとに応募者をグループ化
  const byMonth = {};
  data.forEach(a => {
    if (!a.appDate) return;
    const m = String(a.appDate).slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(a);
  });

  const months = Object.keys(byMonth).sort();
  if (months.length === 0) {
    el.innerHTML = `<div style="font-size:11px;color:#aaa;text-align:center;padding:20px 0;">データがありません</div>`;
    return;
  }

  const pairs = [
    { key: 'app_to_in',    label: '応募→対応中', color: '#EF9F27' },
    { key: 'in_to_int',    label: '対応中→面接', color: '#9B59B6' },
    { key: 'int_to_hire',  label: '面接→採用',   color: '#27AE60' },
    { key: 'hire_to_join', label: '採用→入社',   color: '#1D9E75' },
    { key: 'app_to_join',  label: '応募→入社',   color: '#185FA5' },
  ];

  // 各月のリードタイムを計算
  const rows = months.map(m => {
    const monthData = byMonth[m];
    const lt = calcLeadTimes(monthData, ltMap);
    return { month: m, count: monthData.length, lt };
  });

  // 全体平均（合計行）
  const allLt = calcLeadTimes(data, ltMap);

  // テーブル描画
  const fmtCell = (r) => {
    if (!r || r.avg == null) return `<span style="color:#bbb;">-</span>`;
    return `<span style="font-weight:600;">${r.avg.toFixed(1)}</span><span style="font-size:9.5px;color:#888;margin-left:2px;">日 (${r.count})</span>`;
  };

  let html = `
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:11.5px;min-width:560px;">
      <thead>
        <tr style="background:#fafafa;">
          <th style="padding:8px 10px;text-align:left;font-weight:600;border-bottom:1px solid #e8e8e6;">月</th>
          <th style="padding:8px 10px;text-align:right;font-weight:600;border-bottom:1px solid #e8e8e6;">応募</th>`;
  pairs.forEach(p => {
    html += `<th style="padding:8px 10px;text-align:right;font-weight:600;border-bottom:1px solid #e8e8e6;color:${p.color};white-space:nowrap;">${p.label}</th>`;
  });
  html += `</tr></thead><tbody>`;

  rows.forEach(row => {
    html += `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">${row.month}</td>
      <td style="padding:7px 10px;text-align:right;border-bottom:1px solid #f0f0f0;">${row.count}</td>`;
    pairs.forEach(p => {
      html += `<td style="padding:7px 10px;text-align:right;border-bottom:1px solid #f0f0f0;">${fmtCell(row.lt[p.key])}</td>`;
    });
    html += `</tr>`;
  });

  // 合計行
  html += `<tr style="background:#fafafa;font-weight:600;">
    <td style="padding:8px 10px;">合計</td>
    <td style="padding:8px 10px;text-align:right;">${data.length}</td>`;
  pairs.forEach(p => {
    html += `<td style="padding:8px 10px;text-align:right;">${fmtCell(allLt[p.key])}</td>`;
  });
  html += `</tr></tbody></table></div>`;

  // 注釈
  html += `<div style="margin-top:8px;font-size:10px;color:#888;line-height:1.5;">※「(数字)」は対象者数。応募日が属する月で集計しています。</div>`;

  el.innerHTML = html;
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

async function renderAn() {
  // admin時はクライアント絞り込みプルダウンを生成
  populateAnClientFilter();
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

  // 平均リードタイム（月別集計の直前に描画）
  await renderLeadTime(data);

  // 月別集計（全体）
  const monthlyEl = document.getElementById('anMonthlyFixed');
  if (monthlyEl) monthlyEl.innerHTML = renderMonthTable(buildMonthStats(data), '');

  // コアラコーチ：データから改善案を生成
  renderKoalaCoach(data);

  renderAnContent(data);
}

// ========================================
// コアラコーチ（分析データからの改善提案）
// ========================================
function renderKoalaCoach(data) {
  const box = document.getElementById('koalaCoachBox');
  const introEl = document.getElementById('koalaCoachIntro');
  const advicesEl = document.getElementById('koalaCoachAdvices');
  if (!box || !introEl || !advicesEl) return;

  // データが0件なら非表示
  if (!data || data.length === 0) {
    box.style.display = 'none';
    return;
  }

  const advices = analyzeAndAdvise(data);
  box.style.display = 'block';
  const charImg = box.querySelector('img');

  if (advices.length === 0) {
    // 全部順調なときは褒める
    box.style.background = 'linear-gradient(135deg,#E1F5EE 0%,#EAF3DE 100%)';
    box.style.border = '1px solid #5DCAA5';
    if (charImg) charImg.src = 'assets/koala-kira.png';
    introEl.textContent = 'すべて順調みたい！この調子で頑張って〜✨';
    advicesEl.innerHTML = '';
    return;
  }

  box.style.background = 'linear-gradient(135deg,#E1F5EE 0%,#FAEEDA 100%)';
  box.style.border = '1px solid #5DCAA5';
  if (charImg) charImg.src = 'assets/koala-think.png';
  introEl.innerHTML = `データを分析したよ。気になるポイントが<strong>${advices.length}つ</strong>あったから、改善案を提案するね！`;

  advicesEl.innerHTML = advices.map((adv, idx) => {
    const colorMap = { high:'#D85A30', mid:'#BA7517', low:'#1D9E75' };
    const bgMap = { high:'#FAECE7', mid:'#FAEEDA', low:'#E1F5EE' };
    const labelMap = { high:'要対応', mid:'要注意', low:'参考' };
    const c = colorMap[adv.severity] || '#666';
    const bg = bgMap[adv.severity] || '#fafafa';
    return `<div style="background:#fff;border-left:3px solid ${c};border-radius:6px;padding:10px 12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:10px;background:${bg};color:${c};padding:2px 7px;border-radius:9px;font-weight:600;">${labelMap[adv.severity]}</span>
        <span style="font-size:12px;font-weight:600;color:#1a1a1a;">${escapeHtml(adv.title)}</span>
      </div>
      <div style="font-size:11px;color:#666;margin-bottom:6px;">${escapeHtml(adv.observation)}</div>
      <div style="font-size:11px;color:#1a1a1a;line-height:1.6;">
        <strong style="color:${c};">改善案：</strong>
        <ol style="margin:4px 0 0 18px;padding:0;">
          ${adv.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
      </div>
    </div>`;
  }).join('');
}

// 分析→改善案を生成するロジック
function analyzeAndAdvise(data) {
  const advices = [];
  const total = data.length;
  if (total === 0) return advices;

  // ============= ステータス未入力（データ件数によらずチェック） =============
  const noStatus = data.filter(a => !a.status || !a.coreStatusId).length;
  if (noStatus > 0) {
    advices.push({
      severity: noStatus / total >= 0.3 ? 'high' : 'mid',
      title: 'ステータス未入力の応募者がいるよ',
      observation: `${total}件中${noStatus}件（${Math.round(noStatus/total*100)}%）でステータスが入力されてないよ。状況が見えないと改善も難しいよね。`,
      suggestions: [
        '応募者一覧でフィルタして未入力者を一覧化',
        '担当者と週1で進捗確認のミーティングを設定',
        'ステータス変更をルーチンワークに組み込み（毎日5分）'
      ]
    });
  }

  // ============= 担当者未割当（データ件数によらずチェック） =============
  const noStaff = data.filter(a => !(a.staffIds || []).length).length;
  // 進行中の応募者で担当未割当がある場合のみ警告
  const activeNoStaff = data.filter(a => {
    if ((a.staffIds || []).length > 0) return false;
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || '';
    return ['applied','in_progress','interview'].includes(cid);
  }).length;
  if (activeNoStaff > 0) {
    advices.push({
      severity: activeNoStaff >= 3 || (activeNoStaff / total) > 0.3 ? 'high' : 'mid',
      title: '担当者が決まってない応募者がいるよ',
      observation: `選考中の応募者${activeNoStaff}名に担当者が紐付いてないよ。誰が見るかが曖昧だと取りこぼしの原因に。`,
      suggestions: [
        '応募者編集画面で担当者を割り当て',
        '応募者一覧の絞り込みで「担当者未割当のみ」フィルタを使って一括対応',
        '新規登録時に担当者を必須項目化（運用ルール）'
      ]
    });
  }

  // ============= 媒体未入力（データ件数によらずチェック） =============
  const noMedia = data.filter(a => !a.media).length;
  if (noMedia > 0 && (noMedia / total) > 0.2) {
    advices.push({
      severity: 'mid',
      title: '応募経路が記録されてないよ',
      observation: `応募${total}件中、媒体未入力が${noMedia}件（${Math.round(noMedia/total*100)}%）。どこから来たか分からないと改善できないよ。`,
      suggestions: [
        '新規登録時に「媒体」を必須項目にする運用ルール化',
        '過去データを担当者ヒアリングで埋め直し',
        '一括取り込み時に媒体カラムを必ず入れる'
      ]
    });
  }

  // ============= 採用率（採用/応募）チェック（5件以上で発動） =============
  const hired = data.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || '';
    return cid === 'hired' || cid === 'joined';
  }).length;
  const hireRate = total > 0 ? (hired / total * 100) : 0;
  if (total >= 5 && hireRate < 10 && hired === 0) {
    advices.push({
      severity: 'high',
      title: '採用率が低めだよ',
      observation: `応募${total}件のうち採用は${hired}件（${hireRate.toFixed(1)}%）。母集団は十分だけどマッチが少ない状態。`,
      suggestions: [
        '求人票の必須要件を見直して、応募ハードルが適切か確認',
        '面接で何が原因で見送りになってるかタイムラインを振り返り',
        '書類選考の通過基準が厳しすぎないかチェック'
      ]
    });
  }

  // ============= 媒体偏り（5件以上で発動） =============
  if (total >= 5) {
    const mediaCounts = {};
    data.forEach(a => {
      if (!a.media) return;
      mediaCounts[a.media] = (mediaCounts[a.media] || 0) + 1;
    });
    const mediaList = Object.entries(mediaCounts).sort((a,b) => b[1]-a[1]);
    if (mediaList.length > 0) {
      const top = mediaList[0];
      const totalWithMedia = data.filter(a => a.media).length;
      if (totalWithMedia > 0 && (top[1] / totalWithMedia) > 0.7) {
        advices.push({
          severity: 'mid',
          title: `「${top[0]}」に頼りすぎてるかも`,
          observation: `媒体記録のある応募${totalWithMedia}件中、${top[1]}件（${Math.round(top[1]/totalWithMedia*100)}%）が${top[0]}経由。1媒体依存はリスク高め。`,
          suggestions: [
            '他の媒体（リファラル・SNS・他求人サイト）への出稿を検討',
            'リファラル制度を立ち上げて社員紹介を活性化',
            '直近採用者にどこで知ったか聞いて、効果のある経路を特定'
          ]
        });
      }
    }
  }

  // ============= 退職・辞退率（3件以上で発動） =============
  const resigned = data.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || '';
    return cid === 'resigned';
  }).length;
  const other = data.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || '';
    return cid === 'other';
  }).length;
  const dropRate = total > 0 ? ((resigned + other) / total * 100) : 0;
  if (total >= 3 && dropRate >= 30) {
    advices.push({
      severity: 'high',
      title: '辞退・退職が多いね',
      observation: `応募${total}件中、退職・辞退・その他で${resigned + other}件（${dropRate.toFixed(1)}%）。歩留まり改善の余地あり。`,
      suggestions: [
        '退職した人のタイムラインを振り返ってミスマッチ要因を特定',
        '面接時に求人票と実態の乖離がないか説明を強化',
        '入社後フォロー（30日・90日チェックイン）を設定'
      ]
    });
  }

  // ============= 対応スピード（応募→対応中）=============
  const todayStr = new Date().toISOString().slice(0,10);
  const slowResponse = data.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || '';
    if (cid !== 'applied') return false;
    if (!a.appDate) return false;
    const diff = Math.round((new Date(todayStr) - new Date(a.appDate)) / 86400000);
    return diff >= 3;
  }).length;
  if (slowResponse >= 1) {
    advices.push({
      severity: slowResponse >= 3 ? 'high' : 'mid',
      title: '初動対応が遅れてる人がいるよ',
      observation: `応募から3日以上経過してるのに「応募」ステータスのままの人が${slowResponse}名。初動が遅いと辞退率が上がるよ。`,
      suggestions: [
        '応募当日〜翌営業日に初回連絡する運用ルールを設定',
        'スケジュール画面の「今日対応すべき人」を毎朝チェック',
        '担当者間で対応漏れを共有するフローを作る'
      ]
    });
  }

  // ============= 面接通過率（3件以上で発動） =============
  const inInterview = data.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || '';
    return cid === 'interview';
  }).length;
  if (total >= 3 && inInterview >= 3 && hired === 0) {
    advices.push({
      severity: 'mid',
      title: '面接で止まってる人が多いね',
      observation: `面接ステータスの人が${inInterview}名いるけど、まだ採用に至ってない。意思決定が遅れてる可能性あり。`,
      suggestions: [
        '各面接の結果を早めに記録してパイプラインを進める',
        '面接官の評価基準を統一し意思決定をスピード化',
        '面接終了後24時間以内に合否を出すルール化'
      ]
    });
  }

  // 重要度順にソート（high → mid → low）
  const sevOrder = { high: 0, mid: 1, low: 2 };
  advices.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  // 最大3つまで
  return advices.slice(0, 3);
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
  populateMinutesClientFilter();
  renderMinutesCalendar();
  const el = document.getElementById('minutesList');

  // adminのクライアント絞り込み値
  const minClientFilter = isAdmin ? (document.getElementById('minutesClientFilter')?.value || '') : '';

  // フィルター適用
  const fil = minutes.filter(m => {
    if (minClientFilter && m.clientId !== minClientFilter) return false;
    return true;
  });

  if (!fil.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;"><img src="assets/koala-kira-small.png" style="width:70px;opacity:.8;"><div style="font-size:12px;color:#aaa;margin-top:8px;">議事録がまだありません。右上の「＋ 新規議事録」から追加してください。</div></div>';
    return;
  }

  // admin かつ クライアント絞り込みなし時はグルーピング表示
  const useGrouping = isAdmin && !minClientFilter;

  const renderMinuteCard = (m) => {
    const mTasks = tasks.filter(t => t.minuteId === m.id);
    const mId = 'minute_' + m.id;
    const pendingCount = mTasks.filter(t => !t.done).length;
    const clientLabel = isAdmin && m.clientId ? `<span style="font-size:10px;color:#185FA5;background:#f0f6ff;border:1px solid #c8ddf5;border-radius:6px;padding:1px 6px;">${escapeOwnerHtml(getClientDisplayName(m.clientId))}</span>` : '';
    return `<div id="${mId}" style="border:1px solid #e8e8e6;border-radius:10px;margin-bottom:10px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.875rem 1rem;background:#fafafa;border-bottom:1px solid #f0f0ee;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="font-size:12px;color:#aaa;">${m.date}</div>
          <div style="font-size:13px;font-weight:600;">${m.title||'MTG議事録'}</div>
          ${clientLabel}
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
  };

  if (useGrouping) {
    // クライアントID別にグルーピング
    const groups = {};
    fil.forEach(m => {
      const cid = m.clientId || '_no_client';
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push(m);
    });
    const sortedGroups = Object.entries(groups).sort((a, b) => {
      if (a[0] === '_no_client') return 1;
      if (b[0] === '_no_client') return -1;
      return getClientDisplayName(a[0]).localeCompare(getClientDisplayName(b[0]), 'ja');
    });
    el.innerHTML = sortedGroups.map(([cid, items]) => {
      const name = cid === '_no_client' ? '（未割当）' : getClientDisplayName(cid);
      return `<div style="margin-bottom:1.25rem;">
        <div style="font-size:12px;font-weight:700;color:#185FA5;background:#f0f6ff;border:1px solid #c8ddf5;border-radius:8px;padding:6px 12px;margin-bottom:8px;display:inline-block;">${escapeOwnerHtml(name)} <span style="color:#aaa;font-weight:400;">(${items.length}件)</span></div>
        ${items.map(renderMinuteCard).join('')}
      </div>`;
    }).join('');
  } else {
    el.innerHTML = fil.map(renderMinuteCard).join('');
  }
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
  // adminのクライアント絞り込みプルダウンを毎回更新（タスク追加・削除で選択肢が変わるため）
  populateTaskClientFilter();

  const filter = document.getElementById('taskFilter')?.value || 'all';
  const today = new Date().toISOString().split('T')[0];
  // admin時は全件、client時は自社のみ
  let filtered = isAdmin ? [...tasks] : tasks.filter(t => t.clientId === currentClientId || !t.clientId);

  // adminのクライアント絞り込み
  if (isAdmin) {
    const clientFilter = document.getElementById('taskClientFilter')?.value || '';
    if (clientFilter) {
      filtered = filtered.filter(t => t.clientId === clientFilter);
    }
  }

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
    el.innerHTML = '<div style="text-align:center;padding:2rem;"><img src="assets/koala-kira-small.png" style="width:70px;opacity:.8;"><div style="font-size:12px;color:#aaa;margin-top:8px;">タスクはありません 🎉</div></div>';
    return;
  }

  // admin かつ クライアント絞り込みなし時はグルーピング表示
  const clientFilterValue = isAdmin ? (document.getElementById('taskClientFilter')?.value || '') : 'client';
  const useGrouping = isAdmin && !clientFilterValue;

  let html = '';
  const normal = pending.filter(t => !overdue.includes(t) && !dueSoon.includes(t));

  if (useGrouping) {
    // admin × 全クライアント表示：セクションごとにクライアント別グルーピング
    if (overdue.length)  html += buildGroupedSectionHTML(overdue,  '#D85A30', '⚠ 期限超過');
    if (dueSoon.length)  html += buildGroupedSectionHTML(dueSoon,  '#854F0B', '⏰ 期限間近');
    if (normal.length)   html += buildGroupedSectionHTML(normal,   '#666',    '未完了');
    if (done.length)     html += buildGroupedSectionHTML(done,     '#3B6D11', '✓ 完了');
  } else {
    // 通常表示（client、またはadminで特定クライアント絞り込み中）
    if (overdue.length) html += `<div style="margin-bottom:1rem;"><div style="font-size:11px;font-weight:600;color:#D85A30;margin-bottom:6px;">⚠ 期限超過（${overdue.length}件）</div>${overdue.map(t=>renderTaskRow(t)).join('')}</div>`;
    if (dueSoon.length) html += `<div style="margin-bottom:1rem;"><div style="font-size:11px;font-weight:600;color:#854F0B;margin-bottom:6px;">⏰ 期限間近（${dueSoon.length}件）</div>${dueSoon.map(t=>renderTaskRow(t)).join('')}</div>`;
    if (normal.length) html += `<div style="margin-bottom:1rem;"><div style="font-size:11px;font-weight:600;color:#666;margin-bottom:6px;">未完了（${normal.length}件）</div>${normal.map(t=>renderTaskRow(t)).join('')}</div>`;
    if (done.length) html += `<div><div style="font-size:11px;font-weight:600;color:#3B6D11;margin-bottom:6px;">✓ 完了（${done.length}件）</div>${done.map(t=>renderTaskRow(t)).join('')}</div>`;
  }
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
  // 自分のクライアントのタスクのみマーク（管理者はすべて、ただしクライアント絞り込みがあればそれを尊重）
  let visibleTasks = tasks.filter(t => isAdmin || t.clientId === currentClientId || !t.clientId);
  if (isAdmin) {
    const clientFilter = document.getElementById('taskClientFilter')?.value || '';
    if (clientFilter) {
      visibleTasks = visibleTasks.filter(t => t.clientId === clientFilter);
    }
  }
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
  // 既存タスクの内訳をクライアント別で表示（admin時）/件数のみ（client時）
  let existing = tasks.filter(t => t.due === dateStr && (isAdmin || t.clientId === currentClientId));
  if (isAdmin) {
    const clientFilter = document.getElementById('taskClientFilter')?.value || '';
    if (clientFilter) existing = existing.filter(t => t.clientId === clientFilter);
  }
  if (existing.length > 0) {
    if (isAdmin) {
      const groups = groupTasksByClient(existing);
      const breakdown = groups.map(g => `${g.name} ${g.items.length}件`).join('、');
      setStatus(`${dateStr} は既に${existing.length}件のタスクがあります（${breakdown}）`, 'ok');
    } else {
      setStatus(`${dateStr} は既に${existing.length}件のタスクがあります。新規追加もできます`, 'ok');
    }
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
    let q = sb.from('budgets').delete().eq('id', id);
    // adminでなければ、自分のクライアントIDに限定（他社のデータは削除できない）
    if (!isAdmin) q = q.eq('client_id', currentClientId);
    const { error } = await q;
    if (error) {
      console.warn('[deleteBudget] 削除失敗', error);
      alert('削除に失敗しました: ' + error.message);
      return;
    }
  } catch(e) {
    console.warn('[deleteBudget] 例外', e);
    alert('削除中にエラーが発生しました');
    return;
  }
  budgetData = budgetData.filter(d => String(d.id) !== String(id));
  renderBudget();
  setStatus('予算データを削除しました', 'ok');
}

// 既存予算データを編集する（フォームを開いて1行で値をプリセット）
function editBudget(id) {
  const target = budgetData.find(d => String(d.id) === String(id));
  if (!target) {
    alert('対象データが見つかりません');
    return;
  }
  // フォームを開く
  showBudgetForm();
  // addBudgetRow が空フォームを1行作るので、その値を編集対象で上書き
  const rows = document.getElementById('budgetInputRows').querySelectorAll('tr');
  const row = rows[rows.length - 1]; // 最後の行（直前にaddされた）
  if (!row) return;
  // dataset で「編集中ID」を保持（saveAllBudgets で upsert 時に同じIDを使うため）
  row.dataset.editingId = String(target.id);
  // 値をセット
  const setVal = (cls, val) => {
    const el = row.querySelector(cls);
    if (el && val != null) el.value = val;
  };
  setVal('.bMonth', target.month || '');
  setVal('.bMedia', target.media || '');
  setVal('.bType',  target.type  || 'media');
  setVal('.bDept',  target.dept  || '');
  setVal('.bJob',   target.job   || '');
  setVal('.bAmount', target.amount || 0);
  if (isAdmin) setVal('.bClient', target.clientId || '');
  // フォームの先頭にスクロール
  const form = document.getElementById('budgetForm');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setStatus('編集モード：内容を変更して保存してください', 'ok');
}

function showBudgetForm() {
  const form = document.getElementById('budgetForm');
  if (!form) return;
  form.style.display = 'block';
  // adminならクライアント列ヘッダーを表示
  const thClient = document.getElementById('budgetThClient');
  if (thClient) thClient.style.display = isAdmin ? 'table-cell' : 'none';
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

  // admin時はクライアント選択セルを追加（select id="budgetClientFilter"の選択値があればプリセット）
  let clientCell = '';
  if (isAdmin) {
    const cidsInBudget = [...new Set(budgetData.map(d => d.clientId).filter(Boolean))];
    const allCids = new Set();
    (clients || []).forEach(c => { if (c.client_id) allCids.add(c.client_id); });
    cidsInBudget.forEach(c => allCids.add(c));
    const sortedCids = [...allCids].sort((a, b) => getClientDisplayName(a).localeCompare(getClientDisplayName(b), 'ja'));
    const presetCid = document.getElementById('budgetClientFilter')?.value || '';
    const cOpts = sortedCids.map(cid => {
      const sel = cid === presetCid ? ' selected' : '';
      return `<option value="${escapeOwnerHtml(cid)}"${sel}>${escapeOwnerHtml(getClientDisplayName(cid))}</option>`;
    }).join('');
    clientCell = '<td style="padding:5px;"><select class="bClient" style="padding:5px;border:1.5px solid #378ADD;border-radius:6px;font-size:11px;background:#f0f6ff;color:#185FA5;font-weight:600;min-width:130px;"><option value="">選択してください</option>'+cOpts+'</select></td>';
  }

  document.getElementById('budgetInputRows').insertAdjacentHTML('beforeend',
    '<tr id="'+rid+'" style="border-bottom:1px solid #f0f0ee;">' +
    clientCell +
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
  const toSave = []; let hasError = false; let clientMissing = false;
  rows.forEach(row => {
    const month = row.querySelector('.bMonth')?.value || '';
    const media = row.querySelector('.bMedia')?.value || '';
    const type  = row.querySelector('.bType')?.value  || 'media';
    const dept  = row.querySelector('.bDept')?.value  || '';
    const job   = row.querySelector('.bJob')?.value   || '';
    const amount= parseInt(row.querySelector('.bAmount')?.value || '0') || 0;
    // adminは行ごとにクライアントを取得、それ以外はcurrentClientId
    let rowClientId = currentClientId;
    if (isAdmin) {
      const cv = row.querySelector('.bClient')?.value || '';
      if (!cv) { clientMissing = true; return; }
      rowClientId = cv;
    }
    if (!month || !media) { hasError = true; return; }
    if (!amount) return;
    // 編集モードの場合は既存IDを使う、新規は新IDを発行
    const editingId = row.dataset && row.dataset.editingId;
    const useId = editingId || (Date.now()+Math.random()+'');
    toSave.push({ id: useId, month, media, type, dept, job, amount, clientId: rowClientId });
  });
  if (clientMissing) { alert('管理者の場合、行ごとにクライアントを選択してください'); return; }
  if (hasError) { alert('月と媒体は必須です'); return; }
  if (!toSave.length) { alert('登録するデータがありません'); return; }
  const bRows = toSave.map(e => ({
    id: e.id, client_id: e.clientId,
    month: e.month, media: e.media, type: e.type,
    dept: e.dept || null, job: e.job || null, amount: e.amount
  }));
  const { error } = await sb.from('budgets').upsert(bRows, { onConflict: 'id' });
  if (!error) {
    toSave.forEach(e => {
      const i = budgetData.findIndex(d => d.month===e.month && d.media===e.media && d.dept===e.dept && d.job===e.job && d.clientId===e.clientId);
      if (i >= 0) budgetData[i] = {...budgetData[i], ...e};
      else budgetData.push(e);
    });
  } else {
    alert('保存に失敗しました: ' + error.message);
    return;
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
  // adminのクライアント絞り込みプルダウンを毎回更新
  populateBudgetClientFilter();

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
  // adminのクライアント絞り込み値（admin時のみ有効）
  const selClient = isAdmin ? (document.getElementById('budgetClientFilter')?.value || '') : '';

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
    if(selClient&&a.clientId!==selClient) return false;
    return true;
  });
  const bf = budgetData.filter(d=>{
    if(selFrom&&d.month<selFrom) return false; if(selTo&&d.month>selTo) return false;
    if(selDept&&d.dept&&d.dept!==selDept) return false; if(selJob&&d.job&&d.job!==selJob) return false;
    if(selClient&&d.clientId!==selClient) return false;
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

  // 前期間（前月 or 前N月）の数値を計算 → 前月比のために
  let prevFrom = '', prevTo = '';
  if (selFrom && selTo) {
    // 期間長を計算して前期間を取得
    const fromY = parseInt(selFrom.slice(0,4)), fromM = parseInt(selFrom.slice(5,7));
    const toY = parseInt(selTo.slice(0,4)), toM = parseInt(selTo.slice(5,7));
    const monthSpan = (toY - fromY) * 12 + (toM - fromM) + 1;
    const pf = new Date(fromY, fromM - 1 - monthSpan, 1);
    const pt = new Date(fromY, fromM - 1 - 1, 1);
    prevFrom = pf.toISOString().slice(0,7);
    prevTo = pt.toISOString().slice(0,7);
  }
  const afPrev = applicants.filter(a=>{
    const m=a.appDate?a.appDate.substring(0,7):'';
    if(prevFrom&&m<prevFrom) return false; if(prevTo&&m>prevTo) return false;
    if(selDept&&a.dept!==selDept) return false; if(selJob&&a.jobType!==selJob) return false;
    if(selClient&&a.clientId!==selClient) return false;
    return true;
  });
  const bfPrev = budgetData.filter(d=>{
    if(prevFrom&&d.month<prevFrom) return false; if(prevTo&&d.month>prevTo) return false;
    if(selDept&&d.dept&&d.dept!==selDept) return false; if(selJob&&d.job&&d.job!==selJob) return false;
    if(selClient&&d.clientId!==selClient) return false;
    return true;
  });
  const pA = afPrev.length, pH = afPrev.filter(isHired).length;
  const pB = bfPrev.reduce((s,d)=>s+d.amount,0);
  const pCPA = pB && pA ? Math.round(pB/pA) : 0;
  const pCPO = pB && pH ? Math.round(pB/pH) : 0;

  // 前月比HTML生成ヘルパー（小さい方が良いCPA/CPOは「下がる=良い」）
  const trendHtml = (cur, prev, smallerIsBetter) => {
    if (!prev) return '<span style="font-size:9px;color:#aaa;">前期データなし</span>';
    const diff = cur - prev;
    const pct = Math.round((diff / prev) * 100);
    const isUp = diff > 0, isDown = diff < 0;
    const isGood = smallerIsBetter ? isDown : isUp;
    const arrow = isUp ? '▲' : (isDown ? '▼' : '→');
    const color = (diff === 0) ? '#aaa' : (isGood ? '#3B6D11' : '#D85A30');
    const sign = pct > 0 ? '+' : '';
    return `<span style="font-size:9px;color:${color};font-weight:500;">${arrow} 前期比 ${sign}${pct}%</span>`;
  };
  const ltHtml = (cur, prev, smallerIsBetter) => {
    if (!prev) return '<span style="font-size:9px;color:#aaa;">前期データなし</span>';
    const diff = cur - prev;
    if (diff === 0) return `<span style="font-size:9px;color:#aaa;">→ 前期比 ±0</span>`;
    const isGood = smallerIsBetter ? diff < 0 : diff > 0;
    const arrow = diff > 0 ? '▲' : '▼';
    const color = isGood ? '#3B6D11' : '#D85A30';
    const sign = diff > 0 ? '+' : '';
    return `<span style="font-size:9px;color:${color};font-weight:500;">${arrow} 前期比 ${sign}${diff.toLocaleString()}</span>`;
  };

  // ROI = 採用人数 / 広告費（万円） 簡易表現
  const roi = tB ? (tH * 1000000 / tB).toFixed(2) : 0; // 100万円あたりの採用数
  const pRoi = pB ? (pH * 1000000 / pB).toFixed(2) : 0;

  const kpi=document.getElementById('budgetKpi');
  if(kpi) kpi.innerHTML=[
    // ヒーローKPI 4枚（提案1）
    `<div class="mc bk-hero" style="border-left:3px solid #D85A30;background:#fdf3ef;">
      <div class="mc-lbl" style="color:#993C1D;">総広告費</div>
      <div class="mc-val">${tB.toLocaleString()}<span style="font-size:11px;color:#888;font-weight:500;">円</span></div>
      <div class="mc-sub">${trendHtml(tB, pB, false)}</div>
      <canvas class="bk-spark" data-kpi="totalCost" width="100" height="22" style="margin-top:6px;width:100%;height:22px;"></canvas>
    </div>`,
    `<div class="mc bk-hero" style="border-left:3px solid #639922;background:#eaf3de;">
      <div class="mc-lbl" style="color:#3B6D11;">採用1人あたり</div>
      <div class="mc-val">${tCPO?tCPO.toLocaleString():'-'}<span style="font-size:11px;color:#888;font-weight:500;">${tCPO?'円':''}</span></div>
      <div class="mc-sub">${trendHtml(tCPO, pCPO, true)}</div>
      <canvas class="bk-spark" data-kpi="cpo" width="100" height="22" style="margin-top:6px;width:100%;height:22px;"></canvas>
    </div>`,
    `<div class="mc bk-hero" style="border-left:3px solid #185FA5;background:#e6f1fb;">
      <div class="mc-lbl" style="color:#185FA5;">CPA（応募単価）</div>
      <div class="mc-val">${tCPA?tCPA.toLocaleString():'-'}<span style="font-size:11px;color:#888;font-weight:500;">${tCPA?'円':''}</span></div>
      <div class="mc-sub">${trendHtml(tCPA, pCPA, true)}</div>
      <canvas class="bk-spark" data-kpi="cpa" width="100" height="22" style="margin-top:6px;width:100%;height:22px;"></canvas>
    </div>`,
    `<div class="mc bk-hero" style="border-left:3px solid #534AB7;background:#f5f4fd;">
      <div class="mc-lbl" style="color:#3C3489;">採用率 / 投資効率</div>
      <div class="mc-val">${hr}<span style="font-size:11px;color:#888;font-weight:500;">%</span></div>
      <div class="mc-sub" style="font-size:9.5px;color:#3C3489;">${tH}名採用 / ${tA}名応募</div>
      <canvas class="bk-spark" data-kpi="hireRate" width="100" height="22" style="margin-top:6px;width:100%;height:22px;"></canvas>
    </div>`,
    // 補助KPI 2枚（既存維持）
    '<div class="mc" style="border-left:3px solid #85B7EB;"><div class="mc-lbl">応募数</div><div class="mc-val">'+tA+'</div></div>',
    '<div class="mc" style="border-left:3px solid #1D9E75;"><div class="mc-lbl">採用数</div><div class="mc-val">'+tH+'</div></div>'
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

  // 提案3：採用ファネル × コスト
  renderBudgetFunnel({ af, bf, tA, tH, tB, tCPA, tCPO, isHired });
  // 提案5：コアラのコスト診断
  renderBudgetKoalaCoach({ ms, tA, tH, tB, tCPA, tCPO, hr, pCPO, pCPA, pH, months });
  // 提案4：スパークライン描画（ヒーローKPIカード内）
  renderBudgetSparklines(months, isHired, af);

  const dlEl=document.getElementById('budgetDataList');
  if(dlEl) {
    const sd=[...budgetData].filter(d=>{if(selFrom&&d.month<selFrom)return false;if(selTo&&d.month>selTo)return false;if(selClient&&d.clientId!==selClient)return false;return true;}).sort((a,b)=>b.month>a.month?1:-1);
    if (sd.length) {
      let dlRows = '';
      sd.forEach(function(d) {
        const idEsc = escapeOwnerHtml(String(d.id));
        dlRows += '<tr>';
        if (isAdmin) dlRows += '<td style="'+tdL+'"><span style="font-size:10px;color:#185FA5;background:#f0f6ff;border:1px solid #c8ddf5;border-radius:6px;padding:1px 6px;">'+escapeOwnerHtml(getClientDisplayName(d.clientId||'')||'(未割当)')+'</span></td>';
        dlRows += '<td style="'+tdL+'">'+d.month+'</td><td style="'+tdL+'">'+d.media+'</td>';
        dlRows += '<td style="'+tdL+'">'+(d.dept||'-')+'</td><td style="'+tdL+'">'+(d.job||'-')+'</td>';
        dlRows += '<td style="'+tdR+'">'+d.amount.toLocaleString()+'円</td>';
        dlRows += '<td style="'+tdL+'">'+(d.type==='agency'?'人材紹介':'求人媒体')+'</td>';
        dlRows += '<td style="'+tdR+'white-space:nowrap;">';
        dlRows += '<button type="button" class="btn-budget-edit" data-bid="'+idEsc+'" style="padding:3px 8px;font-size:10.5px;border:0.5px solid #5aaa8e;background:#fff;color:#5aaa8e;border-radius:6px;font-family:inherit;cursor:pointer;margin-right:4px;font-weight:500;">✏ 編集</button>';
        dlRows += '<button type="button" class="btn-budget-del" data-bid="'+idEsc+'" style="padding:3px 8px;font-size:10.5px;border:0.5px solid #e57373;background:#fff;color:#e57373;border-radius:6px;font-family:inherit;cursor:pointer;font-weight:500;">削除</button>';
        dlRows += '</td></tr>';
      });
      dlEl.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
        (isAdmin ? '<th style="'+thL+'">クライアント</th>' : '') +
        '<th style="'+thL+'">月</th><th style="'+thL+'">媒体</th><th style="'+thL+'">部署</th>' +
        '<th style="'+thL+'">職種</th><th style="'+thR+'">金額</th><th style="'+thL+'">種別</th><th></th>' +
        '</tr></thead><tbody>' + dlRows + '</tbody></table>';
      // 編集・削除ボタンにイベントリスナーをバインド（onclick属性ではエスケープ問題が発生するため）
      dlEl.querySelectorAll('.btn-budget-edit').forEach(btn => {
        btn.addEventListener('click', function() {
          const bid = btn.getAttribute('data-bid');
          if (bid) editBudget(bid);
        });
      });
      dlEl.querySelectorAll('.btn-budget-del').forEach(btn => {
        btn.addEventListener('click', function() {
          const bid = btn.getAttribute('data-bid');
          if (bid) deleteBudget(bid);
        });
      });
    } else {
      dlEl.innerHTML = '<div class="empty">予算データがありません</div>';
    }
  }
}

// ========================================
// 予算管理：採用ファネル × コスト（提案3）
// ========================================
function renderBudgetFunnel({ af, bf, tA, tH, tB, tCPA, tCPO, isHired }) {
  const el = document.getElementById('budgetFunnel');
  if (!el) return;
  if (tA === 0 && tB === 0) {
    el.innerHTML = '<div style="text-align:center;color:#aaa;font-size:11px;padding:1rem;">データがありません</div>';
    return;
  }
  // 各段階に到達した応募者数（累積）
  const interviewN = af.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return ['interview','hired','joined'].includes(cid);
  }).length;
  const joinedN = af.filter(a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return cid === 'joined';
  }).length;
  // 各段階の単価（広告費 ÷ 各段階の人数）
  const cpa = tA ? Math.round(tB / tA) : 0;
  const cpInterview = interviewN ? Math.round(tB / interviewN) : 0;
  const cpHired = tH ? Math.round(tB / tH) : 0;
  const cpJoined = joinedN ? Math.round(tB / joinedN) : 0;

  const stages = [
    { key:'apply',    label:'応募',     count:tA,         unit:cpa,        color:'#185FA5', bg:'#e6f1fb' },
    { key:'iv',       label:'面接',     count:interviewN, unit:cpInterview,color:'#3C3489', bg:'#f5f4fd' },
    { key:'hired',    label:'採用',     count:tH,         unit:cpHired,    color:'#3B6D11', bg:'#eaf3de' },
    { key:'joined',   label:'入社',     count:joinedN,    unit:cpJoined,   color:'#0F6E56', bg:'#e1f5ee' },
  ];
  let html = '<div style="display:flex;flex-direction:column;gap:4px;">';
  stages.forEach((s, i) => {
    const through = i > 0 && stages[i-1].count > 0 ? Math.round(s.count / stages[i-1].count * 100) : null;
    const unitText = s.unit ? `${s.unit.toLocaleString()}円/人` : '-';
    html += `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${s.bg};border-radius:8px;">
        <span style="font-size:11px;font-weight:700;color:${s.color};width:50px;">${s.label}</span>
        <span style="font-size:18px;font-weight:600;color:#1a1a1a;flex:1;">${s.count}<span style="font-size:11px;color:#888;font-weight:400;">名</span></span>
        ${through !== null ? `<span style="font-size:10px;color:${through<50?'#D85A30':'#888'};white-space:nowrap;">通過率 ${through}%</span>` : ''}
        <span style="font-size:11px;color:${s.color};font-weight:600;white-space:nowrap;min-width:90px;text-align:right;">${unitText}</span>
      </div>`;
    if (i < stages.length - 1) {
      html += `<div style="text-align:left;padding-left:24px;color:#ddd;font-size:14px;line-height:.6;">↓</div>`;
    }
  });
  html += '</div>';
  if (tB > 0) {
    html += `<div style="margin-top:10px;padding:8px 10px;background:#fafafa;border-radius:6px;font-size:11px;color:#666;line-height:1.6;">💡 「○円/人」は、総広告費 ${tB.toLocaleString()}円 をその段階の人数で割った値。下に行くほど単価が上がるが、最終段階の単価が「採用1人にかかった実コスト」を示します。</div>`;
  }
  el.innerHTML = html;
}

// ========================================
// 予算管理：コアラのコスト診断（提案5）
// ========================================
function renderBudgetKoalaCoach({ ms, tA, tH, tB, tCPA, tCPO, hr, pCPO, pCPA, pH, months }) {
  const box = document.getElementById('budgetKoalaCoach');
  const ulEl = document.getElementById('budgetKoalaCoachAdvices');
  if (!box || !ulEl) return;

  const advices = [];

  // 0) データ不足
  if (tB === 0 && tA === 0) {
    box.style.display = 'none';
    return;
  }
  if (tB === 0) {
    advices.push(`💰 まずは <strong>「+ 予算入力」</strong> から広告費を登録すると、CPA/CPOや費用対効果が見えるよ！`);
  }

  // 1) 媒体別効率：CPOが小さい媒体を最優秀として推奨
  const mediaCpo = Object.entries(ms || {})
    .filter(([_, v]) => v.budget > 0 && v.hires > 0)
    .map(([k, v]) => ({ name: k, cpo: v.budget / v.hires, hires: v.hires, budget: v.budget }))
    .sort((a, b) => a.cpo - b.cpo);
  if (mediaCpo.length >= 2) {
    const best = mediaCpo[0];
    const worst = mediaCpo[mediaCpo.length - 1];
    const ratio = (worst.cpo / best.cpo).toFixed(1);
    advices.push(`🥇 <strong>${best.name}</strong>が一番費用対効果いいよ！採用単価<strong>${Math.round(best.cpo).toLocaleString()}円</strong>で、最も高い<strong>${worst.name}（${Math.round(worst.cpo).toLocaleString()}円）</strong>の<strong>1/${ratio}</strong>。`);
  } else if (mediaCpo.length === 1) {
    const only = mediaCpo[0];
    advices.push(`📊 <strong>${only.name}</strong>から${only.hires}名採用。採用単価は<strong>${Math.round(only.cpo).toLocaleString()}円</strong>。他媒体も試して比較しよう！`);
  }

  // 2) 前期比：CPOが下がっていれば褒める
  if (pCPO && tCPO && tCPO < pCPO) {
    const dropPct = Math.round((pCPO - tCPO) / pCPO * 100);
    advices.push(`📈 採用単価が前期比<strong>${dropPct}%改善</strong>！この調子！`);
  } else if (pCPO && tCPO && tCPO > pCPO * 1.2) {
    const upPct = Math.round((tCPO - pCPO) / pCPO * 100);
    advices.push(`⚠️ 採用単価が前期比<strong>+${upPct}%</strong>に上昇。媒体の見直しを検討してみて！`);
  }

  // 3) 採用率
  if (tA >= 10 && hr < 5) {
    advices.push(`🤔 応募${tA}名に対して採用は${tH}名（${hr}%）。応募者の質や面接プロセスを見直すタイミングかも！`);
  } else if (hr >= 20) {
    advices.push(`✨ 採用率<strong>${hr}%</strong>は優秀！マッチング精度が高いね！`);
  }

  // 4) 月別推移：今月の広告費が突出していたら警告
  const sortedMonths = Object.keys(months || {}).sort();
  if (sortedMonths.length >= 2) {
    const lastM = sortedMonths[sortedMonths.length - 1];
    const prevM = sortedMonths[sortedMonths.length - 2];
    const lastB = months[lastM]?.budget || 0;
    const prevB = months[prevM]?.budget || 0;
    if (prevB > 0 && lastB > prevB * 1.5) {
      advices.push(`📅 <strong>${lastM}</strong>の広告費が前月の<strong>${(lastB/prevB).toFixed(1)}倍</strong>。意図した増額？コスト管理に注意！`);
    }
  }

  if (advices.length === 0) {
    advices.push(`📊 もう少しデータが集まると、コアラがアドバイスできるよ〜🐨`);
  }

  ulEl.innerHTML = advices.map(a => `<div>${a}</div>`).join('');
  box.style.display = 'block';
}

// ========================================
// 予算管理：スパークライン（提案4）
// ========================================
function renderBudgetSparklines(months, isHired, af) {
  // 直近12ヶ月のデータポイントを生成
  const sm = Object.keys(months || {}).sort();
  if (sm.length < 2) return; // 最低2点はないと描画しない

  const points = sm.map(m => {
    const d = months[m];
    return {
      month: m,
      totalCost: d.budget,
      apps: d.apps,
      hires: d.hires,
      cpa: d.budget && d.apps ? Math.round(d.budget / d.apps) : 0,
      cpo: d.budget && d.hires ? Math.round(d.budget / d.hires) : 0,
      hireRate: d.apps ? d.hires / d.apps * 100 : 0,
    };
  });
  const dataMap = {
    totalCost: points.map(p => p.totalCost),
    cpa:       points.map(p => p.cpa),
    cpo:       points.map(p => p.cpo),
    hireRate:  points.map(p => p.hireRate),
  };
  const colorMap = {
    totalCost: '#D85A30',
    cpa:       '#185FA5',
    cpo:       '#639922',
    hireRate:  '#534AB7',
  };

  document.querySelectorAll('canvas.bk-spark').forEach(cv => {
    const kpi = cv.dataset.kpi;
    const data = dataMap[kpi];
    if (!data || data.length < 2) return;
    drawSparkline(cv, data, colorMap[kpi]);
  });
}

function drawSparkline(canvas, data, color) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth || 100;
  const H = canvas.height = canvas.offsetHeight || 22;
  ctx.clearRect(0, 0, W, H);
  if (!data || data.length < 2) return;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const padX = 2, padY = 3;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const xStep = innerW / (data.length - 1);
  // 塗り
  ctx.beginPath();
  ctx.moveTo(padX, H - padY);
  data.forEach((v, i) => {
    const x = padX + i * xStep;
    const y = padY + innerH - ((v - min) / range) * innerH;
    if (i === 0) ctx.lineTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(padX + (data.length - 1) * xStep, H - padY);
  ctx.closePath();
  ctx.fillStyle = color + '20';
  ctx.fill();
  // 線
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = padX + i * xStep;
    const y = padY + innerH - ((v - min) / range) * innerH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 終点に丸
  const lastX = padX + (data.length - 1) * xStep;
  const lastY = padY + innerH - ((data[data.length-1] - min) / range) * innerH;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ========================================
// 予算管理：シミュレーターモード切替（提案6）
// ========================================
let _simMode = 'basic';
function setSimMode(mode) {
  _simMode = mode;
  const b1 = document.getElementById('simModeBasic');
  const b2 = document.getElementById('simModeAlloc');
  const m1 = document.getElementById('simBasicMode');
  const m2 = document.getElementById('simAllocMode');
  if (mode === 'basic') {
    if (b1) { b1.style.background = '#1a1a1a'; b1.style.color = '#fff'; }
    if (b2) { b2.style.background = '#fafafa'; b2.style.color = '#666'; }
    if (m1) m1.style.display = 'block';
    if (m2) m2.style.display = 'none';
  } else {
    if (b1) { b1.style.background = '#fafafa'; b1.style.color = '#666'; }
    if (b2) { b2.style.background = '#1a1a1a'; b2.style.color = '#fff'; }
    if (m1) m1.style.display = 'none';
    if (m2) m2.style.display = 'block';
    // 媒体配分スライダーUIを構築
    buildAllocSliders();
  }
}

// 媒体配分シミュレーション：媒体一覧を取得（過去の応募者から実績がある媒体）
function _getMediaForSim() {
  const mediaSet = new Set();
  applicants.forEach(a => { if (a.media) mediaSet.add(a.media); });
  return [...mediaSet].sort();
}

// 配分スライダー構築（媒体ごとの%）
let _simAlloc = {}; // { 媒体名: 配分% }
function buildAllocSliders() {
  const container = document.getElementById('simAllocSliders');
  if (!container) return;
  const medias = _getMediaForSim();
  if (medias.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:#aaa;padding:10px;">媒体マスターか応募者データの媒体が登録されていません</div>';
    document.getElementById('simAllocResult').innerHTML = '';
    return;
  }
  // 初期値：均等配分
  if (Object.keys(_simAlloc).length === 0 || medias.some(m => _simAlloc[m] === undefined)) {
    const eq = Math.round(100 / medias.length);
    _simAlloc = {};
    medias.forEach((m, i) => { _simAlloc[m] = (i === medias.length - 1) ? 100 - eq * (medias.length - 1) : eq; });
  }
  let html = '';
  medias.forEach(m => {
    const v = _simAlloc[m] || 0;
    html += `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;font-weight:600;width:90px;color:#1a1a1a;">${escapeHtml(m)}</span>
        <input type="range" min="0" max="100" value="${v}" data-media="${escapeHtml(m)}" oninput="onAllocSliderChange(this)" style="flex:1;">
        <span data-media-pct="${escapeHtml(m)}" style="font-size:11px;font-weight:600;width:36px;text-align:right;">${v}%</span>
      </div>`;
  });
  container.innerHTML = html;
  recalcAllocSim();
}

function onAllocSliderChange(input) {
  const m = input.dataset.media;
  const v = parseInt(input.value);
  _simAlloc[m] = v;
  const lbl = document.querySelector(`[data-media-pct="${m.replace(/"/g,'\\"')}"]`);
  if (lbl) lbl.textContent = v + '%';
  recalcAllocSim();
}

function recalcAllocSim() {
  const totalEl = document.getElementById('simTotalBudget');
  const total = parseInt(totalEl?.value || '0') || 0;
  const resultEl = document.getElementById('simAllocResult');
  if (!resultEl) return;
  const medias = _getMediaForSim();
  if (medias.length === 0 || total <= 0) {
    resultEl.innerHTML = '';
    return;
  }
  // 各媒体の過去CPOを算出
  const isHired = a => {
    const cid = a.coreStatusId || STATUS_TO_CORE[a.status] || 'applied';
    return cid === 'hired' || cid === 'joined' || ['内定','内定承諾','採用'].includes(a.hireStatus);
  };
  // 媒体ごとの応募数・採用数・予算実績
  const stats = {};
  medias.forEach(m => stats[m] = { apps:0, hires:0, budget:0 });
  applicants.forEach(a => {
    if (a.media && stats[a.media]) {
      stats[a.media].apps++;
      if (isHired(a)) stats[a.media].hires++;
    }
  });
  budgetData.forEach(d => {
    if (d.media && stats[d.media]) stats[d.media].budget += d.amount;
  });
  // 全体平均CPO（実績がない媒体に使うフォールバック）
  const allBudget = Object.values(stats).reduce((s, x) => s + x.budget, 0);
  const allHires = Object.values(stats).reduce((s, x) => s + x.hires, 0);
  const fallbackCpo = allBudget && allHires ? allBudget / allHires : 0;

  // 配分の合計が100%になるよう正規化
  const sum = medias.reduce((s, m) => s + (_simAlloc[m] || 0), 0);
  if (sum === 0) {
    resultEl.innerHTML = '<div style="background:#fff8f0;border-radius:8px;padding:.75rem;color:#854F0B;font-size:11px;">配分の合計が0%です</div>';
    return;
  }

  let totalEstHires = 0;
  let rows = '';
  medias.forEach(m => {
    const pct = _simAlloc[m] || 0;
    const allotted = Math.round(total * pct / sum);
    const s = stats[m];
    const cpo = (s.budget && s.hires) ? s.budget / s.hires : fallbackCpo;
    const estHires = cpo > 0 ? (allotted / cpo) : 0;
    totalEstHires += estHires;
    const cpoText = (s.budget && s.hires)
      ? `<span style="color:#3B6D11;">実績 ${Math.round(cpo).toLocaleString()}円/人</span>`
      : `<span style="color:#aaa;">参考 ${Math.round(fallbackCpo).toLocaleString()}円/人</span>`;
    rows += `<tr>
      <td style="padding:6px 8px;font-size:11px;">${escapeHtml(m)}</td>
      <td style="padding:6px 8px;font-size:11px;text-align:right;">${pct}%</td>
      <td style="padding:6px 8px;font-size:11px;text-align:right;">${allotted.toLocaleString()}円</td>
      <td style="padding:6px 8px;font-size:10.5px;text-align:right;">${cpoText}</td>
      <td style="padding:6px 8px;font-size:11px;text-align:right;font-weight:600;color:#185FA5;">${estHires.toFixed(1)}名</td>
    </tr>`;
  });

  // 全体均等配分の場合との比較
  const eqAlloc = Math.round(total / medias.length);
  let eqHires = 0;
  medias.forEach(m => {
    const s = stats[m];
    const cpo = (s.budget && s.hires) ? s.budget / s.hires : fallbackCpo;
    if (cpo > 0) eqHires += eqAlloc / cpo;
  });
  const diffHires = totalEstHires - eqHires;
  const diffSign = diffHires >= 0 ? '+' : '';
  const diffColor = diffHires >= 0 ? '#3B6D11' : '#D85A30';

  resultEl.innerHTML = `
    <div style="background:#fff;border:1px solid #e8e8e6;border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f8f8f7;">
          <th style="padding:7px 8px;text-align:left;font-size:10.5px;font-weight:600;color:#666;">媒体</th>
          <th style="padding:7px 8px;text-align:right;font-size:10.5px;font-weight:600;color:#666;">配分</th>
          <th style="padding:7px 8px;text-align:right;font-size:10.5px;font-weight:600;color:#666;">予算</th>
          <th style="padding:7px 8px;text-align:right;font-size:10.5px;font-weight:600;color:#666;">CPO</th>
          <th style="padding:7px 8px;text-align:right;font-size:10.5px;font-weight:600;color:#666;">予測採用数</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#fafafa;font-weight:600;border-top:2px solid #e0e0de;">
          <td style="padding:8px;font-size:11px;" colspan="4">合計予測採用数</td>
          <td style="padding:8px;font-size:14px;text-align:right;color:#185FA5;">${totalEstHires.toFixed(1)}名</td>
        </tr></tfoot>
      </table>
    </div>
    <div style="margin-top:.625rem;padding:8px 10px;background:#f5f8fa;border-left:3px solid #6ab49a;border-radius:6px;font-size:10.5px;color:#444;line-height:1.6;">
      💡 均等配分なら <strong>${eqHires.toFixed(1)}名</strong> → この配分なら <strong style="color:${diffColor};">${diffSign}${diffHires.toFixed(1)}名</strong> の差。<br>
      ⚠ 過去実績ベースの試算です。媒体ごとの応募の質・市場変動は加味されません。
    </div>`;
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
    const safeEmail = String(c.client_id || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const safePw = String(c.password || '').replace(/</g, '&lt;');
    const rowId = String(c.id).replace(/'/g, "\\'");
    const pwDisplay = safePw
      ? `<span id="pwMask_${c.id}" style="font-family:monospace;font-size:11px;letter-spacing:1px;">••••••••</span>
         <span id="pwReal_${c.id}" style="display:none;font-family:monospace;font-size:11px;">${safePw}</span>
         <button class="btn-sm" style="padding:2px 8px;font-size:10px;margin-left:4px;" onclick="togglePwVisible('${c.id}')">表示</button>
         <button class="btn-sm" style="padding:2px 8px;font-size:10px;margin-left:2px;" onclick="copyClientPw('${rowId}')">コピー</button>`
      : '<span style="color:#aaa;font-size:11px;">未設定</span>';
    return `<tr>
      <td>${safeName}</td>
      <td><code style="font-size:11px;">${safeEmail}</code></td>
      <td>${pwDisplay}</td>
      <td>${s.total} 件 / 採用 ${s.hired} 件</td>
      <td>
        <button class="btn btn-s" onclick="deleteClient('${rowId}')" style="margin-right:4px;">削除</button>
        <button class="btn btn-s" onclick="editClient('${rowId}')" style="background:#378ADD;color:#fff;border-color:#378ADD;">編集</button>
      </td>
    </tr>`;
  }).join('');
}

function togglePwVisible(rowId) {
  const mask = document.getElementById('pwMask_' + rowId);
  const real = document.getElementById('pwReal_' + rowId);
  if (!mask || !real) return;
  if (real.style.display === 'none') {
    real.style.display = 'inline';
    mask.style.display = 'none';
  } else {
    real.style.display = 'none';
    mask.style.display = 'inline';
  }
}

function copyClientPw(rowId) {
  const target = clients.find(c => String(c.id) === String(rowId));
  if (!target || !target.password) {
    setStatus('パスワードが未設定です', 'err');
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(target.password)
      .then(() => setStatus('パスワードをコピーしました', 'ok'))
      .catch(() => setStatus('コピーに失敗しました', 'err'));
  }
}

function editClient(rowId) {
  if (!isAdmin) { setStatus('管理者のみ実行できます', 'err'); return; }
  const target = clients.find(c => String(c.id) === String(rowId));
  if (!target) { setStatus('対象のクライアントが見つかりません', 'err'); return; }
  const form = document.getElementById('editClientForm');
  if (!form) return;
  document.getElementById('editCRowId').value = target.id;
  document.getElementById('editCName').value = target.name || '';
  document.getElementById('editCId').value = target.client_id || '';
  document.getElementById('editCPw').value = ''; // パスワードは初期空欄
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelClientEdit() {
  const form = document.getElementById('editClientForm');
  if (form) form.style.display = 'none';
}

async function saveClientEdit() {
  if (!isAdmin) { setStatus('管理者のみ実行できます', 'err'); return; }
  const rowId = document.getElementById('editCRowId').value;
  const name = (document.getElementById('editCName').value || '').trim();
  const newEmail = (document.getElementById('editCId').value || '').trim();
  const newPw = (document.getElementById('editCPw').value || '').trim();

  if (!rowId) { setStatus('対象IDが取得できません', 'err'); return; }
  if (!name) { setStatus('クライアント名を入力してください', 'err'); return; }
  if (!newEmail) { setStatus('メールアドレスを入力してください', 'err'); return; }
  // 簡易メアドチェック
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    setStatus('メールアドレス形式が正しくありません', 'err'); return;
  }
  if (newPw && newPw.length < 6) { setStatus('パスワードは6文字以上にしてください', 'err'); return; }

  // 他のクライアントで同じメアドが使われていないかチェック
  const dup = clients.find(c => c.client_id === newEmail && String(c.id) !== String(rowId));
  if (dup) { setStatus('そのメールアドレスは他のクライアントで使用されています', 'err'); return; }

  // 更新内容を構築
  const updateObj = { name, client_id: newEmail };
  if (newPw) updateObj.password = newPw;

  try {
    const { error } = await sb.from('clients').update(updateObj).eq('id', rowId);
    if (error) { setStatus('更新に失敗しました: ' + error.message, 'err'); return; }
  } catch(e) {
    setStatus('更新に失敗しました: ' + (e.message || e), 'err');
    return;
  }

  setStatus('クライアント情報を更新しました（Supabase Auth側も同じメアド・パスワードに更新してください）', 'ok');
  cancelClientEdit();
  await renderAdmin();
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
    setStatus('クライアント名・メールアドレス・パスワードをすべて入力してください', 'err');
    return;
  }
  // メアド形式チェック
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cid)) {
    setStatus('メールアドレス形式が正しくありません', 'err');
    return;
  }
  if (pw.length < 6) {
    setStatus('パスワードは6文字以上にしてください', 'err');
    return;
  }
  // メアド重複チェック
  const dup = clients.find(c => c.client_id === cid);
  if (dup) {
    setStatus('そのメールアドレスは既に登録されています', 'err');
    return;
  }

  const { error } = await sb.from('clients').insert({ client_id: cid, password: pw, name: name });
  if (error) {
    setStatus('追加に失敗しました: ' + error.message, 'err');
    return;
  }
  setStatus('クライアントを追加しました（Supabase Authでも同じメアド・パスワードでユーザーを作成してください）', 'ok');
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
  msg += '\n\n※ Supabase Auth側のユーザーは別途手動で削除してください。';
  if (!confirm(msg)) return;

  const { error } = await sb.from('clients').delete().eq('id', id);
  if (error) {
    setStatus('削除に失敗しました: ' + error.message, 'err');
    return;
  }
  setStatus('クライアントを削除しました（Supabase Authでも同じユーザーを削除してください）', 'ok');
  await renderAdmin();
}

// ========================================
// 担当者選択画面・ヘッダー切替（Phase B-2で追加）
// ========================================

// 在籍中担当者をDBから取得（選択画面・ヘッダープルダウン用）
async function loadActiveStaffList() {
  if (isAdmin) {
    activeStaffList = [];
    return;
  }
  // RLSで自社のみ取得される
  const { data, error } = await sb.from('staff')
    .select('*')
    .eq('is_active', true)
    .order('ord').order('created_at');
  if (error) {
    console.error('[loadActiveStaffList] エラー', error);
    activeStaffList = [];
    return;
  }
  activeStaffList = data || [];
}

// localStorageキー（クライアント単位で記憶）
function getStaffStorageKey(clientId) {
  return `saiyo_active_staff_${clientId || 'unknown'}`;
}

// 保存された担当者IDを取得（クライアント単位）
function loadSavedStaffSelection() {
  if (!currentClientId) return null;
  try {
    return localStorage.getItem(getStaffStorageKey(currentClientId));
  } catch(e) {
    return null;
  }
}

// 担当者IDを保存
function saveStaffSelection(staffId) {
  if (!currentClientId) return;
  try {
    if (staffId) {
      localStorage.setItem(getStaffStorageKey(currentClientId), String(staffId));
    } else {
      localStorage.removeItem(getStaffStorageKey(currentClientId));
    }
  } catch(e) {
    console.warn('[saveStaffSelection] 保存失敗', e);
  }
}

// 担当者選択画面を表示
function showStaffSelectScreen() {
  const sc = document.getElementById('staffSelectScreen');
  if (!sc) {
    console.warn('[showStaffSelectScreen] 画面要素なし、startAppへフォールバック');
    startApp();
    return;
  }
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'none';
  sc.style.display = 'flex';
  // クライアント名表示
  const cnameEl = document.getElementById('staffSelectClientName');
  if (cnameEl) cnameEl.textContent = currentClientName ? currentClientName : '';
  renderStaffSelect();
}

// 担当者選択画面のカードを描画
function renderStaffSelect() {
  const list = document.getElementById('staffSelectList');
  const empty = document.getElementById('staffSelectEmpty');
  if (!list || !empty) return;

  if (!activeStaffList || activeStaffList.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  list.style.display = 'grid';
  empty.style.display = 'none';
  // 名前のイニシャル取得（日本語の場合は最初の文字、英字なら姓名の頭文字）
  function getInitial(name) {
    if (!name) return '?';
    const trimmed = String(name).trim();
    if (!trimmed) return '?';
    // 半角スペース or 全角スペース区切り
    const parts = trimmed.split(/[\s　]+/).filter(Boolean);
    if (parts.length >= 2) {
      // 最初と最後の頭文字（姓名対応）
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return trimmed.charAt(0).toUpperCase();
  }

  // 担当者ごとに色を変える（名前のハッシュ）
  const colorPalette = [
    '#6ab49a', '#378ADD', '#f0a050', '#b07cc6', '#5cb8a8',
    '#e08585', '#7faedb', '#d4a14e', '#9b8bc1', '#56a48e'
  ];
  function pickColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return colorPalette[Math.abs(hash) % colorPalette.length];
  }

  list.innerHTML = activeStaffList.map(s => {
    const initial = getInitial(s.name || '');
    const color = pickColor(s.name || '');
    const safeName = escapeHtml(s.name || '');
    return `
      <div class="staff-card" onclick="selectStaff('${escapeHtml(String(s.id))}', '${escapeHtml(s.name || '').replace(/'/g, "\\'")}')"
        style="cursor:pointer;background:#fff;border:1px solid #e3e3e0;border-radius:10px;padding:.9rem .75rem;text-align:center;transition:all .2s;"
        onmouseover="this.style.borderColor='#5a8a48';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(90,138,72,.12)'"
        onmouseout="this.style.borderColor='#e3e3e0';this.style.transform='translateY(0)';this.style.boxShadow='none'">
        <div style="width:48px;height:48px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:500;margin:0 auto .5rem;letter-spacing:.02em;">${initial}</div>
        <div style="font-size:13px;font-weight:500;color:#1a1a1a;line-height:1.3;word-break:break-word;">${safeName}</div>
      </div>
    `;
  }).join('');
}

// 担当者選択（クリック時）
async function selectStaff(staffId, staffName) {
  // v2.9：万が一ローディングが残っていても確実に消す（多重防御）
  try {
    if (window.__saiyoLoginLoading && window.__saiyoLoginLoading.hide) {
      window.__saiyoLoginLoading.hide();
    }
    const ov = document.getElementById('loginLoadingOverlay');
    if (ov) { ov.style.display = 'none'; ov.style.opacity = '0'; }
    // メッセージ切替タイマーが残ってたら全部止める
    if (window.__loadingMsgTimers) {
      window.__loadingMsgTimers.forEach(t => clearTimeout(t));
      window.__loadingMsgTimers = [];
    }
    window.__loginLoadingStartedAt = 0;
  } catch(e) { console.warn('[selectStaff] ローディング解除失敗', e); }

  currentStaffId = staffId;
  currentStaffName = staffName;
  saveStaffSelection(staffId);
  console.log('[selectStaff] 担当者選択:', staffName);
  // 担当者選択画面を非表示
  const staffSel = document.getElementById('staffSelectScreen');
  if (staffSel) staffSel.style.display = 'none';
  // 担当者を選んだ直後は必ずホーム画面から始める
  window.__forceHomeAfterStaff = true;
  await startApp();
}

// 担当者なしで続行（担当者ゼロ時）
async function continueWithoutStaff() {
  // v2.9：万が一ローディングが残っていても確実に消す
  try {
    if (window.__saiyoLoginLoading && window.__saiyoLoginLoading.hide) {
      window.__saiyoLoginLoading.hide();
    }
    const ov = document.getElementById('loginLoadingOverlay');
    if (ov) { ov.style.display = 'none'; ov.style.opacity = '0'; }
    if (window.__loadingMsgTimers) {
      window.__loadingMsgTimers.forEach(t => clearTimeout(t));
      window.__loadingMsgTimers = [];
    }
    window.__loginLoadingStartedAt = 0;
  } catch(e) {}

  currentStaffId = null;
  currentStaffName = '';
  saveStaffSelection(null);
  const staffSel = document.getElementById('staffSelectScreen');
  if (staffSel) staffSel.style.display = 'none';
  // 担当者選択画面を経由した直後は必ずホーム画面から始める
  window.__forceHomeAfterStaff = true;
  await startApp();
}

// 選択画面のキャンセル → ログアウト
async function cancelStaffSelect() {
  await doLogout();
}

// ヘッダー右上の担当者表示を更新（startApp時 + 切替時）
function updateHeaderStaffDisplay() {
  const switcher = document.getElementById('staffSwitcher');
  const adminBadge = document.getElementById('adminStaffBadge');
  if (isAdmin) {
    // adminは「管理者」バッジのみ
    if (switcher) switcher.style.display = 'none';
    if (adminBadge) adminBadge.style.display = 'inline-block';
    return;
  }
  // クライアントユーザー
  if (adminBadge) adminBadge.style.display = 'none';
  if (!switcher) return;
  // 担当者ゼロなら何も出さない
  if (!activeStaffList || activeStaffList.length === 0) {
    switcher.style.display = 'none';
    return;
  }
  switcher.style.display = 'inline-flex';
  populateStaffSwitcher();
  // Step 5: アバター円のイニシャル更新
  updateStaffAvatar();
}

// Step 5: アバター円にイニシャル表示
function updateStaffAvatar() {
  const avatar = document.getElementById('staffAvatar');
  if (!avatar) return;
  const name = currentStaffName || '';
  if (!name) {
    avatar.textContent = '?';
    avatar.title = '未設定';
    return;
  }
  // 日本語の場合は先頭1文字、英語の場合は単語の頭文字
  let initial = '?';
  // 英語っぽい？
  if (/^[a-zA-Z\s]+$/.test(name)) {
    const words = name.trim().split(/\s+/);
    initial = (words[0]?.[0] || '').toUpperCase();
    if (words.length > 1) initial += (words[1][0] || '').toUpperCase();
  } else {
    // 日本語：1文字目
    initial = name.charAt(0);
  }
  avatar.textContent = initial;
  avatar.title = name + ' さん';
}

// ヘッダープルダウンの中身を生成（担当者選択肢のみ）
function populateStaffSwitcher() {
  const sel = document.getElementById('staffSwitcherSelect');
  if (!sel) return;
  const opts = (activeStaffList || []).map(s => {
    const selected = (currentStaffId && String(currentStaffId) === String(s.id)) ? 'selected' : '';
    return `<option value="${escapeHtml(String(s.id))}" ${selected}>${escapeHtml(s.name || '')}</option>`;
  }).join('');
  // 担当者未設定状態（currentStaffId=null）の場合の選択肢
  const noneSelected = !currentStaffId ? 'selected' : '';
  sel.innerHTML = `<option value="" ${noneSelected}>（未設定）</option>` + opts;
}

// ヘッダープルダウンから担当者を切り替え
async function switchActiveStaff(staffId) {
  if (!staffId) {
    currentStaffId = null;
    currentStaffName = '';
    saveStaffSelection(null);
  } else {
    const found = activeStaffList.find(s => String(s.id) === String(staffId));
    if (!found) return;
    currentStaffId = found.id;
    currentStaffName = found.name;
    saveStaffSelection(staffId);
  }
  console.log('[switchActiveStaff] 切替:', currentStaffName || '(未設定)');
  // データ再読み込み（Q2 → A：自動再読み込み）
  // 「自分の担当のみ」フィルタは Phase F で実装、現状は表示更新のみで十分
  // 念のため現在表示中の画面を再描画
  try {
    if (document.getElementById('sec-dashboard')?.classList.contains('active')) renderDashboard();
    if (document.getElementById('sec-list')?.classList.contains('active')) renderList();
    if (document.getElementById('sec-tasks')?.classList.contains('active') && typeof renderTaskList === 'function') renderTaskList();
  } catch(e) {
    console.warn('[switchActiveStaff] 再描画で警告', e);
  }
  // Step 5: アバター円とモード概要バーを更新
  try { updateStaffAvatar(); } catch(e) {}
  try { renderModeQuickStats(); } catch(e) {}
}

// escapeHtmlヘルパーは既にこのファイルの後方で定義されているため、ここでは再定義しない

// ========================================
// タイムライン機能（Phase D-1で追加）
// ========================================

// イベントを events テーブルに記録するヘルパー関数
// @param applicantId: 応募者ID
// @param eventType: 'status_change' / 'staff_change' / 'memo' / 'applicant_created' / 'field_change' / 'memo_edit' / 'memo_delete'
// @param title: 短いタイトル
// @param description: 詳細テキスト（任意）
// @param metadata: jsonb（任意、種別ごとの追加情報）
async function recordEvent(applicantId, eventType, title, description, metadata) {
  if (!applicantId) return;
  // 応募者からclient_idを取得
  const a = applicants.find(x => x.id === applicantId);
  const cid = a ? a.clientId : currentClientId;
  // 安全装置：cidが 'admin' や空文字／nullの場合はイベント記録しない（外部キー制約違反防止）
  if (!cid || cid === 'admin') {
    console.warn('[recordEvent] client_idが不正のため記録をスキップ', { applicantId, cid });
    return;
  }
  // adminならstaff_idはnull、それ以外は現在の担当者
  const staffId = isAdmin ? null : (currentStaffId || null);
  const row = {
    applicant_id: applicantId,
    client_id: cid,
    event_type: eventType,
    title: title || '',
    description: description || null,
    staff_id: staffId,
    metadata: metadata || null
  };
  try {
    const { error } = await sb.from('events').insert(row);
    if (error) {
      console.warn('[recordEvent] イベント記録失敗（無視）', error);
    }
  } catch (e) {
    console.warn('[recordEvent] 例外（無視）', e);
  }
}

// 担当者IDから名前を取得するヘルパー
function getStaffNameById(staffId) {
  if (!staffId) return '管理者';
  const s = staffList.find(x => String(x.id) === String(staffId));
  return s ? s.name : '退職した担当者';
}

// イベントタイプ別のアイコン・カラー
const EVENT_TYPE_META = {
  applicant_created: { icon: '👤', color: '#9B59B6', label: '応募受付' },
  status_change:     { icon: '🔄', color: '#378ADD', label: 'ステータス変更' },
  staff_change:      { icon: '👥', color: '#5cb8a8', label: '担当者変更' },
  field_change:      { icon: '📝', color: '#6ab49a', label: '情報更新' },
  memo:              { icon: '💬', color: '#EF9F27', label: 'メモ' },
  memo_edit:         { icon: '✏️', color: '#EF9F27', label: 'メモ編集' },
  memo_delete:       { icon: '🗑️', color: '#888', label: 'メモ削除' },
  interview_added:   { icon: '📅', color: '#9B59B6', label: '面接登録' },
  interview_updated: { icon: '🔁', color: '#9B59B6', label: '面接更新' },
  file:              { icon: '📎', color: '#5cb8a8', label: 'ファイル' },
};

function getEventTypeMeta(t) {
  return EVENT_TYPE_META[t] || { icon: '•', color: '#888', label: t };
}

// 現在編集中の応募者のイベント一覧をロード→描画
let currentTimelineEvents = [];
async function loadAndRenderTimeline() {
  if (!editId) {
    currentTimelineEvents = [];
    renderTimelineUI();
    return;
  }
  let query = sb.from('events')
    .select('*')
    .eq('applicant_id', editId)
    .order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) {
    console.warn('[loadAndRenderTimeline] エラー', error);
    currentTimelineEvents = [];
  } else {
    currentTimelineEvents = data || [];
  }
  renderTimelineUI();
  updateTabBadges();
}

// タイムラインタブのUIを描画
function renderTimelineUI() {
  const container = document.getElementById('timelineContent');
  if (!container) return;
  const events = currentTimelineEvents || [];

  // メモ追加フォーム + イベント一覧
  let html = `
    <!-- メモ追加ボタン/フォーム -->
    <div id="timelineAddMemoBox" style="margin-bottom:1.25rem;">
      <button id="tlAddMemoBtn" onclick="toggleAddMemoForm(true)"
        style="border:1.5px dashed #cee0d8;background:#fafcfb;color:#5aaa8e;padding:10px 18px;border-radius:10px;font-size:13px;font-family:inherit;font-weight:600;cursor:pointer;width:100%;transition:all .15s;">
        ＋ メモを追加
      </button>
      <div id="tlAddMemoForm" style="display:none;background:#fff;border:1.5px solid #cee0d8;border-radius:10px;padding:14px;">
        <textarea id="tlMemoInput" placeholder="気付いたこと、電話メモ、連絡事項などを記入..."
          style="width:100%;min-height:90px;padding:10px 12px;border:1px solid #e4e8e7;border-radius:8px;background:#fafcfb;font-size:13px;font-family:inherit;line-height:1.6;resize:vertical;"></textarea>
        <div style="text-align:right;margin-top:8px;display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="toggleAddMemoForm(false)" style="padding:7px 14px;border:1px solid #ddd;background:#fff;color:#666;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer;">キャンセル</button>
          <button onclick="submitMemo()" style="padding:7px 16px;background:#5aaa8e;color:#fff;border:none;border-radius:8px;font-size:12px;font-family:inherit;font-weight:600;cursor:pointer;">記録する</button>
        </div>
      </div>
    </div>
  `;

  if (!events.length) {
    html += `<div style="text-align:center;padding:2rem 1rem;color:#aaa;font-size:13px;">
      まだイベントがありません。<br>
      ステータスや担当者を変更すると自動で記録されます。
    </div>`;
  } else {
    // タイムライン本体
    html += `<div style="position:relative;padding-left:32px;">
      <!-- 縦線 -->
      <div style="position:absolute;left:14px;top:8px;bottom:8px;width:2px;background:#e4e8e7;"></div>
      ${events.map(ev => buildTimelineItemHTML(ev)).join('')}
    </div>`;
  }
  container.innerHTML = html;
}

// 1イベントのHTMLを生成
function buildTimelineItemHTML(ev) {
  const meta = getEventTypeMeta(ev.event_type);
  const staffName = getStaffNameById(ev.staff_id);
  // 日時フォーマット（YYYY/MM/DD HH:mm）
  let dt = '';
  if (ev.created_at) {
    const d = new Date(ev.created_at);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      dt = `${y}/${m}/${day} ${hh}:${mm}`;
    }
  }
  const esc = escapeHtml;
  // メモタイプは編集・削除ボタン
  const isMemo = ev.event_type === 'memo';
  const actionsHtml = isMemo ? `
    <div style="margin-top:6px;display:flex;gap:8px;">
      <button onclick="editMemoEvent('${esc(String(ev.id))}')" style="background:transparent;border:none;color:#888;font-size:11px;cursor:pointer;padding:2px 4px;text-decoration:underline;">編集</button>
      <button onclick="deleteMemoEvent('${esc(String(ev.id))}')" style="background:transparent;border:none;color:#D85A30;font-size:11px;cursor:pointer;padding:2px 4px;text-decoration:underline;">削除</button>
    </div>
  ` : '';

  const description = ev.description ? `<div style="color:#555;font-size:12px;line-height:1.6;margin-top:4px;white-space:pre-wrap;">${esc(ev.description)}</div>` : '';
  return `
    <div style="position:relative;margin-bottom:18px;">
      <!-- 丸アイコン -->
      <div style="position:absolute;left:-32px;top:0;width:30px;height:30px;border-radius:50%;background:${meta.color}1f;border:2px solid ${meta.color};display:flex;align-items:center;justify-content:center;font-size:14px;">
        ${meta.icon}
      </div>
      <!-- 付箋カード -->
      <div style="background:#fff;border:1px solid #e4e8e7;border-radius:10px;padding:10px 14px;box-shadow:0 1px 3px rgba(0,0,0,.03);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:2px;">
          <div style="font-size:13px;font-weight:600;color:#1a1a1a;flex:1;">${esc(ev.title || meta.label)}</div>
          <div style="font-size:10.5px;color:#aaa;white-space:nowrap;">${dt}</div>
        </div>
        ${description}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
          <span style="font-size:10.5px;color:#888;">by ${esc(staffName)}</span>
          ${actionsHtml}
        </div>
      </div>
    </div>
  `;
}

// メモ追加ボタン/フォームの切替
function toggleAddMemoForm(show) {
  const btn = document.getElementById('tlAddMemoBtn');
  const form = document.getElementById('tlAddMemoForm');
  if (!btn || !form) return;
  if (show) {
    btn.style.display = 'none';
    form.style.display = 'block';
    const ta = document.getElementById('tlMemoInput');
    if (ta) { ta.value = ''; ta.focus(); }
    // 編集モードのリセット
    delete form.dataset.editId;
  } else {
    btn.style.display = 'block';
    form.style.display = 'none';
    delete form.dataset.editId;
  }
}

// メモ送信（新規 or 編集）
async function submitMemo() {
  const ta = document.getElementById('tlMemoInput');
  const form = document.getElementById('tlAddMemoForm');
  if (!ta || !form) return;
  const text = (ta.value || '').trim();
  if (!text) {
    alert('メモを入力してください');
    return;
  }
  if (!editId) return;
  const editEventId = form.dataset.editId;
  if (editEventId) {
    // 編集モード
    const { error } = await sb.from('events').update({
      description: text,
      title: 'メモ（編集済み）'
    }).eq('id', editEventId);
    if (error) { alert('メモの更新に失敗しました: ' + error.message); return; }
  } else {
    // 新規メモ
    await recordEvent(editId, 'memo', 'メモ', text, null);
  }
  toggleAddMemoForm(false);
  await loadAndRenderTimeline();
}

// メモを編集
function editMemoEvent(eventId) {
  const ev = currentTimelineEvents.find(x => String(x.id) === String(eventId));
  if (!ev) return;
  const form = document.getElementById('tlAddMemoForm');
  const btn = document.getElementById('tlAddMemoBtn');
  const ta = document.getElementById('tlMemoInput');
  if (!form || !btn || !ta) return;
  btn.style.display = 'none';
  form.style.display = 'block';
  form.dataset.editId = eventId;
  ta.value = ev.description || '';
  ta.focus();
  // フォームの位置にスクロール
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// メモを削除
async function deleteMemoEvent(eventId) {
  if (!confirm('このメモを削除しますか？')) return;
  const { error } = await sb.from('events').delete().eq('id', eventId);
  if (error) { alert('削除に失敗しました: ' + error.message); return; }
  await loadAndRenderTimeline();
}

// タブのバッジ件数を更新
function updateTabBadges() {
  const tlBadge = document.getElementById('emtBadgeTimeline');
  if (tlBadge) {
    const count = (currentTimelineEvents || []).length;
    if (count > 0) {
      tlBadge.style.display = 'inline-block';
      tlBadge.textContent = String(count);
    } else {
      tlBadge.style.display = 'none';
    }
  }
}

// 既存応募者にタイムラインがない場合、「応募受付」イベントを疑似生成
async function ensureTimelineForExistingApplicants() {
  if (!editId) return;
  // この応募者のイベントが既に1件以上あるならスキップ
  const { data: existing, error: e1 } = await sb.from('events')
    .select('id', { count: 'exact', head: true })
    .eq('applicant_id', editId);
  if (e1) {
    console.warn('[ensureTimeline] 既存チェックエラー', e1);
    return;
  }
  // ↑のheadクエリは件数を取れない場合があるので、確実に1件取ってチェック
  const { data: probe, error: e2 } = await sb.from('events')
    .select('id')
    .eq('applicant_id', editId)
    .limit(1);
  if (e2) { console.warn('[ensureTimeline] probe error', e2); return; }
  if (probe && probe.length > 0) return; // 既にイベントあり
  // 応募者情報から疑似イベント生成
  const a = applicants.find(x => x.id === editId);
  if (!a) return;
  const cid = a.clientId || currentClientId;
  // 応募日を created_at に使う
  let createdAt = null;
  if (a.appDate) {
    // YYYY-MM-DD → ISO形式（時刻は09:00で固定）
    const d = new Date(`${a.appDate}T09:00:00`);
    if (!isNaN(d.getTime())) createdAt = d.toISOString();
  }
  const row = {
    applicant_id: editId,
    client_id: cid,
    event_type: 'applicant_created',
    title: '応募受付',
    description: a.appDate ? `${a.appDate}に応募がありました` : '応募がありました',
    staff_id: null,
    metadata: { auto_generated: true, source: 'past_data' }
  };
  if (createdAt) row.created_at = createdAt;
  const { error: insErr } = await sb.from('events').insert(row);
  if (insErr) console.warn('[ensureTimeline] 疑似イベント生成失敗', insErr);
}

// ========================================
// 面接管理（Phase D-2で追加）
// ========================================

// 面接種別の選択肢（標準）
const INTERVIEW_TYPES = ['1次面接', '2次面接', '3次面接', '最終面接', 'カジュアル面談', '役員面接', 'その他'];

// 面接結果の選択肢
const INTERVIEW_RESULTS = [
  { id: 'pending',   name: '未実施', color: '#888',    bg: '#f0f0ee' },
  { id: 'passed',    name: '通過',   color: '#27500A', bg: '#C0DD97' },
  { id: 'failed',    name: '不通過', color: '#791F1F', bg: '#F09595' },
  { id: 'declined',  name: '辞退',   color: '#854F0B', bg: '#FAC775' },
  { id: 'no_show',   name: '不来場', color: '#0C447C', bg: '#B5D4F4' },
  { id: 'on_hold',   name: '保留',   color: '#26215C', bg: '#CECBF6' },
];

// 旧 result 値（合格/不合格/辞退）を新 result に変換
function mapLegacyInterviewResult(s) {
  if (!s) return 'pending';
  const m = {
    '合格': 'passed',
    '通過': 'passed',
    '不合格': 'failed',
    '不通過': 'failed',
    '辞退': 'declined',
    '不来場': 'no_show',
    '保留': 'on_hold',
  };
  return m[s] || 'pending';
}

// 既存応募者の int1_date / int2_date を interviews テーブルに移行
async function migrateLegacyInterviewsForApplicant(a) {
  if (!a) return;
  // 既に interviews が1件でもあるなら移行済み（スキップ）
  const { data: existing } = await sb.from('interviews')
    .select('id')
    .eq('applicant_id', a.id)
    .limit(1);
  if (existing && existing.length > 0) return;
  // 旧データがあるなら移行
  const cid = a.clientId || currentClientId;
  const rows = [];
  if (a.int1Date || a.int1Res) {
    rows.push({
      applicant_id: a.id,
      client_id: cid,
      interview_type: '1次面接',
      type_other: null,
      scheduled_at: a.int1Date || null,
      format: null,
      location: null,
      memo: null,
      result: mapLegacyInterviewResult(a.int1Res)
    });
  }
  if (a.int2Date || a.int2Res) {
    rows.push({
      applicant_id: a.id,
      client_id: cid,
      interview_type: '2次面接',
      type_other: null,
      scheduled_at: a.int2Date || null,
      format: null,
      location: null,
      memo: null,
      result: mapLegacyInterviewResult(a.int2Res)
    });
  }
  if (rows.length) {
    const { error } = await sb.from('interviews').insert(rows);
    if (error) {
      console.warn('[migrateLegacyInterviews] 失敗', error);
    } else {
      console.log(`[migrateLegacyInterviews] ${a.name}の旧面接データを${rows.length}件移行`);
      // 一覧の面接日列を即時更新するため、a.interviewsにも反映
      a.interviews = (a.interviews || []).concat(rows);
    }
  }
}

// 面接形式の選択肢
const INTERVIEW_FORMATS = [
  { id: 'online', name: 'オンライン' },
  { id: 'onsite', name: '対面' },
];

function getInterviewResultMeta(rid) {
  return INTERVIEW_RESULTS.find(r => r.id === rid) || INTERVIEW_RESULTS[0];
}

// 現在編集中の応募者の面接一覧
let currentInterviews = [];
// 面接編集中のID（null=新規）
let currentInterviewEditId = null;

async function loadAndRenderInterviews() {
  if (!editId) {
    currentInterviews = [];
    renderInterviewsUI();
    return;
  }
  const { data, error } = await sb.from('interviews')
    .select('*')
    .eq('applicant_id', editId)
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[loadAndRenderInterviews] エラー', error);
    currentInterviews = [];
  } else {
    currentInterviews = data || [];
  }
  renderInterviewsUI();
  updateInterviewBadge();
}

function updateInterviewBadge() {
  const badge = document.getElementById('emtBadgeInterviews');
  if (!badge) return;
  const count = (currentInterviews || []).length;
  if (count > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = String(count);
  } else {
    badge.style.display = 'none';
  }
}

function renderInterviewsUI() {
  const container = document.getElementById('interviewsContent');
  if (!container) return;
  const items = currentInterviews || [];

  let html = `
    <!-- 面接追加ボタン/フォーム -->
    <div style="margin-bottom:1.25rem;">
      <button id="ivAddBtn" onclick="toggleInterviewForm(true, null)"
        style="border:1.5px dashed #cee0d8;background:#fafcfb;color:#5aaa8e;padding:11px 18px;border-radius:10px;font-size:13px;font-family:inherit;font-weight:600;cursor:pointer;width:100%;transition:all .15s;">
        ＋ 面接を追加
      </button>
      <div id="ivForm" style="display:none;background:#fafcfb;border:1.5px solid #cee0d8;border-radius:10px;padding:16px;">
        <div id="ivFormTitle" style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:12px;">面接を追加</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;">
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;">面接種別 <span style="color:#e85a5a;">*</span></div>
            <select id="ivType" onchange="onIvTypeChange()" style="width:100%;padding:7px 10px;border:1px solid #e4e8e7;border-radius:6px;background:#fff;font-size:12px;font-family:inherit;">
              ${INTERVIEW_TYPES.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
            </select>
            <input id="ivTypeOther" type="text" placeholder="種別を入力..." style="display:none;width:100%;padding:7px 10px;border:1px solid #e4e8e7;border-radius:6px;background:#fff;font-size:12px;font-family:inherit;margin-top:6px;">
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;">日時</div>
            <input id="ivScheduledAt" type="datetime-local" style="width:100%;padding:7px 10px;border:1px solid #e4e8e7;border-radius:6px;background:#fff;font-size:12px;font-family:inherit;">
            <div style="font-size:10px;color:#aaa;margin-top:3px;">空欄なら「日程未定」</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;">形式</div>
            <select id="ivFormat" style="width:100%;padding:7px 10px;border:1px solid #e4e8e7;border-radius:6px;background:#fff;font-size:12px;font-family:inherit;">
              <option value="">未指定</option>
              ${INTERVIEW_FORMATS.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;">場所 / URL</div>
            <input id="ivLocation" type="text" placeholder="本社会議室 or Zoom URL" style="width:100%;padding:7px 10px;border:1px solid #e4e8e7;border-radius:6px;background:#fff;font-size:12px;font-family:inherit;">
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:4px;">結果</div>
            <select id="ivResult" style="width:100%;padding:7px 10px;border:1px solid #e4e8e7;border-radius:6px;background:#fff;font-size:12px;font-family:inherit;">
              ${INTERVIEW_RESULTS.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
            </select>
          </div>
          <div></div>
          <div style="grid-column:1/-1;">
            <div style="font-size:11px;color:#666;margin-bottom:4px;">メモ</div>
            <textarea id="ivMemo" placeholder="面接の感想や引き継ぎ事項..." style="width:100%;min-height:60px;padding:7px 10px;border:1px solid #e4e8e7;border-radius:6px;background:#fff;font-size:12px;font-family:inherit;resize:vertical;"></textarea>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
          <button onclick="toggleInterviewForm(false, null)" style="padding:7px 14px;border:1px solid #ddd;background:#fff;color:#666;border-radius:7px;font-size:12px;font-family:inherit;cursor:pointer;">キャンセル</button>
          <button onclick="submitInterview()" style="padding:7px 16px;background:#5aaa8e;color:#fff;border:none;border-radius:7px;font-size:12px;font-family:inherit;font-weight:600;cursor:pointer;">記録する</button>
        </div>
      </div>
    </div>
  `;

  if (!items.length) {
    html += `<div style="text-align:center;padding:1.5rem 1rem;color:#aaa;font-size:13px;">
      まだ面接がありません。<br>
      上の「＋ 面接を追加」から登録してください。
    </div>`;
  } else {
    html += items.map(iv => buildInterviewCardHTML(iv)).join('');
  }

  container.innerHTML = html;
}

function buildInterviewCardHTML(iv) {
  const esc = escapeHtml;
  const typeLabel = iv.interview_type === 'その他' ? (iv.type_other || 'その他') : (iv.interview_type || '面接');
  const result = getInterviewResultMeta(iv.result || 'pending');
  // 日時
  let scheduledDisp = '日程未定';
  let scheduledStyle = 'color:#aaa;font-style:italic;';
  if (iv.scheduled_at) {
    const d = new Date(iv.scheduled_at);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      scheduledDisp = `${y}/${m}/${day} ${hh}:${mm}`;
      scheduledStyle = '';
    }
  }
  // 形式
  let formatDisp = '';
  if (iv.format === 'online') formatDisp = 'オンライン';
  else if (iv.format === 'onsite') formatDisp = '対面';
  // 「日程未定」の面接は枠線を強調（要対応）
  const isUnscheduled = !iv.scheduled_at && iv.result === 'pending';
  const cardBorder = isUnscheduled ? '1.5px solid #FAC775' : '1px solid #e4e8e7';

  // 詳細行（場所・メモなど）
  const detailRows = [];
  if (formatDisp) detailRows.push(`<span style="color:#888;">形式</span><span>${esc(formatDisp)}</span>`);
  if (iv.location) {
    const isUrl = /^https?:\/\//i.test(iv.location);
    if (isUrl) {
      detailRows.push(`<span style="color:#888;">場所</span><span><a href="${esc(iv.location)}" target="_blank" rel="noopener" style="color:#185FA5;text-decoration:underline;">${esc(iv.location)}</a></span>`);
    } else {
      detailRows.push(`<span style="color:#888;">場所</span><span>${esc(iv.location)}</span>`);
    }
  }
  if (iv.memo) detailRows.push(`<span style="color:#888;">メモ</span><span style="white-space:pre-wrap;">${esc(iv.memo)}</span>`);

  const detailHtml = detailRows.length ? `
    <div style="display:grid;grid-template-columns:80px 1fr;gap:4px 12px;font-size:12px;color:#555;margin-top:2px;">
      ${detailRows.join('')}
    </div>
  ` : '';

  return `
    <div style="background:#fff;border:${cardBorder};border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="background:#9B59B61f;color:#9B59B6;border:1px solid #9B59B640;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;">${esc(typeLabel)}</span>
          <span style="font-size:13px;font-weight:600;color:#1a1a1a;${scheduledStyle}">${esc(scheduledDisp)}</span>
        </div>
        <span style="background:${result.bg};color:${result.color};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;">${esc(result.name)}</span>
      </div>
      ${detailHtml}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;border-top:1px solid #f0f0ee;padding-top:8px;">
        <button onclick="editInterview('${esc(String(iv.id))}')" style="background:transparent;border:none;color:#888;font-size:11px;cursor:pointer;text-decoration:underline;padding:2px 4px;font-family:inherit;">編集</button>
        <button onclick="deleteInterview('${esc(String(iv.id))}')" style="background:transparent;border:none;color:#D85A30;font-size:11px;cursor:pointer;text-decoration:underline;padding:2px 4px;font-family:inherit;">削除</button>
      </div>
    </div>
  `;
}

// 面接フォームの開閉
function toggleInterviewForm(show, ivId) {
  const btn = document.getElementById('ivAddBtn');
  const form = document.getElementById('ivForm');
  const titleEl = document.getElementById('ivFormTitle');
  if (!btn || !form) return;
  currentInterviewEditId = ivId || null;
  if (show) {
    btn.style.display = 'none';
    form.style.display = 'block';
    if (titleEl) titleEl.textContent = ivId ? '面接を編集' : '面接を追加';
    // フォームのリセット or 既存値ロード
    if (ivId) {
      const iv = currentInterviews.find(x => String(x.id) === String(ivId));
      if (iv) {
        document.getElementById('ivType').value = INTERVIEW_TYPES.includes(iv.interview_type) ? iv.interview_type : 'その他';
        const ivOther = document.getElementById('ivTypeOther');
        if (iv.interview_type === 'その他' || !INTERVIEW_TYPES.includes(iv.interview_type)) {
          ivOther.style.display = '';
          ivOther.value = iv.type_other || iv.interview_type || '';
        } else {
          ivOther.style.display = 'none';
          ivOther.value = '';
        }
        // datetime-local 形式（YYYY-MM-DDTHH:mm）に変換
        if (iv.scheduled_at) {
          const d = new Date(iv.scheduled_at);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth()+1).padStart(2,'0');
            const day = String(d.getDate()).padStart(2,'0');
            const hh = String(d.getHours()).padStart(2,'0');
            const mm = String(d.getMinutes()).padStart(2,'0');
            document.getElementById('ivScheduledAt').value = `${y}-${m}-${day}T${hh}:${mm}`;
          } else {
            document.getElementById('ivScheduledAt').value = '';
          }
        } else {
          document.getElementById('ivScheduledAt').value = '';
        }
        document.getElementById('ivFormat').value = iv.format || '';
        document.getElementById('ivLocation').value = iv.location || '';
        document.getElementById('ivResult').value = iv.result || 'pending';
        document.getElementById('ivMemo').value = iv.memo || '';
      }
    } else {
      // 新規モード：フォームクリア
      document.getElementById('ivType').value = '1次面接';
      const ivOther = document.getElementById('ivTypeOther');
      ivOther.style.display = 'none';
      ivOther.value = '';
      document.getElementById('ivScheduledAt').value = '';
      document.getElementById('ivFormat').value = '';
      document.getElementById('ivLocation').value = '';
      document.getElementById('ivResult').value = 'pending';
      document.getElementById('ivMemo').value = '';
    }
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    btn.style.display = 'block';
    form.style.display = 'none';
    currentInterviewEditId = null;
  }
}

// 「その他」選択時に自由記述欄を表示
function onIvTypeChange() {
  const sel = document.getElementById('ivType');
  const other = document.getElementById('ivTypeOther');
  if (!sel || !other) return;
  if (sel.value === 'その他') {
    other.style.display = '';
    other.focus();
  } else {
    other.style.display = 'none';
    other.value = '';
  }
}

// 面接を保存（新規 or 編集）
async function submitInterview() {
  if (!editId) return;
  const typeSel = document.getElementById('ivType').value;
  const typeOther = document.getElementById('ivTypeOther').value.trim();
  if (typeSel === 'その他' && !typeOther) {
    alert('「その他」選択時は種別を入力してください');
    return;
  }
  const sched = document.getElementById('ivScheduledAt').value;
  const format = document.getElementById('ivFormat').value;
  const location = document.getElementById('ivLocation').value.trim();
  const result = document.getElementById('ivResult').value;
  const memo = document.getElementById('ivMemo').value.trim();

  // 応募者のclient_id
  const a = applicants.find(x => x.id === editId);
  const cid = a ? a.clientId : currentClientId;

  const row = {
    applicant_id: editId,
    client_id: cid,
    interview_type: typeSel,
    type_other: (typeSel === 'その他') ? typeOther : null,
    scheduled_at: sched ? new Date(sched).toISOString() : null,
    format: format || null,
    location: location || null,
    memo: memo || null,
    result: result || 'pending'
  };

  let savedRow = null;
  let oldData = null;
  if (currentInterviewEditId) {
    oldData = currentInterviews.find(x => String(x.id) === String(currentInterviewEditId));
    const { error } = await sb.from('interviews').update(row).eq('id', currentInterviewEditId);
    if (error) { alert('更新に失敗しました: ' + error.message); return; }
    savedRow = { ...oldData, ...row, id: currentInterviewEditId };
  } else {
    const { data: ins, error } = await sb.from('interviews').insert(row).select().single();
    if (error) { alert('登録に失敗しました: ' + error.message); return; }
    savedRow = ins;
  }

  // タイムラインへイベント記録
  try {
    const typeLabel = typeSel === 'その他' ? (typeOther || 'その他') : typeSel;
    const dateLabel = row.scheduled_at ? new Date(row.scheduled_at).toLocaleString('ja-JP', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '日程未定';
    if (currentInterviewEditId) {
      // 編集
      const resName = getInterviewResultMeta(result).name;
      const oldRes = oldData ? getInterviewResultMeta(oldData.result || 'pending').name : '';
      const title = `面接更新：${typeLabel}`;
      const desc = `日時：${dateLabel}\n結果：${oldRes} → ${resName}`;
      await recordEvent(editId, 'interview_updated', title, desc, { interview_id: currentInterviewEditId });
    } else {
      // 新規
      const title = `面接登録：${typeLabel}`;
      const desc = `日時：${dateLabel}`;
      await recordEvent(editId, 'interview_added', title, desc, { interview_id: savedRow ? savedRow.id : null });
    }
  } catch (e) {
    console.warn('[submitInterview] イベント記録失敗（無視）', e);
  }

  toggleInterviewForm(false, null);
  await loadAndRenderInterviews();
  // タイムラインタブのバッジも更新
  if (editId) {
    try {
      const { count } = await sb.from('events')
        .select('*', { count: 'exact', head: true })
        .eq('applicant_id', editId);
      const tlBadge = document.getElementById('emtBadgeTimeline');
      if (tlBadge && typeof count === 'number') {
        if (count > 0) { tlBadge.style.display = 'inline-block'; tlBadge.textContent = String(count); }
        else { tlBadge.style.display = 'none'; }
      }
    } catch(e) {}
  }
}

// 面接編集
function editInterview(ivId) {
  toggleInterviewForm(true, ivId);
}

// 面接削除
async function deleteInterview(ivId) {
  if (!confirm('この面接を削除しますか？')) return;
  const target = currentInterviews.find(x => String(x.id) === String(ivId));
  const { error } = await sb.from('interviews').delete().eq('id', ivId);
  if (error) { alert('削除に失敗しました: ' + error.message); return; }
  // タイムラインに記録
  if (target && editId) {
    try {
      const typeLabel = target.interview_type === 'その他' ? (target.type_other || 'その他') : (target.interview_type || '面接');
      await recordEvent(editId, 'interview_updated', `面接削除：${typeLabel}`, '面接を削除しました', { interview_id: ivId, deleted: true });
    } catch(e) {}
  }
  await loadAndRenderInterviews();
}

// ========================================
// Phase D-3：ファイル添付機能
// ========================================

// 設定値
const FILE_BUCKET = 'applicant-files';
const FILE_MAX_SIZE = 10 * 1024 * 1024;  // 10MB
const FILE_ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'text/plain', 'text/csv'
];

// 現在編集中の応募者のファイル一覧
let currentFiles = [];

// MIME → アイコン
function getFileIcon(mime, name) {
  const m = (mime || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (m.includes('pdf')) return '📕';
  if (m.includes('word') || n.endsWith('.doc') || n.endsWith('.docx')) return '📘';
  if (m.includes('sheet') || m.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return '📗';
  if (m.includes('presentation') || n.endsWith('.ppt') || n.endsWith('.pptx')) return '📙';
  if (m.includes('zip')) return '🗜️';
  if (m.startsWith('image/')) return '🖼️';
  if (m.startsWith('text/')) return '📄';
  return '📎';
}

// バイト → 読みやすい文字列
function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ファイル一覧をロード→描画
async function loadAndRenderFiles() {
  if (!editId) {
    currentFiles = [];
    renderFilesUI();
    return;
  }
  // events から file イベントを取得（削除されていないもののみ＝metadata.deleted!=true）
  const { data, error } = await sb.from('events')
    .select('*')
    .eq('applicant_id', editId)
    .eq('event_type', 'file')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[loadAndRenderFiles] エラー', error);
    currentFiles = [];
  } else {
    // metadata.deleted=true は除外
    currentFiles = (data || []).filter(ev => {
      const m = ev.metadata || {};
      return !m.deleted;
    });
  }
  renderFilesUI();
  updateFilesBadge();
}

// バッジ更新
function updateFilesBadge() {
  const badge = document.getElementById('emtBadgeFiles');
  if (!badge) return;
  const count = (currentFiles || []).length;
  if (count > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = String(count);
  } else {
    badge.style.display = 'none';
  }
}

// ファイルタブUI描画
function renderFilesUI() {
  const container = document.getElementById('filesContent');
  if (!container) return;
  const items = currentFiles || [];
  const esc = escapeHtml;

  let html = `
    <!-- アップロードエリア -->
    <div id="fileDropZone"
      onclick="document.getElementById('fileInput').click()"
      ondragover="onFileDragOver(event)"
      ondragleave="onFileDragLeave(event)"
      ondrop="onFileDrop(event)"
      style="border:1.5px dashed #cee0d8;background:#fafcfb;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem;transition:all .15s;">
      <div style="font-size:32px;margin-bottom:6px;">📎</div>
      <div style="font-size:13px;color:#5aaa8e;font-weight:600;margin-bottom:4px;">
        クリック または ファイルをドラッグ＆ドロップ
      </div>
      <div style="font-size:11px;color:#aaa;">
        PDF / Word / Excel / PowerPoint / 画像 / zip など（最大10MB）
      </div>
      <input type="file" id="fileInput" style="display:none;"
        onchange="onFilePicked(this.files)" multiple>
    </div>
    <div id="fileUploadProgress" style="display:none;margin-bottom:1rem;"></div>
  `;

  if (!items.length) {
    html += `<div style="text-align:center;padding:1.5rem 1rem;color:#aaa;font-size:13px;">
      まだファイルがありません。
    </div>`;
  } else {
    html += `<div style="display:flex;flex-direction:column;gap:8px;">
      ${items.map(ev => buildFileItemHTML(ev)).join('')}
    </div>`;
  }
  container.innerHTML = html;
}

// 1ファイルアイテムのHTML
function buildFileItemHTML(ev) {
  const meta = ev.metadata || {};
  const fileName = ev.file_name || meta.file_name || 'ファイル';
  const filePath = ev.file_url || meta.file_path || '';
  const mime = meta.mime || '';
  const size = meta.size || 0;
  const icon = getFileIcon(mime, fileName);
  const sizeStr = formatFileSize(size);
  const staffName = getStaffNameById(ev.staff_id);
  const esc = escapeHtml;
  // 日時
  let dt = '';
  if (ev.created_at) {
    const d = new Date(ev.created_at);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      dt = `${y}/${m}/${day} ${hh}:${mm}`;
    }
  }
  return `
    <div class="file-item" data-event-id="${esc(ev.id)}"
      style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border:1px solid #ececea;border-radius:10px;transition:all .15s;">
      <div style="font-size:28px;line-height:1;flex-shrink:0;">${icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:#1a1a1a;word-break:break-all;line-height:1.4;margin-bottom:3px;">
          ${esc(fileName)}
        </div>
        <div style="font-size:11px;color:#888;display:flex;gap:10px;flex-wrap:wrap;">
          ${sizeStr ? `<span>${sizeStr}</span>` : ''}
          <span>${dt}</span>
          <span>${esc(staffName)}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button onclick="downloadFile('${esc(ev.id)}')"
          style="padding:6px 12px;font-size:12px;background:#5aaa8e;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600;">
          ダウンロード
        </button>
        <button onclick="deleteFile('${esc(ev.id)}')"
          style="padding:6px 10px;font-size:12px;background:#fff;color:#D85A30;border:1px solid #f0d4c8;border-radius:6px;cursor:pointer;font-family:inherit;">
          削除
        </button>
      </div>
    </div>
  `;
}

// ドラッグ&ドロップ ハンドラ
function onFileDragOver(e) {
  e.preventDefault();
  const z = document.getElementById('fileDropZone');
  if (z) {
    z.style.background = '#eef7f3';
    z.style.borderColor = '#5aaa8e';
  }
}
function onFileDragLeave(e) {
  e.preventDefault();
  const z = document.getElementById('fileDropZone');
  if (z) {
    z.style.background = '#fafcfb';
    z.style.borderColor = '#cee0d8';
  }
}
function onFileDrop(e) {
  e.preventDefault();
  onFileDragLeave(e);
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    onFilePicked(e.dataTransfer.files);
  }
}

// ファイルが選ばれた／ドロップされた
async function onFilePicked(files) {
  if (!files || !files.length) return;
  if (!editId) {
    alert('応募者を保存してからファイルを添付してください');
    return;
  }
  // 順次アップロード
  for (let i = 0; i < files.length; i++) {
    await uploadOneFile(files[i]);
  }
  // input をクリア（同名を再度選べるように）
  const input = document.getElementById('fileInput');
  if (input) input.value = '';
  await loadAndRenderFiles();
}

// 1ファイルをアップロード
async function uploadOneFile(file) {
  if (!file) return;
  // バリデーション
  if (file.size > FILE_MAX_SIZE) {
    alert(`「${file.name}」は10MBを超えています（${formatFileSize(file.size)}）`);
    return;
  }
  // MIMEチェック（緩め：空 or 許可リストにあればOK。ブラウザがMIMEを返さないケースもあるので拡張子も許容）
  const mime = file.type || '';
  const okByMime = !mime || FILE_ALLOWED_MIME.includes(mime);
  const okByExt = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|jpg|jpeg|png|gif|webp|heic|txt|csv)$/i.test(file.name);
  if (!okByMime && !okByExt) {
    alert(`「${file.name}」は許可されていない形式です（${mime || '不明'}）`);
    return;
  }

  // パス組立：{client_id}/{applicant_id}/{timestamp}_{ランダム}.{拡張子}
  // ※ Supabase Storage は ASCII以外のキーを拒否するため、パスには日本語等を含めない。
  //   元のファイル名は events.file_name / metadata.file_name に保存し、ダウンロード時に復元する。
  const a = applicants.find(x => x.id === editId);
  const cid = (a && a.clientId) ? a.clientId : currentClientId;
  if (!cid) {
    alert('クライアントIDが取得できませんでした');
    return;
  }
  // 安全装置：cidが 'admin' の応募者にはアップロードできない（外部キー制約違反防止）
  if (cid === 'admin') {
    alert('この応募者は所属クライアントが正しく設定されていないため、ファイルをアップロードできません。\n管理者にクライアントの設定を依頼してください。');
    return;
  }
  // client_id 自体も ASCIIに正規化（既存IDは英数だが念のため）
  const cidSafe = String(cid).replace(/[^A-Za-z0-9_-]/g, '_');
  // 拡張子を抽出（元ファイル名の最後のドット以降。なければ空）
  const m = file.name.match(/\.([A-Za-z0-9]{1,8})$/);
  const ext = m ? '.' + m[1].toLowerCase() : '';
  // 衝突防止のランダム文字列（タイムスタンプ＋6桁ランダム）
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  // Storage上のオブジェクトキー（ASCII限定）
  const objectPath = `${cidSafe}/${editId}/${ts}_${rand}${ext}`;

  // 進捗UI
  showFileProgress(`「${file.name}」をアップロード中...`, 'info');

  // Storageへアップロード
  const { data, error } = await sb.storage.from(FILE_BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: mime || 'application/octet-stream'
  });
  if (error) {
    showFileProgress(`「${file.name}」アップロード失敗：${error.message}`, 'err');
    return;
  }

  // events に記録
  try {
    const staffId = isAdmin ? null : (currentStaffId || null);
    const insertRow = {
      applicant_id: editId,
      client_id: cid,
      event_type: 'file',
      title: `ファイル添付：${file.name}`,
      description: null,
      staff_id: staffId,
      file_url: objectPath,
      file_name: file.name,
      metadata: {
        file_path: objectPath,
        file_name: file.name,
        mime: mime,
        size: file.size
      }
    };
    const { error: e2 } = await sb.from('events').insert(insertRow);
    if (e2) {
      console.warn('[uploadOneFile] events記録失敗', e2);
      showFileProgress(`「${file.name}」記録に失敗：${e2.message}`, 'err');
      return;
    }
  } catch (e) {
    console.warn('[uploadOneFile] 例外', e);
  }

  showFileProgress(`「${file.name}」をアップロードしました`, 'ok');
}

// 進捗表示
function showFileProgress(msg, level) {
  const box = document.getElementById('fileUploadProgress');
  if (!box) return;
  const colors = {
    ok:   { bg:'#f3faf0', fg:'#3B6D11', bd:'#cce8b8' },
    err:  { bg:'#fdf3ef', fg:'#D85A30', bd:'#f0d4c8' },
    info: { bg:'#eef7f3', fg:'#3a6b5a', bd:'#cee0d8' }
  };
  const c = colors[level] || colors.info;
  box.style.display = 'block';
  box.style.background = c.bg;
  box.style.color = c.fg;
  box.style.border = `1px solid ${c.bd}`;
  box.style.borderRadius = '8px';
  box.style.padding = '8px 12px';
  box.style.fontSize = '12px';
  box.textContent = msg;
  // okなら3秒後に消す
  if (level === 'ok') {
    setTimeout(() => { if (box) box.style.display = 'none'; }, 3000);
  }
}

// ファイルダウンロード（署名付きURL発行 → 新しいタブで開く）
async function downloadFile(eventId) {
  const ev = currentFiles.find(x => String(x.id) === String(eventId));
  if (!ev) { alert('ファイル情報が見つかりません'); return; }
  const path = ev.file_url || (ev.metadata && ev.metadata.file_path);
  if (!path) { alert('ファイルパスが不明です'); return; }
  // 元のファイル名（日本語OK）
  const origName = ev.file_name || (ev.metadata && ev.metadata.file_name) || 'download';
  // 署名付きURL（60秒有効）を発行。download オプションを渡すと
  // Supabase側で Content-Disposition: attachment; filename を付与してくれる
  const { data, error } = await sb.storage.from(FILE_BUCKET).createSignedUrl(path, 60, {
    download: origName
  });
  if (error || !data || !data.signedUrl) {
    alert('ダウンロードURLの取得に失敗しました：' + (error ? error.message : '不明なエラー'));
    return;
  }
  // ダウンロード（aタグ経由で元ファイル名で保存）
  const link = document.createElement('a');
  link.href = data.signedUrl;
  link.download = origName;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ファイル削除
async function deleteFile(eventId) {
  const ev = currentFiles.find(x => String(x.id) === String(eventId));
  if (!ev) { alert('ファイル情報が見つかりません'); return; }
  const fileName = ev.file_name || (ev.metadata && ev.metadata.file_name) || 'ファイル';
  if (!confirm(`「${fileName}」を削除します。よろしいですか？`)) return;

  const path = ev.file_url || (ev.metadata && ev.metadata.file_path);
  // Storageから削除
  if (path) {
    const { error: e1 } = await sb.storage.from(FILE_BUCKET).remove([path]);
    if (e1) {
      console.warn('[deleteFile] Storage削除エラー（続行します）', e1);
    }
  }
  // events から該当レコードを削除
  const { error: e2 } = await sb.from('events').delete().eq('id', eventId);
  if (e2) {
    alert('レコード削除に失敗しました：' + e2.message);
    return;
  }
  // タイムラインに削除イベントを記録（残るのが分かるように）
  try {
    await recordEvent(editId, 'memo_delete', `ファイル削除：${fileName}`, null, { deleted_file: fileName });
  } catch(e) {}

  await loadAndRenderFiles();
}


// ========================================
// 担当者管理（Phase B-1で追加）
// ========================================

// 担当者一覧をDBから取得
async function loadStaff() {
  // RLSにより、admin=全件、クライアント=自社のみ取得
  const { data, error } = await sb.from('staff').select('*').order('ord').order('created_at');
  if (error) {
    console.error('担当者取得エラー', error);
    setStatus('担当者情報の取得に失敗しました: ' + error.message, 'err');
    staffList = [];
    return;
  }
  staffList = data || [];
}

// 担当者管理画面のクライアント絞り込みプルダウン（admin専用）
function populateStaffClientFilter() {
  const sel = document.getElementById('staffClientFilter');
  const th = document.getElementById('staffThClient');
  const addWrap = document.getElementById('staffAddClientWrap');
  const addSel = document.getElementById('newSClient');
  if (!sel) return;
  if (!isAdmin) {
    sel.style.display = 'none';
    if (th) th.style.display = 'none';
    if (addWrap) addWrap.style.display = 'none';
    return;
  }
  // staffから登場するクライアントID + clients配列の両方を選択肢にする
  const cidsInStaff = [...new Set(staffList.map(s => s.client_id).filter(Boolean))];
  const allCids = new Set();
  (clients || []).forEach(c => { if (c.client_id) allCids.add(c.client_id); });
  cidsInStaff.forEach(c => allCids.add(c));
  const sortedCids = [...allCids].sort((a, b) => {
    const an = getClientDisplayName(a);
    const bn = getClientDisplayName(b);
    return an.localeCompare(bn, 'ja');
  });

  // フィルタプルダウン
  const cur = sel.value;
  sel.innerHTML = '<option value="">全クライアント</option>'
    + sortedCids.map(cid => `<option value="${escapeOwnerHtml(cid)}">${escapeOwnerHtml(getClientDisplayName(cid))}</option>`).join('');
  sel.style.display = 'inline-block';
  if (cur) sel.value = cur;

  // テーブルヘッダ「クライアント」列もadmin時のみ表示
  if (th) th.style.display = 'table-cell';

  // 新規追加フォームのクライアント選択も admin時のみ表示
  if (addWrap && addSel) {
    addWrap.style.display = '';
    const curAdd = addSel.value;
    addSel.innerHTML = '<option value="">クライアントを選択</option>'
      + sortedCids.map(cid => `<option value="${escapeOwnerHtml(cid)}">${escapeOwnerHtml(getClientDisplayName(cid))}</option>`).join('');
    if (curAdd) addSel.value = curAdd;
  }
}

// 担当者管理画面の描画
async function renderStaff() {
  await loadStaff();
  // adminならclientsも欲しい（プルダウン用）
  if (isAdmin && (!clients || !clients.length)) {
    await loadClients();
  }
  populateStaffClientFilter();

  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;

  // フィルタ適用
  const cf = isAdmin ? (document.getElementById('staffClientFilter')?.value || '') : '';
  const af = document.getElementById('staffActiveFilter')?.value || 'active';

  let filtered = staffList.slice();
  if (cf) filtered = filtered.filter(s => s.client_id === cf);
  if (af === 'active')   filtered = filtered.filter(s => s.is_active);
  if (af === 'inactive') filtered = filtered.filter(s => !s.is_active);

  if (!filtered.length) {
    const colspan = isAdmin ? 5 : 4;
    tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;color:#aaa;padding:1rem;">該当する担当者がいません</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const safeName  = String(s.name || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const safeEmail = String(s.email || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const rowId = String(s.id).replace(/'/g, "\\'");
    const stateBadge = s.is_active
      ? '<span class="badge" style="background:#e8f5e8;color:#3B6D11;">在籍中</span>'
      : '<span class="badge" style="background:#f0f0f0;color:#888;">退職</span>';
    const emailDisplay = safeEmail ? `<code style="font-size:11px;">${safeEmail}</code>` : '<span style="color:#aaa;">-</span>';
    const clientCell = isAdmin
      ? `<td><span style="font-size:11px;color:#666;">${escapeOwnerHtml(getClientDisplayName(s.client_id))}</span></td>`
      : '';
    return `<tr>
      ${clientCell}
      <td>${safeName}</td>
      <td>${emailDisplay}</td>
      <td>${stateBadge}</td>
      <td>
        <button class="btn btn-s" onclick="deleteStaff('${rowId}')" style="margin-right:4px;">削除</button>
        <button class="btn btn-s" onclick="editStaff('${rowId}')" style="background:#378ADD;color:#fff;border-color:#378ADD;">編集</button>
      </td>
    </tr>`;
  }).join('');
}

// 担当者を追加
async function addStaff() {
  const nameEl  = document.getElementById('newSName');
  const emailEl = document.getElementById('newSEmail');
  const clientEl = document.getElementById('newSClient'); // admin時のみ存在意義あり
  const name  = (nameEl?.value || '').trim();
  const email = (emailEl?.value || '').trim();

  if (!name) {
    setStatus('名前を入力してください', 'err');
    return;
  }
  // メアド形式チェック（任意なので空欄OK、入力されていれば形式チェック）
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatus('メールアドレス形式が正しくありません', 'err');
    return;
  }

  // どのclient_idで登録するかを決定
  let targetClientId = null;
  if (isAdmin) {
    targetClientId = (clientEl?.value || '').trim();
    if (!targetClientId) {
      setStatus('クライアントを選択してください', 'err');
      return;
    }
  } else {
    targetClientId = currentClientId;
  }

  const insertObj = { client_id: targetClientId, name: name };
  if (email) insertObj.email = email;

  const { error } = await sb.from('staff').insert(insertObj);
  if (error) {
    setStatus('追加に失敗しました: ' + error.message, 'err');
    return;
  }
  setStatus('担当者を追加しました', 'ok');
  if (nameEl) nameEl.value = '';
  if (emailEl) emailEl.value = '';
  // adminのclient選択は残す（連続追加しやすいように）
  await renderStaff();
}

// 編集ダイアログを開く
function editStaff(rowId) {
  const target = staffList.find(s => String(s.id) === String(rowId));
  if (!target) { setStatus('対象の担当者が見つかりません', 'err'); return; }
  const form = document.getElementById('editStaffForm');
  if (!form) return;
  document.getElementById('editSRowId').value = target.id;
  document.getElementById('editSName').value = target.name || '';
  document.getElementById('editSEmail').value = target.email || '';
  document.getElementById('editSActive').value = target.is_active ? 'true' : 'false';
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelStaffEdit() {
  const form = document.getElementById('editStaffForm');
  if (form) form.style.display = 'none';
}

// 編集を保存
async function saveStaffEdit() {
  const rowId = document.getElementById('editSRowId').value;
  const name  = (document.getElementById('editSName').value || '').trim();
  const email = (document.getElementById('editSEmail').value || '').trim();
  const isActiveStr = (document.getElementById('editSActive').value || 'true');
  const isActive = isActiveStr === 'true';

  if (!rowId) { setStatus('対象IDが取得できません', 'err'); return; }
  if (!name) { setStatus('名前を入力してください', 'err'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatus('メールアドレス形式が正しくありません', 'err'); return;
  }

  const updateObj = { name, email: email || null, is_active: isActive };

  try {
    const { error } = await sb.from('staff').update(updateObj).eq('id', rowId);
    if (error) { setStatus('更新に失敗しました: ' + error.message, 'err'); return; }
  } catch(e) {
    setStatus('更新に失敗しました: ' + (e.message || e), 'err');
    return;
  }

  setStatus('担当者情報を更新しました', 'ok');
  cancelStaffEdit();
  await renderStaff();
}

// 担当者を削除（紐付きがあれば自動的に退職フラグへ）
async function deleteStaff(rowId) {
  const target = staffList.find(s => String(s.id) === String(rowId));
  if (!target) { setStatus('対象の担当者が見つかりません', 'err'); return; }

  // 応募者との紐付けがあるかチェック
  let linkedCount = 0;
  try {
    const { count, error } = await sb.from('applicant_staff')
      .select('*', { count: 'exact', head: true })
      .eq('staff_id', target.id);
    if (error) {
      console.warn('applicant_staff チェックエラー', error);
    } else {
      linkedCount = count || 0;
    }
  } catch (e) {
    console.warn('applicant_staff チェック例外', e);
  }

  if (linkedCount > 0) {
    // 紐付きあり → 物理削除せず退職フラグへ
    const msg = `担当者「${target.name}」は ${linkedCount} 件の応募者に紐付いています。\n\n履歴を維持するため、物理削除ではなく「退職」状態に変更します。\n続行しますか？`;
    if (!confirm(msg)) return;
    const { error } = await sb.from('staff').update({ is_active: false }).eq('id', rowId);
    if (error) { setStatus('退職処理に失敗しました: ' + error.message, 'err'); return; }
    setStatus(`担当者「${target.name}」を退職状態に変更しました（履歴は維持されます）`, 'ok');
    await renderStaff();
    return;
  }

  // 紐付きなし → 物理削除
  if (!confirm(`担当者「${target.name}」を削除しますか？この操作は取り消せません。`)) return;
  const { error } = await sb.from('staff').delete().eq('id', rowId);
  if (error) { setStatus('削除に失敗しました: ' + error.message, 'err'); return; }
  setStatus(`担当者「${target.name}」を削除しました`, 'ok');
  await renderStaff();
}

// ========================================
// マスター管理UI（媒体・部署・人材紹介会社・担当者）
// 左タブ式 + 検索 + インライン編集 + ドラッグ並べ替え + Undoトースト
// ========================================
let _mmCurrentTab = 'media';
let _mmFilter = { media:'', dept:'', agency:'', assignee:'' };
let _mmDeleted = null; // {type, value, index, timer}

function switchMmTab(tab) {
  _mmCurrentTab = tab;
  document.querySelectorAll('.mm-side-btn').forEach(b => b.classList.toggle('active', b.dataset.mmTab === tab));
  document.querySelectorAll('.mm-pane').forEach(p => p.style.display = 'none');
  const pane = document.getElementById('mmPane-' + tab);
  if (pane) pane.style.display = 'block';
  // ステータスタブを開いたときは描画更新
  if (tab === 'status') {
    if (typeof renderStatusMaster === 'function') renderStatusMaster();
  }
}

// 各タイプの使用件数を計算
function getMmUsageCount(type, value) {
  if (type === 'media') return applicants.filter(a => a.media === value).length;
  if (type === 'dept') return applicants.filter(a => a.dept === value).length;
  if (type === 'agency') return applicants.filter(a => a.agency === value).length;
  if (type === 'assignee') return 0; // 担当者マスターは別系統で使われる
  return 0;
}

function renderManage() {
  // 既存のマスター項目を表示
  renderMasterList('media', 'mlMed');
  renderMasterList('dept', 'mlDept');
  renderMasterList('agency', 'mlAg');
  renderMasterList('assignee', 'mlAssignee');
  // 件数バッジ更新
  const cnt = (t) => (masters[t] || []).length;
  const ce = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  ce('mmCountMedia', cnt('media'));
  ce('mmCountDept', cnt('dept'));
  ce('mmCountAgency', cnt('agency'));
  ce('mmCountAssignee', cnt('assignee'));
  ce('mmCountStatus', (detailStatuses || []).length);
  // ステータスマスターも更新
  renderStatusMaster();
}

function renderMasterList(type, listId) {
  const ul = document.getElementById(listId);
  if (!ul) return;
  const items = masters[type] || [];
  const filter = (_mmFilter[type] || '').toLowerCase();
  const filtered = filter
    ? items.map((v, i) => ({ v, i })).filter(x => x.v.toLowerCase().includes(filter))
    : items.map((v, i) => ({ v, i }));

  if (!filtered.length) {
    ul.innerHTML = `<li class="mm-empty">${filter ? '一致する項目なし' : '登録なし'}</li>`;
    return;
  }
  ul.innerHTML = filtered.map(x => {
    const usage = getMmUsageCount(type, x.v);
    const usageClass = usage > 0 ? 'mm-usage has' : 'mm-usage zero';
    const usageText = usage > 0 ? `${usage}件使用中` : '未使用';
    return `<li class="mm-item" draggable="true" data-type="${type}" data-index="${x.i}"
        ondragstart="onMmDragStart(event)" ondragend="onMmDragEnd(event)"
        ondragover="onMmDragOver(event)" ondrop="onMmDrop(event)" ondragleave="onMmDragLeave(event)">
      <span class="mm-handle" title="ドラッグで並べ替え">⋮⋮</span>
      <span class="mm-name" onclick="startMmRename(this, '${type}', ${x.i})" title="クリックでリネーム">${escapeHtml(x.v)}</span>
      <span class="${usageClass}">${usageText}</span>
      <button class="mm-del" onclick="deleteM('${type}', ${x.i})" title="削除">✕</button>
    </li>`;
  }).join('');
}

// 検索フィルタ
function filterMmList(type, value) {
  _mmFilter[type] = value || '';
  const listId = { media:'mlMed', dept:'mlDept', agency:'mlAg', assignee:'mlAssignee' }[type];
  if (listId) renderMasterList(type, listId);
}

// インライン編集（リネーム）
function startMmRename(spanEl, type, index) {
  const oldVal = (masters[type] || [])[index];
  if (oldVal === undefined) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'mm-name-input';
  input.value = oldVal;
  input.dataset.type = type;
  input.dataset.index = index;
  input.dataset.oldVal = oldVal;
  input.onblur = () => commitMmRename(input);
  input.onkeydown = (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = oldVal; input.blur(); }
  };
  spanEl.replaceWith(input);
  input.focus();
  input.select();
}

async function commitMmRename(input) {
  const type = input.dataset.type;
  const index = parseInt(input.dataset.index);
  const oldVal = input.dataset.oldVal;
  const newVal = input.value.trim();
  // キャンセル系：空 or 同値ならそのまま戻す
  if (!newVal || newVal === oldVal) {
    renderManage();
    return;
  }
  // 重複チェック
  if ((masters[type] || []).includes(newVal)) {
    showMmToast(`「${newVal}」は既に登録されています`, false);
    renderManage();
    return;
  }
  // Supabase更新（旧値→新値）
  const cid = isAdmin ? 'admin' : currentClientId;
  const { error } = await sb.from('masters')
    .update({ value: newVal })
    .eq('client_id', cid).eq('type', type).eq('value', oldVal);
  if (error) {
    showMmToast('リネームに失敗：' + error.message, false);
    renderManage();
    return;
  }
  // 既存応募者で参照しているレコードも更新（部署・媒体・紹介会社）
  if (['media','dept','agency'].includes(type)) {
    const fieldMap = { media:'media', dept:'dept', agency:'agency' };
    const f = fieldMap[type];
    let q = sb.from('applicants').update({ [f]: newVal }).eq(f, oldVal);
    if (!isAdmin) q = q.eq('client_id', currentClientId);
    const { error: e2 } = await q;
    if (e2) console.warn('[mm rename] 応募者の参照更新失敗（無視）', e2);
    // ローカルapplicantsにも反映
    applicants.forEach(a => { if (a[f] === oldVal) a[f] = newVal; });
  }
  // ローカルのmasters更新
  masters[type][index] = newVal;
  showMmToast(`「${oldVal}」を「${newVal}」に変更しました`, true);
  renderManage();
  popSelects();
}

// ===== ドラッグ並べ替え =====
let _mmDragSrc = null;
function onMmDragStart(e) {
  const li = e.currentTarget;
  _mmDragSrc = { type: li.dataset.type, index: parseInt(li.dataset.index) };
  li.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  // Firefox 対応：何かsetDataしないとドラッグが起きない
  try { e.dataTransfer.setData('text/plain', '_'); } catch(_) {}
}
function onMmDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.mm-item.drop-target').forEach(el => el.classList.remove('drop-target'));
  _mmDragSrc = null;
}
function onMmDragOver(e) {
  if (!_mmDragSrc) return;
  const li = e.currentTarget;
  if (li.dataset.type !== _mmDragSrc.type) return;
  e.preventDefault();
  document.querySelectorAll('.mm-item.drop-target').forEach(el => el.classList.remove('drop-target'));
  li.classList.add('drop-target');
}
function onMmDragLeave(e) {
  e.currentTarget.classList.remove('drop-target');
}
async function onMmDrop(e) {
  if (!_mmDragSrc) return;
  e.preventDefault();
  const li = e.currentTarget;
  const dstType = li.dataset.type;
  const dstIndex = parseInt(li.dataset.index);
  if (dstType !== _mmDragSrc.type || dstIndex === _mmDragSrc.index) return;
  // 並べ替え（ローカル）
  const arr = masters[dstType] || [];
  const [moved] = arr.splice(_mmDragSrc.index, 1);
  arr.splice(dstIndex, 0, moved);
  // Supabase 側：単純な並び順保持カラムが masters テーブルにない場合があるので、
  // 「順番ごとに更新」は重い操作になる。今のスキーマでは ord カラムがあるか確認。
  // 無ければローカル順序のみ反映（リロードで初期化される可能性あり）
  // ord 更新を試みる（テーブルにordカラムが無ければ静かに失敗するだけ）
  const cid = isAdmin ? 'admin' : currentClientId;
  for (let i = 0; i < arr.length; i++) {
    try {
      await sb.from('masters').update({ ord: i }).eq('client_id', cid).eq('type', dstType).eq('value', arr[i]);
    } catch(_) {} // ord列が無い場合などは無視
  }
  showMmToast('並び順を変更しました', true);
  renderManage();
  popSelects();
}

// ===== Undoトースト =====
function showMmToast(msg, undoable) {
  const t = document.getElementById('mmToast');
  const m = document.getElementById('mmToastMsg');
  const u = document.getElementById('mmToastUndo');
  if (!t || !m || !u) return;
  m.textContent = msg;
  // undoableは削除時のみ true、それ以外（リネーム成功通知等）は false
  u.style.display = (undoable && _mmDeleted) ? 'inline-block' : 'none';
  t.style.display = 'flex';
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => { t.style.display = 'none'; }, 5000);
}

async function undoMmDelete() {
  if (!_mmDeleted) return;
  const { type, value, index } = _mmDeleted;
  // Supabaseに復活
  const cid = isAdmin ? 'admin' : currentClientId;
  const insertRow = { client_id: cid, type, value };
  const { error } = await sb.from('masters').insert(insertRow);
  if (error) {
    showMmToast('元に戻すのに失敗：' + error.message, false);
    return;
  }
  // ローカルにも復活
  if (!masters[type]) masters[type] = [];
  masters[type].splice(index, 0, value);
  _mmDeleted = null;
  document.getElementById('mmToast').style.display = 'none';
  showMmToast(`「${value}」を復元しました`, false);
  renderManage();
  popSelects();
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
  showMmToast(`「${value}」を追加しました`, false);
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
  // Undo用にバックアップしてローカル削除
  _mmDeleted = { type, value, index };
  masters[type].splice(index, 1);
  showMmToast(`「${value}」を削除しました`, true);
  // 5秒後にUndo情報を破棄
  setTimeout(() => { _mmDeleted = null; }, 5000);
  renderManage();
  popSelects();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
  if (p1.length < 6) { alert('パスワードは6文字以上にしてください'); return; }

  // Supabase Auth経由でパスワード変更（adminもクライアントも共通）
  try {
    const { data, error } = await sb.auth.updateUser({ password: p1 });
    if (error) {
      alert('変更に失敗しました: ' + (error.message || '不明なエラー'));
      return;
    }
  } catch(e) {
    alert('変更に失敗しました: ' + (e.message || e));
    return;
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
// パスワードリセットフロー（Supabase Auth recovery対応）
// ========================================
// メール内リンク経由で来た場合、URLハッシュに access_token と type=recovery が含まれる
// 例: https://example.com/#access_token=xxx&refresh_token=yyy&type=recovery&...
function checkPasswordRecoveryFlow() {
  try {
    const hash = window.location.hash || '';
    if (!hash || hash.length < 2) return false;
    // ハッシュをパース
    const params = new URLSearchParams(hash.substring(1));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    if (type === 'recovery' && accessToken) {
      console.log('[recovery] パスワードリセットリンクを検知しました');
      showResetPasswordScreen();
      return true;
    }
  } catch(e) {
    console.warn('[recovery] ハッシュ解析エラー:', e);
  }
  return false;
}

function showResetPasswordScreen() {
  // ログイン画面とメイン画面を非表示にしてリセット画面を表示
  const loginEl = document.getElementById('loginScreen');
  const mainEl = document.getElementById('mainApp');
  const resetEl = document.getElementById('resetPwScreen');
  if (loginEl) loginEl.style.display = 'none';
  if (mainEl) mainEl.style.display = 'none';
  if (resetEl) resetEl.style.display = 'flex';
  // 入力欄をクリア
  const p1 = document.getElementById('resetPw1');
  const p2 = document.getElementById('resetPw2');
  if (p1) p1.value = '';
  if (p2) p2.value = '';
  if (p1) setTimeout(() => p1.focus(), 100);
}

async function doResetPassword() {
  const p1El = document.getElementById('resetPw1');
  const p2El = document.getElementById('resetPw2');
  const errEl = document.getElementById('resetPwErr');
  const okEl = document.getElementById('resetPwOk');
  const btnEl = document.getElementById('resetPwBtn');

  const showErr = (msg) => {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    if (okEl) okEl.style.display = 'none';
  };
  const showOk = (msg) => {
    if (okEl) { okEl.textContent = msg; okEl.style.display = 'block'; }
    if (errEl) errEl.style.display = 'none';
  };

  const p1 = (p1El?.value || '').trim();
  const p2 = (p2El?.value || '').trim();

  if (!p1 || !p2) { showErr('パスワードを2回とも入力してください'); return; }
  if (p1.length < 6) { showErr('パスワードは6文字以上にしてください'); return; }
  if (p1 !== p2) { showErr('パスワードが一致しません。再度入力してください'); return; }

  if (typeof sb === 'undefined' || !sb) {
    showErr('システム初期化エラー。ページを再読み込みしてください');
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '更新中...'; }

  try {
    const { data, error } = await sb.auth.updateUser({ password: p1 });
    if (error) {
      console.error('[recovery] updateUser失敗:', error);
      showErr('パスワード更新に失敗しました: ' + (error.message || '不明なエラー'));
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'パスワードを設定する'; }
      return;
    }
    console.log('[recovery] パスワード更新成功');
    showOk('✓ パスワードを更新しました。ログイン画面に戻ります...');
    // セッション破棄して、ログイン画面に戻る
    setTimeout(async () => {
      try { await sb.auth.signOut(); } catch(e) {}
      // URLハッシュをクリア
      try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e) {}
      // ログイン画面表示
      const loginEl = document.getElementById('loginScreen');
      const resetEl = document.getElementById('resetPwScreen');
      if (resetEl) resetEl.style.display = 'none';
      if (loginEl) loginEl.style.display = 'flex';
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'パスワードを設定する'; }
    }, 1500);
  } catch(e) {
    console.error('[recovery] 例外:', e);
    showErr('予期しないエラー: ' + (e.message || e));
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'パスワードを設定する'; }
  }
}

async function cancelResetPassword() {
  // セッション破棄してログイン画面に戻る
  try { await sb.auth.signOut(); } catch(e) {}
  try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e) {}
  const loginEl = document.getElementById('loginScreen');
  const resetEl = document.getElementById('resetPwScreen');
  if (resetEl) resetEl.style.display = 'none';
  if (loginEl) loginEl.style.display = 'flex';
}

// DOMContentLoaded 時にリカバリーフローをチェック
window.addEventListener('DOMContentLoaded', function() {
  checkPasswordRecoveryFlow();
});

// ========================================
// セッション自動復元（リロード時にログイン画面に戻らないため）
// ========================================
async function tryRestoreSession() {
  if (typeof sb === 'undefined' || !sb) return false;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session || !session.user) {
      console.log('[restoreSession] セッションなし');
      return false;
    }
    const user = session.user;
    console.log('[restoreSession] セッション復元 uid:', user.id);

    // admin判定
    const role = user.app_metadata?.role;
    if (role === 'admin') {
      currentClientId = 'admin';
      currentClientName = '管理者（全社）';
      isAdmin = true;
      await startApp();
      return true;
    }

    // 一般クライアント
    const { data: clientData, error: clientErr } = await sb.from('clients')
      .select('client_id, name')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (clientErr || !clientData) {
      console.warn('[restoreSession] clients取得失敗、ログアウト処理');
      try { await sb.auth.signOut(); } catch(e) {}
      return false;
    }
    currentClientId = clientData.client_id;
    currentClientName = clientData.name;
    isAdmin = false;

    // 担当者：localStorage に保存があれば自動復元、なければ選択画面
    await loadActiveStaffList();
    const savedStaffId = (typeof loadSavedStaffSelection === 'function') ? loadSavedStaffSelection() : null;
    if (savedStaffId) {
      const found = activeStaffList.find(s => String(s.id) === String(savedStaffId));
      if (found) {
        currentStaffId = found.id;
        currentStaffName = found.name;
      }
    }
    if (!currentStaffId && activeStaffList.length > 0) {
      // 担当者選択画面を表示
      if (typeof showStaffSelectScreen === 'function') {
        document.getElementById('loginScreen').style.display = 'none';
        showStaffSelectScreen();
        return true;
      }
    }
    await startApp();
    return true;
  } catch(e) {
    console.warn('[restoreSession] 例外:', e);
    return false;
  }
}

// DOMContentLoaded でセッション復元を試行
window.addEventListener('DOMContentLoaded', function() {
  // パスワードリカバリーフロー中はスキップ
  if (window.location.hash && window.location.hash.includes('type=recovery')) return;
  // 少し遅延させて、他の初期化を先に走らせる
  setTimeout(function() {
    tryRestoreSession();
  }, 50);
});

// グローバル公開
if (typeof window !== 'undefined') {
  window.tryRestoreSession = tryRestoreSession;
}


// ========================================
// グローバル公開（onclick等のインラインハンドラから確実に呼べるようにする）
// ========================================
if (typeof window !== 'undefined') {
  window.doLogin = doLogin;
  // ログアウト系（改修：確認ポップアップ経由）
  window.doLogout = doLogout;
  window.confirmLogout = confirmLogout;
  window.closeLogoutConfirm = closeLogoutConfirm;
  window.onLogoutModalBgClick = onLogoutModalBgClick;
  window.executeLogout = executeLogout;
  // ダッシュボード期間フィルタ
  window.setDashPeriod = setDashPeriod;
  window.addClient = addClient;
  window.deleteClient = deleteClient;
  window.deleteBudget = deleteBudget;
  window.editBudget = editBudget;
  window.renderTaskCalendar = renderTaskCalendar;
  window.clickTaskCalDay = clickTaskCalDay;
  window.afJump = afJump;
  window.setSectionView = setSectionView;
  window.onCompareRowCheck = onCompareRowCheck;
  window.showPickupDetails = showPickupDetails;
  window.showPickupDetailsMulti = showPickupDetailsMulti;
  // パスワードリセット系
  window.doResetPassword = doResetPassword;
  window.cancelResetPassword = cancelResetPassword;
  // クライアント管理: 編集系
  window.editClient = editClient;
  window.saveClientEdit = saveClientEdit;
  window.cancelClientEdit = cancelClientEdit;
  window.togglePwVisible = togglePwVisible;
  window.copyClientPw = copyClientPw;
  // 担当者管理（Phase B-1で追加）
  window.renderStaff = renderStaff;
  window.addStaff = addStaff;
  window.editStaff = editStaff;
  window.saveStaffEdit = saveStaffEdit;
  window.cancelStaffEdit = cancelStaffEdit;
  window.deleteStaff = deleteStaff;
  // 担当者選択画面・ヘッダー切替（Phase B-2で追加）
  window.selectStaff = selectStaff;
  window.continueWithoutStaff = continueWithoutStaff;
  window.cancelStaffSelect = cancelStaffSelect;
  window.switchActiveStaff = switchActiveStaff;
  // 応募者編集画面のタブUI・担当者選択（Phase C-2で追加）
  window.openApplicantEdit = openApplicantEdit;
  window.switchEditTab = switchEditTab;
  window.backToList = backToList;
  window.toggleStaffCheckbox = toggleStaffCheckbox;
  // タイムライン機能（Phase D-1で追加）
  window.toggleAddMemoForm = toggleAddMemoForm;
  window.submitMemo = submitMemo;
  window.editMemoEvent = editMemoEvent;
  window.deleteMemoEvent = deleteMemoEvent;
  window.goNewApplicantForm = goNewApplicantForm;
  // 面接管理（Phase D-2で追加）
  window.toggleInterviewForm = toggleInterviewForm;
  window.onIvTypeChange = onIvTypeChange;
  window.submitInterview = submitInterview;
  window.editInterview = editInterview;
  window.deleteInterview = deleteInterview;
  // ファイル添付（Phase D-3で追加）
  window.onFilePicked = onFilePicked;
  window.onFileDragOver = onFileDragOver;
  window.onFileDragLeave = onFileDragLeave;
  window.onFileDrop = onFileDrop;
  window.downloadFile = downloadFile;
  window.deleteFile = deleteFile;
  // Step 1: モード制御関数のグローバル公開
  window.setMode = setMode;
  window.goHome = goHome;
  window.showUpgradeModal = showUpgradeModal;
  // Step 2: モード選択ホーム関連
  window.showModeHome = showModeHome;
  window.refreshModeHome = refreshModeHome;
  window.enterMode = enterMode;
  // Step 3: 採用運用ダッシュ拡張
  window.onDashMineToggle = onDashMineToggle;
  window.refreshOperationDash = refreshOperationDash;
  // Step 4: 採用分析ダッシュ
  window.renderAnalyticsDash = renderAnalyticsDash;
  window.refreshAnalyticsDash = refreshAnalyticsDash;
  // Step 5: 仕上げ関連
  window.closeUpgradeModal = closeUpgradeModal;
  window.contactForUpgrade = contactForUpgrade;
  window.renderModeQuickStats = renderModeQuickStats;
  window.updateStaffAvatar = updateStaffAvatar;
  // 上記以外の関数は function宣言により既にグローバルだが、
  // 万一のミニファイ等に備えて主要関数も明示しておく
}

// ============================================================================
// 📣 有料広告実績機能（Indeed / AirWORK）- フェーズ1：DB + アップロード管理
// 2026/05/12 追加
// ============================================================================

// --- 状態管理 ---
let adsFiles = [];                  // 現在のクライアントのファイル一覧
let adsPendingUpload = null;        // アップロード待ちのファイル解析結果
let adsPendingDelete = null;        // 削除待ちのファイル情報

// --- サブタブ切替 ---
function adsSwitchSubTab(tab) {
  const a = document.getElementById('adsSubtabAnalytics');
  const u = document.getElementById('adsSubtabUpload');
  const ap = document.getElementById('adsAnalyticsPane');
  const up = document.getElementById('adsUploadPane');
  if (!a || !u || !ap || !up) return;
  if (tab === 'analytics') {
    a.style.background = '#5a8a48'; a.style.color = '#fff';
    u.style.background = '#fff';    u.style.color = '#666';
    ap.style.display = 'block';
    up.style.display = 'none';
    if (typeof adsLoadAnalytics === 'function') adsLoadAnalytics();
  } else {
    a.style.background = '#fff';    a.style.color = '#666';
    u.style.background = '#5a8a48'; u.style.color = '#fff';
    ap.style.display = 'none';
    up.style.display = 'block';
    adsLoadFiles();
  }
}

// --- ファイル一覧読み込み ---
async function adsLoadFiles() {
  if (!sb || !currentClientId) return;
  try {
    let query = sb.from('ad_uploaded_files').select('*').order('uploaded_at', { ascending: false });
    if (!isAdmin) query = query.eq('client_id', currentClientId);
    const { data, error } = await query;
    if (error) {
      console.error('[adsLoadFiles] error', error);
      setStatus('ファイル一覧の読み込みに失敗しました', 'err');
      return;
    }
    adsFiles = data || [];
    adsRenderFileList();
  } catch (e) {
    console.error('[adsLoadFiles] 例外', e);
  }
}

// --- ファイル一覧描画 ---
function adsRenderFileList() {
  const tbody = document.getElementById('adsFileTableBody');
  const empty = document.getElementById('adsFileEmpty');
  const cntEl = document.getElementById('adsFileCount');
  const kpiRow = document.getElementById('adsKpiRow');
  if (!tbody || !empty) return;

  // フィルタ
  const q = (document.getElementById('adsFileSearch')?.value || '').toLowerCase();
  const fMedia = document.getElementById('adsFilterMedia')?.value || '';
  const fStatus = document.getElementById('adsFilterStatus')?.value;
  // ステータスフィルタ：空＝全て、'active'＝activeのみ、'superseded'＝supersededのみ
  const filtered = adsFiles.filter(f => {
    if (q && !(f.file_name || '').toLowerCase().includes(q)) return false;
    if (fMedia && f.media_type !== fMedia) return false;
    if (fStatus === 'active' && f.status !== 'active') return false;
    if (fStatus === 'superseded' && f.status !== 'superseded') return false;
    return true;
  });

  // 件数表示
  if (cntEl) cntEl.textContent = `${filtered.length}件 / 全${adsFiles.length}件`;

  // KPIサマリ計算
  if (kpiRow) {
    const activeFiles = adsFiles.filter(f => f.status === 'active');
    const totalRows = activeFiles.reduce((s, f) => s + (f.row_count || 0), 0);
    const indeedCount = activeFiles.filter(f => f.media_type === 'indeed').length;
    const airworkCount = activeFiles.filter(f => f.media_type === 'airwork').length;
    const supersededCount = adsFiles.filter(f => f.status === 'superseded').length;
    kpiRow.innerHTML = `
      <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:8px;padding:10px 12px;">
        <div style="font-size:10px;color:#888;letter-spacing:.04em;">分析対象ファイル</div>
        <div style="font-size:18px;font-weight:500;color:#1a1a1a;margin-top:1px;">${activeFiles.length}<span style="font-size:10px;color:#888;margin-left:2px;font-weight:400;">件</span></div>
      </div>
      <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:8px;padding:10px 12px;">
        <div style="font-size:10px;color:#888;letter-spacing:.04em;">取込総行数</div>
        <div style="font-size:18px;font-weight:500;color:#1a1a1a;margin-top:1px;">${totalRows.toLocaleString()}<span style="font-size:10px;color:#888;margin-left:2px;font-weight:400;">行</span></div>
      </div>
      <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:8px;padding:10px 12px;">
        <div style="font-size:10px;color:#888;letter-spacing:.04em;">📘 Indeed</div>
        <div style="font-size:18px;font-weight:500;color:#185FA5;margin-top:1px;">${indeedCount}<span style="font-size:10px;color:#888;margin-left:2px;font-weight:400;">件</span></div>
      </div>
      <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:8px;padding:10px 12px;">
        <div style="font-size:10px;color:#888;letter-spacing:.04em;">📙 AirWORK</div>
        <div style="font-size:18px;font-weight:500;color:#BA7517;margin-top:1px;">${airworkCount}<span style="font-size:10px;color:#888;margin-left:2px;font-weight:400;">件</span></div>
      </div>
      <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:8px;padding:10px 12px;">
        <div style="font-size:10px;color:#888;letter-spacing:.04em;">旧版（自動置換済）</div>
        <div style="font-size:18px;font-weight:500;color:#888;margin-top:1px;">${supersededCount}<span style="font-size:10px;color:#888;margin-left:2px;font-weight:400;">件</span></div>
      </div>
    `;
  }

  // テーブル行描画
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(f => {
    const mediaBadge = f.media_type === 'indeed'
      ? '<span style="background:#e6f1fb;color:#185FA5;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;">📘 Indeed</span>'
      : '<span style="background:#fef7e9;color:#BA7517;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;">📙 AirWORK</span>';
    let statusBadge, rowStyle = '';
    if (f.status === 'active') {
      statusBadge = '<span style="background:#eaf3de;color:#3B6D11;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;">✓ 分析対象</span>';
    } else if (f.status === 'superseded') {
      statusBadge = '<span style="background:#f5f5f3;color:#888;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;">旧版（置換済）</span>';
      rowStyle = 'opacity:.65;';
    } else if (f.status === 'processing') {
      statusBadge = '<span style="background:#faeeda;color:#854F0B;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;">⏳ 処理中</span>';
    } else if (f.status === 'failed') {
      statusBadge = '<span style="background:#fdf2ee;color:#D85A30;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;">⛔ 失敗</span>';
    } else {
      statusBadge = `<span style="background:#f5f5f3;color:#888;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;">${f.status}</span>`;
    }
    const uploadedAt = f.uploaded_at ? new Date(f.uploaded_at).toLocaleString('ja-JP', { year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const period = `${f.date_range_start} 〜 ${f.date_range_end}`;
    return `<tr style="border-bottom:0.5px solid #f0f0ee;${rowStyle}">
      <td style="padding:9px 8px;color:#1a1a1a;font-family:ui-monospace,monospace;font-size:10.5px;">${escapeHtml(f.file_name)}</td>
      <td style="padding:9px 8px;">${mediaBadge}</td>
      <td style="padding:9px 8px;color:#555;">${period}</td>
      <td style="padding:9px 8px;text-align:right;color:#1a1a1a;font-weight:500;">${(f.row_count || 0).toLocaleString()}</td>
      <td style="padding:9px 8px;">${statusBadge}</td>
      <td style="padding:9px 8px;color:#666;">${uploadedAt}</td>
      <td style="padding:9px 8px;color:#666;">${escapeHtml(f.uploaded_by_name || f.uploaded_by || '—')}</td>
      <td style="padding:9px 8px;text-align:center;">
        <button onclick="adsOpenDeleteModal('${f.file_id}')" style="background:none;border:none;color:#D85A30;cursor:pointer;font-size:11px;font-family:inherit;padding:2px 6px;">削除</button>
      </td>
    </tr>`;
  }).join('');
}

// --- アップロードモーダルの開閉 ---
function adsOpenUploadModal() {
  const modal = document.getElementById('adsUploadModal');
  if (!modal) return;
  modal.style.display = 'flex';
  // リセット
  adsPendingUpload = null;
  document.getElementById('adsFileInput').value = '';
  document.getElementById('adsPreviewArea').style.display = 'none';
  document.getElementById('adsSupersedeWarning').style.display = 'none';
  document.getElementById('adsDuplicateError').style.display = 'none';
  document.getElementById('adsParseError').style.display = 'none';
  const btn = document.getElementById('adsUploadConfirmBtn');
  btn.disabled = true; btn.style.opacity = '.4';
}
function adsCloseUploadModal() {
  document.getElementById('adsUploadModal').style.display = 'none';
  adsPendingUpload = null;
}
function adsCloseUploadModalBg(e) {
  if (e && e.target && e.target.id === 'adsUploadModal') adsCloseUploadModal();
}

// --- ファイル名からの媒体・期間自動判定 ---
function adsDetectMediaFromFileName(fileName) {
  if (!fileName) return null;
  // Indeed: JobsCampaigns_YYYYMMDD_YYYYMMDD*.csv
  if (/^JobsCampaigns_\d{8}_\d{8}/i.test(fileName)) return 'indeed';
  // AirWORK: all_Job_*_YYYYMMDD-YYYYMMDD_*.csv
  if (/^all_Job_/i.test(fileName)) return 'airwork';
  return null;
}

function adsExtractPeriodFromFileName(fileName, mediaType) {
  if (!fileName) return null;
  let m;
  if (mediaType === 'indeed') {
    m = fileName.match(/^JobsCampaigns_(\d{4})(\d{2})(\d{2})_(\d{4})(\d{2})(\d{2})/i);
    if (m) return {
      start: `${m[1]}-${m[2]}-${m[3]}`,
      end:   `${m[4]}-${m[5]}-${m[6]}`,
    };
  } else if (mediaType === 'airwork') {
    m = fileName.match(/_(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})_/i);
    if (m) return {
      start: `${m[1]}-${m[2]}-${m[3]}`,
      end:   `${m[4]}-${m[5]}-${m[6]}`,
    };
  }
  return null;
}

// --- SHA-256 ハッシュ計算 ---
async function adsCalcFileHash(arrayBuffer) {
  const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// --- CSVテキストを行に分解（BOM除去・改行対応） ---
function adsParseCsvText(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
  const lines = text.split(/\r\n|\r|\n/).filter(l => l.length > 0);
  return lines.map(line => adsSplitCsvLine(line));
}
function adsSplitCsvLine(line) {
  const out = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// --- ファイル選択ハンドラ ---
async function adsHandleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // UIリセット
  document.getElementById('adsPreviewArea').style.display = 'block';
  document.getElementById('adsSupersedeWarning').style.display = 'none';
  document.getElementById('adsDuplicateError').style.display = 'none';
  document.getElementById('adsParseError').style.display = 'none';
  const btn = document.getElementById('adsUploadConfirmBtn');
  btn.disabled = true; btn.style.opacity = '.4';

  // 媒体判定
  const mediaType = adsDetectMediaFromFileName(file.name);
  if (!mediaType) {
    adsShowParseError('対応していないファイル名形式です。<br>Indeed の場合：<code>JobsCampaigns_YYYYMMDD_YYYYMMDD....csv</code><br>AirWORK の場合：<code>all_Job_....csv</code> をそのままアップロードしてください。');
    return;
  }

  // 期間抽出
  const period = adsExtractPeriodFromFileName(file.name, mediaType);
  if (!period) {
    adsShowParseError('ファイル名から期間を抽出できませんでした。<br>ファイル名はリネームせず、そのままアップロードしてください。');
    return;
  }

  // ファイル読み込み＆ハッシュ計算
  try {
    const arrBuf = await file.arrayBuffer();
    const fileHash = await adsCalcFileHash(arrBuf);
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(arrBuf);

    // CSVパース
    const allLines = adsParseCsvText(text);
    if (allLines.length < 2) {
      adsShowParseError('CSVにデータがありません（ヘッダー行のみ、またはからのファイルです）。');
      return;
    }
    const headers = allLines[0];
    const dataLines = allLines.slice(1).filter(line => line.length >= 3 && line.some(c => c && c.length > 0));

    // 媒体ごとの必須カラム検証
    const requiredIndeed = ['求人', '表示回数', 'クリック数', '応募開始数', '応募数', '費用', 'キャンペーン'];
    const requiredAirwork = ['求人タイトル', '表示回数', 'クリック数', '応募開始数', '応募数', '利用金額', 'キャンペーン'];
    const required = mediaType === 'indeed' ? requiredIndeed : requiredAirwork;
    const missing = required.filter(c => !headers.includes(c));
    if (missing.length > 0) {
      adsShowParseError(`必須カラムが見つかりません：<strong>${missing.join(', ')}</strong><br>媒体の管理画面から正しい形式でエクスポートしてください。`);
      return;
    }

    // キャンペーン一覧抽出（プレビュー用）
    const campaignCol = headers.indexOf('キャンペーン');
    const campaignSet = new Set();
    dataLines.forEach(row => {
      const cp = (row[campaignCol] || '').trim();
      if (cp && cp !== '-') campaignSet.add(cp);
    });
    const campaigns = Array.from(campaignSet);

    // 重複チェック（同じハッシュのアクティブファイルが既に存在するか）
    const dup = adsFiles.find(f => f.file_hash === fileHash && (f.status === 'active' || f.status === 'superseded'));
    if (dup) {
      document.getElementById('adsDuplicateMsg').textContent = `「${dup.file_name}」と完全に同じ内容です。重複登録はできません。`;
      document.getElementById('adsDuplicateError').style.display = 'block';
      // プレビューだけは見せる
      adsFillPreview(file.name, mediaType, period, dataLines.length, campaigns);
      return;
    }

    // 同月内既存ファイル検出（同media_typeで月が重なる活性ファイル）
    const monthKey = period.start.slice(0, 7);  // YYYY-MM
    const sameMedia = adsFiles.filter(f =>
      f.media_type === mediaType && f.status === 'active'
    );
    // 同月のファイル：開始日のYYYY-MMが一致するもの
    const sameMonth = sameMedia.filter(f => (f.date_range_start || '').slice(0,7) === monthKey);

    let supersedeAction = null; // 'will_become_active' or 'will_become_superseded'
    if (sameMonth.length > 0) {
      // 期間の長さ比較
      const newDays = (new Date(period.end) - new Date(period.start)) / 86400000 + 1;
      const others = sameMonth.map(f => ({
        ...f,
        days: (new Date(f.date_range_end) - new Date(f.date_range_start)) / 86400000 + 1
      }));
      const maxOther = Math.max(...others.map(x => x.days));
      if (newDays > maxOther) {
        // 新ファイルがactiveに、既存をsupersededに
        supersedeAction = 'become_active';
        document.getElementById('adsSupersedeMsg').innerHTML =
          `${monthKey}の既存ファイル <strong>${others.length}件</strong>（期間最長 ${maxOther}日分）は「旧版」扱いになり、今回アップロードする${newDays}日分のファイルが分析対象になります。`;
      } else if (newDays < maxOther) {
        supersedeAction = 'become_superseded';
        document.getElementById('adsSupersedeMsg').innerHTML =
          `${monthKey}には既により長い期間（${maxOther}日分）のファイルが登録されています。今回のファイル（${newDays}日分）は「旧版」として保管されます。`;
      } else {
        // 期間同じ → 既存をsuperseded、新ファイルがactive（より新しいので）
        supersedeAction = 'become_active';
        document.getElementById('adsSupersedeMsg').innerHTML =
          `${monthKey}には同じ期間のファイルが既に登録されています。既存ファイル <strong>${others.length}件</strong>は「旧版」になり、今回のファイルが最新の分析対象になります。`;
      }
      document.getElementById('adsSupersedeWarning').style.display = 'block';
    }

    // プレビュー表示
    adsFillPreview(file.name, mediaType, period, dataLines.length, campaigns);

    // アップロード待ち情報を保存
    adsPendingUpload = {
      file,
      fileName: file.name,
      fileHash,
      mediaType,
      period,
      headers,
      dataLines,
      rowCount: dataLines.length,
      campaigns,
      supersedeAction,
      sameMonthFiles: sameMonth,
    };

    // 取り込みボタン有効化
    btn.disabled = false; btn.style.opacity = '1';

  } catch (err) {
    console.error('[adsHandleFileSelect] エラー', err);
    adsShowParseError('ファイルの読み込み中にエラーが発生しました：' + (err.message || err));
  }
}

function adsShowParseError(html) {
  document.getElementById('adsParseErrorMsg').innerHTML = html;
  document.getElementById('adsParseError').style.display = 'block';
}

function adsFillPreview(fileName, mediaType, period, rowCount, campaigns) {
  document.getElementById('adsPvFileName').textContent = fileName;
  document.getElementById('adsPvMedia').textContent = mediaType === 'indeed' ? '📘 Indeed' : '📙 AirWORK';
  document.getElementById('adsPvPeriod').textContent = `${period.start} 〜 ${period.end}`;
  document.getElementById('adsPvRows').textContent = `${rowCount.toLocaleString()} 件`;
  document.getElementById('adsPvCampaigns').innerHTML = campaigns.length > 0
    ? `<span style="display:inline-block;background:#f4f8f1;color:#3B6D11;padding:1px 6px;border-radius:8px;font-size:10px;margin-right:4px;">${escapeHtml(campaigns.slice(0,3).join(' / '))}${campaigns.length > 3 ? ` 他${campaigns.length-3}件` : ''}</span>`
    : '<span style="color:#888;">なし</span>';
}

// --- 数値変換ヘルパー（"¥1,234" や "%" や "-" 対応） ---
function adsToNum(v, isPercent) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s === 'N/A' || s === '∞%' || s === '∞') return null;
  // ¥記号・カンマ・%を除去
  const cleaned = s.replace(/[¥$,]/g, '').replace(/%$/, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  // CSVが既に小数表現なら%変換不要（このCSVは小数表現）
  return n;
}

// --- 取り込み実行 ---
async function adsConfirmUpload() {
  if (!adsPendingUpload || !sb || !currentClientId) return;
  const btn = document.getElementById('adsUploadConfirmBtn');
  btn.disabled = true; btn.style.opacity = '.6'; btn.textContent = '取り込み中...';

  try {
    const p = adsPendingUpload;

    // 1. uploaded_files に1行 INSERT（status='processing'）
    const uploadedByName = currentStaffName || (isAdmin ? '管理者' : '');
    const uploadedBy = isAdmin ? 'admin' : (currentStaffId ? String(currentStaffId) : '');
    const { data: fileRow, error: fileErr } = await sb.from('ad_uploaded_files').insert({
      client_id: currentClientId,
      media_type: p.mediaType,
      file_name: p.fileName,
      file_hash: p.fileHash,
      date_range_start: p.period.start,
      date_range_end: p.period.end,
      row_count: p.rowCount,
      status: 'processing',
      uploaded_by: uploadedBy,
      uploaded_by_name: uploadedByName,
    }).select().single();

    if (fileErr) {
      console.error('[adsConfirmUpload] ファイル登録エラー', fileErr);
      setStatus('ファイル登録に失敗しました：' + fileErr.message, 'err');
      btn.disabled = false; btn.style.opacity = '1'; btn.textContent = '取り込む';
      return;
    }

    const fileId = fileRow.file_id;

    // 2. CSV行をperformance_rowsに一括INSERT
    const rowsToInsert = p.dataLines.map(line => adsMapCsvRowToDb(p.headers, line, p.mediaType, fileId, currentClientId));
    // バッチに分割（Supabaseは1回1000行まで推奨）
    const BATCH = 500;
    for (let i = 0; i < rowsToInsert.length; i += BATCH) {
      const chunk = rowsToInsert.slice(i, i + BATCH);
      const { error: insErr } = await sb.from('ad_performance_rows').insert(chunk);
      if (insErr) {
        console.error('[adsConfirmUpload] データ行登録エラー', insErr, 'chunk', i);
        // ファイルレコードのstatusをfailedに更新
        await sb.from('ad_uploaded_files').update({ status: 'failed', error_message: insErr.message }).eq('file_id', fileId);
        setStatus('データ行の取り込みに失敗しました：' + insErr.message, 'err');
        btn.disabled = false; btn.style.opacity = '1'; btn.textContent = '取り込む';
        return;
      }
    }

    // 3. 同月内置換ロジック
    let newStatus = 'active';
    if (p.supersedeAction === 'become_superseded') {
      // 自分はsupersededに、既存はactiveのまま
      newStatus = 'superseded';
    } else if (p.supersedeAction === 'become_active') {
      // 自分がactiveに、既存をsupersededに
      const oldIds = p.sameMonthFiles.map(f => f.file_id);
      if (oldIds.length > 0) {
        await sb.from('ad_uploaded_files').update({ status: 'superseded' }).in('file_id', oldIds);
      }
    }
    await sb.from('ad_uploaded_files').update({ status: newStatus }).eq('file_id', fileId);

    setStatus(`✓ ${p.fileName} を取り込みました（${p.rowCount.toLocaleString()}件）`, 'ok');
    adsCloseUploadModal();
    await adsLoadFiles();

  } catch (err) {
    console.error('[adsConfirmUpload] 例外', err);
    setStatus('取り込み中にエラー：' + (err.message || err), 'err');
    btn.disabled = false; btn.style.opacity = '1'; btn.textContent = '取り込む';
  }
}

// --- CSV行をDBレコードにマッピング ---
function adsMapCsvRowToDb(headers, row, mediaType, fileId, clientId) {
  // 列名→indexの逆引き
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  const get = (col) => idx[col] !== undefined ? row[idx[col]] : null;

  const base = {
    file_id: fileId,
    client_id: clientId,
    media_type: mediaType,
    country: get('国'),
    prefecture: get('都道府県'),
    city: get('市区町村'),
    company: get('企業名'),
    reference_no: get('参照番号'),
    job_status: get('求人のステータス'),
    campaign: get('キャンペーン'),
    source_site: get('掲載元サイト'),
    url: get('求人URL'),
    imp: adsToNum(get('表示回数')) || 0,
    click: adsToNum(get('クリック数')) || 0,
    apply_start: adsToNum(get('応募開始数')) || 0,
    apply: adsToNum(get('応募数')) || 0,
    cpc: adsToNum(get('クリック単価（CPC）')),
    cpas: adsToNum(get('応募開始単価（CPAS）')),
    cpa: adsToNum(get('応募単価（CPA）')),
    ctr: adsToNum(get('クリック率（CTR）')),
    ar: adsToNum(get('応募率 (AR)')),
  };

  if (mediaType === 'indeed') {
    // Indeed固有
    base.job_title = get('求人');
    base.cost = adsToNum(get('費用')) || 0;
    base.category = get('カテゴリー');
    base.posted_at = adsParseDate(get('作成日'));
    base.updated_at_external = adsParseDate(get('最終更新日'));
    base.asr = adsToNum(get('応募開始率 (ASR)'));
    base.completion_rate = adsToNum(get('応募完了率'));
  } else {
    // AirWORK固有
    base.job_title = get('求人タイトル');
    base.cost = adsToNum(get('利用金額')) || 0;
    base.employment_type = get('雇用形態');
    base.posted_at = adsParseDate(get('初回掲載日時'));
    base.updated_at_external = adsParseDate(get('最終更新日'));
    base.asr = adsToNum(get('応募開始率（ASR）'));
    base.completion_rate = adsToNum(get('応募完了率（ACR）'));
  }

  return base;
}

// 日付文字列を YYYY-MM-DD に正規化
function adsParseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return null;
}

// --- 削除モーダル ---
function adsOpenDeleteModal(fileId) {
  const f = adsFiles.find(x => x.file_id === fileId);
  if (!f) return;
  adsPendingDelete = f;
  document.getElementById('adsDelFileName').textContent = f.file_name || '';
  document.getElementById('adsDelMedia').textContent = f.media_type === 'indeed' ? '📘 Indeed' : '📙 AirWORK';
  document.getElementById('adsDelPeriod').textContent = `${f.date_range_start} 〜 ${f.date_range_end}`;
  document.getElementById('adsDelRowCount').textContent = (f.row_count || 0).toLocaleString();
  document.getElementById('adsDelRowCountText').textContent = (f.row_count || 0).toLocaleString() + ' 件';
  document.getElementById('adsDeleteModal').style.display = 'flex';
}
function adsCloseDeleteModal() {
  document.getElementById('adsDeleteModal').style.display = 'none';
  adsPendingDelete = null;
}
function adsCloseDeleteModalBg(e) {
  if (e && e.target && e.target.id === 'adsDeleteModal') adsCloseDeleteModal();
}

async function adsExecuteDelete() {
  if (!adsPendingDelete || !sb) return;
  const btn = document.getElementById('adsExecDelBtn');
  btn.disabled = true; btn.textContent = '削除中...';

  try {
    const fileId = adsPendingDelete.file_id;
    const wasActive = adsPendingDelete.status === 'active';
    const sameMediaSameMonth = adsFiles.filter(f =>
      f.media_type === adsPendingDelete.media_type
      && (f.date_range_start || '').slice(0,7) === (adsPendingDelete.date_range_start || '').slice(0,7)
      && f.file_id !== fileId
    );

    // 物理削除（ON DELETE CASCADE で performance_rows も削除される）
    const { error } = await sb.from('ad_uploaded_files').delete().eq('file_id', fileId);
    if (error) {
      console.error('[adsExecuteDelete] エラー', error);
      setStatus('削除に失敗しました：' + error.message, 'err');
      btn.disabled = false; btn.textContent = '削除する';
      return;
    }

    // 削除したのが「active」で、同月にsupersededファイルがある場合、最長期間のものをactiveに昇格
    if (wasActive && sameMediaSameMonth.length > 0) {
      const supersededInMonth = sameMediaSameMonth.filter(f => f.status === 'superseded');
      if (supersededInMonth.length > 0) {
        // 期間最長のものを選ぶ
        const sorted = supersededInMonth
          .map(f => ({ ...f, days: (new Date(f.date_range_end) - new Date(f.date_range_start)) / 86400000 + 1 }))
          .sort((a, b) => b.days - a.days);
        const promote = sorted[0];
        await sb.from('ad_uploaded_files').update({ status: 'active' }).eq('file_id', promote.file_id);
      }
    }

    setStatus(`✓ ${adsPendingDelete.file_name} を削除しました`, 'ok');
    adsCloseDeleteModal();
    await adsLoadFiles();
  } catch (err) {
    console.error('[adsExecuteDelete] 例外', err);
    setStatus('削除中にエラー：' + (err.message || err), 'err');
    btn.disabled = false; btn.textContent = '削除する';
  }
}

// --- ドラッグ&ドロップ対応 ---
(function attachAdsDragDrop(){
  document.addEventListener('DOMContentLoaded', function() {
    const zone = document.getElementById('adsDropZone');
    if (!zone) return;
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.style.borderColor = '#5a8a48';
      zone.style.background = '#f4f8f1';
    });
    zone.addEventListener('dragleave', e => {
      zone.style.borderColor = '#d6dbd2';
      zone.style.background = '#fafbf8';
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.borderColor = '#d6dbd2';
      zone.style.background = '#fafbf8';
      const file = e.dataTransfer.files[0];
      if (!file) return;
      // ファイルをinputにセットしてhandleを発動
      const inp = document.getElementById('adsFileInput');
      const dt = new DataTransfer();
      dt.items.add(file);
      inp.files = dt.files;
      adsHandleFileSelect({ target: inp });
    });
  });
})();

// グローバル公開
if (typeof window !== 'undefined') {
  window.adsSwitchSubTab = adsSwitchSubTab;
  window.adsLoadFiles = adsLoadFiles;
  window.adsRenderFileList = adsRenderFileList;
  window.adsOpenUploadModal = adsOpenUploadModal;
  window.adsCloseUploadModal = adsCloseUploadModal;
  window.adsCloseUploadModalBg = adsCloseUploadModalBg;
  window.adsHandleFileSelect = adsHandleFileSelect;
  window.adsConfirmUpload = adsConfirmUpload;
  window.adsOpenDeleteModal = adsOpenDeleteModal;
  window.adsCloseDeleteModal = adsCloseDeleteModal;
  window.adsCloseDeleteModalBg = adsCloseDeleteModalBg;
  window.adsExecuteDelete = adsExecuteDelete;
}

// ============================================================================
// 📊 フェーズ2：分析画面 - パート1（媒体タブ・期間切替・KPI・ファネル）
// 2026/05/12 追加
// ============================================================================

// --- 分析画面の状態 ---
let adsRows = [];                    // 現在ロード中の実績行（active のみ）
let adsActiveMedia = 'all';          // 現在選択中の媒体（'all' / 'indeed' / 'airwork'）
let adsPeriodMode = 'prev_month';    // 'prev_month' / 'single' / 'range' / 'compare'
let adsAvailableMedias = [];         // 利用可能な媒体（['indeed','airwork'] など）

// サブタブ切替時、分析タブ選択時に呼ばれる
async function adsLoadAnalytics() {
  if (!sb || !currentClientId) return;
  // active ファイルのみ取得
  let q = sb.from('ad_uploaded_files').select('file_id, media_type, date_range_start, date_range_end').eq('status', 'active');
  if (!isAdmin) q = q.eq('client_id', currentClientId);
  const { data: files, error: e1 } = await q;
  if (e1) { console.error('[adsLoadAnalytics]', e1); return; }

  if (!files || files.length === 0) {
    document.getElementById('adsAnalyticsEmpty').style.display = 'block';
    document.getElementById('adsAnalyticsContent').style.display = 'none';
    return;
  }
  document.getElementById('adsAnalyticsEmpty').style.display = 'none';
  document.getElementById('adsAnalyticsContent').style.display = 'block';

  // 利用可能な媒体を判定
  const medias = Array.from(new Set(files.map(f => f.media_type)));
  adsAvailableMedias = medias;

  // 実績行をまとめて取得（Supabaseのデフォルト1000件上限を回避するためページング）
  const fileIds = files.map(f => f.file_id);
  let rows = [];
  const PAGE = 1000;
  let from = 0;
  // 安全のため最大50ページ（5万件）まで取得
  for (let i = 0; i < 50; i++) {
    const { data: chunk, error: e2 } = await sb
      .from('ad_performance_rows')
      .select('*')
      .in('file_id', fileIds)
      .range(from, from + PAGE - 1);
    if (e2) { console.error('[adsLoadAnalytics rows]', e2); break; }
    if (!chunk || chunk.length === 0) break;
    rows = rows.concat(chunk);
    if (chunk.length < PAGE) break;  // 最終ページ
    from += PAGE;
  }
  console.log('[adsLoadAnalytics] 取得した行数:', rows.length);

  // ファイル情報を行に注入（期間情報）
  const fileMap = {};
  files.forEach(f => { fileMap[f.file_id] = f; });
  adsRows = (rows || []).map(r => ({
    ...r,
    _date_range_start: fileMap[r.file_id]?.date_range_start,
    _date_range_end:   fileMap[r.file_id]?.date_range_end,
    _month: (fileMap[r.file_id]?.date_range_start || '').slice(0,7),  // YYYY-MM
  }));

  // メディアタブを構築
  adsBuildMediaTabs();
  // 期間モード初期化
  adsApplyDefaultPeriod();
  // キャンペーンフィルタ更新
  adsUpdateCampaignFilter();
  // 描画
  adsRefreshAnalytics();
}

// 媒体タブの構築（クライアントが使用してる媒体だけ表示）
function adsBuildMediaTabs() {
  const wrap = document.getElementById('adsMediaTabs');
  if (!wrap) return;
  const tabs = [];
  const hasIndeed = adsAvailableMedias.includes('indeed');
  const hasAirwork = adsAvailableMedias.includes('airwork');
  if (hasIndeed && hasAirwork) {
    tabs.push({ key: 'all', label: '📊 全媒体合算', color: '#5a8a48' });
  }
  if (hasIndeed) tabs.push({ key: 'indeed', label: '📘 Indeed', color: '#185FA5' });
  if (hasAirwork) tabs.push({ key: 'airwork', label: '📙 AirWORK', color: '#BA7517' });

  // 現在の選択がリストに無ければ最初のものに
  if (!tabs.find(t => t.key === adsActiveMedia)) {
    adsActiveMedia = tabs[0]?.key || 'all';
  }

  wrap.innerHTML = tabs.map(t => {
    const active = t.key === adsActiveMedia;
    return `<button onclick="adsSetMedia('${t.key}')" style="padding:8px 16px;border:1.5px solid ${active ? t.color : '#e3e3e0'};background:${active ? t.color : '#fff'};color:${active ? '#fff' : '#666'};border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;letter-spacing:.04em;">${t.label}</button>`;
  }).join('');
}

function adsSetMedia(m) {
  adsActiveMedia = m;
  adsBuildMediaTabs();
  adsUpdateCampaignFilter();
  adsRefreshAnalytics();
}

// 期間モード設定
function adsSetPeriodMode(mode) {
  adsPeriodMode = mode;
  // ボタン見た目
  document.querySelectorAll('.ads-period-btn').forEach(b => {
    if (b.dataset.period === mode) {
      b.style.background = '#5a8a48'; b.style.color = '#fff'; b.style.fontWeight = '500';
    } else {
      b.style.background = 'transparent'; b.style.color = '#666'; b.style.fontWeight = '400';
    }
  });
  // パネル切替
  document.getElementById('adsPeriodSingle').style.display = mode === 'single' ? 'flex' : 'none';
  document.getElementById('adsPeriodRange').style.display = mode === 'range' ? 'flex' : 'none';
  document.getElementById('adsPeriodCompare').style.display = mode === 'compare' ? 'flex' : 'none';

  // モード切替時の初期値設定
  if (mode === 'single') {
    const sel = document.getElementById('adsSingleMonth');
    if (!sel.value) {
      const latest = adsGetLatestMonth();
      if (latest) sel.value = latest;
    }
  } else if (mode === 'range') {
    const f = document.getElementById('adsRangeFrom');
    const t = document.getElementById('adsRangeTo');
    if (!f.value || !t.value) {
      const months = adsGetAvailableMonths();
      if (months.length > 0) { f.value = months[0]; t.value = months[months.length - 1]; }
    }
  } else if (mode === 'compare') {
    const a = document.getElementById('adsCompareA');
    const b = document.getElementById('adsCompareB');
    if (!a.value || !b.value) {
      const latest = adsGetLatestMonth();
      const prev = adsGetPreviousMonth(latest);
      if (latest) a.value = latest;
      if (prev) b.value = prev;
    }
  }
  adsRefreshAnalytics();
}

function adsApplyDefaultPeriod() {
  // 初期は「前月」モード
  adsSetPeriodMode(adsPeriodMode);
}

// データから利用可能な月一覧を取得（昇順）
function adsGetAvailableMonths() {
  const set = new Set(adsRows.map(r => r._month).filter(Boolean));
  return Array.from(set).sort();
}
function adsGetLatestMonth() {
  const ms = adsGetAvailableMonths();
  return ms[ms.length - 1] || null;
}
function adsGetPreviousMonth(m) {
  if (!m) return null;
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);  // 1月前
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
}

// キャンペーンフィルタの選択肢を更新
function adsUpdateCampaignFilter() {
  const sel = document.getElementById('adsCampaignFilter');
  if (!sel) return;
  const cur = sel.value;
  const filtered = adsRows.filter(r => adsActiveMedia === 'all' || r.media_type === adsActiveMedia);
  const set = new Set(filtered.map(r => r.campaign).filter(c => c && c !== '-'));
  const opts = ['<option value="">キャンペーン：全て</option>']
    .concat(Array.from(set).sort().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`));
  sel.innerHTML = opts.join('');
  if (cur && Array.from(set).includes(cur)) sel.value = cur;
}

// 期間に応じて行をフィルタ
function adsFilterRowsByPeriod() {
  // 媒体・キャンペーンでまずフィルタ
  const cp = document.getElementById('adsCampaignFilter')?.value || '';
  let rows = adsRows.filter(r => {
    if (adsActiveMedia !== 'all' && r.media_type !== adsActiveMedia) return false;
    if (cp && r.campaign !== cp) return false;
    return true;
  });

  // 期間でフィルタ
  if (adsPeriodMode === 'prev_month') {
    // 利用可能月のうち最新の1つ前
    const ms = adsGetAvailableMonths();
    let target = null;
    if (ms.length >= 2) target = ms[ms.length - 2];
    else if (ms.length === 1) target = ms[0];   // 1月分しかなければそれを使う
    if (!target) return { rows: [], periodLabel: 'データなし' };
    const r2 = rows.filter(r => r._month === target);
    return { rows: r2, periodLabel: `${target.replace('-','年')}月`, compareWith: null };
  }
  if (adsPeriodMode === 'single') {
    const m = document.getElementById('adsSingleMonth')?.value;
    if (!m) return { rows, periodLabel: '全期間' };
    const r2 = rows.filter(r => r._month === m);
    return { rows: r2, periodLabel: `${m.replace('-','年')}月` };
  }
  if (adsPeriodMode === 'range') {
    const f = document.getElementById('adsRangeFrom')?.value;
    const t = document.getElementById('adsRangeTo')?.value;
    if (!f || !t) return { rows, periodLabel: '全期間' };
    const r2 = rows.filter(r => r._month >= f && r._month <= t);
    return { rows: r2, periodLabel: `${f.replace('-','/')} 〜 ${t.replace('-','/')}` };
  }
  if (adsPeriodMode === 'compare') {
    const a = document.getElementById('adsCompareA')?.value;
    const b = document.getElementById('adsCompareB')?.value;
    if (!a || !b) return { rows, periodLabel: '比較期間未指定' };
    const rowsA = rows.filter(r => r._month === a);
    const rowsB = rows.filter(r => r._month === b);
    return {
      rows: rowsA,
      compareRows: rowsB,
      periodLabel: `${a.replace('-','/')} vs ${b.replace('-','/')}`,
      compareWith: b
    };
  }
  return { rows, periodLabel: '全期間' };
}

// 行配列から指標を集計
function adsAggregate(rows) {
  const t = {
    imp: 0, click: 0, apply_start: 0, apply: 0, cost: 0,
    rowCount: rows.length,
  };
  rows.forEach(r => {
    t.imp += r.imp || 0;
    t.click += r.click || 0;
    t.apply_start += r.apply_start || 0;
    t.apply += r.apply || 0;
    t.cost += Number(r.cost) || 0;
  });
  t.ctr = t.imp > 0 ? t.click / t.imp : 0;
  t.cpc = t.click > 0 ? t.cost / t.click : 0;
  t.asr = t.click > 0 ? t.apply_start / t.click : 0;
  t.completion_rate = t.apply_start > 0 ? t.apply / t.apply_start : 0;
  t.cpa = t.apply > 0 ? t.cost / t.apply : 0;
  t.cpas = t.apply_start > 0 ? t.cost / t.apply_start : 0;
  return t;
}

// 分析画面の全描画
function adsRefreshAnalytics() {
  if (!document.getElementById('adsAnalyticsContent')) return;
  const result = adsFilterRowsByPeriod();
  const main = adsAggregate(result.rows);
  const compare = result.compareRows ? adsAggregate(result.compareRows) : null;

  // 期間情報
  const periodInfo = document.getElementById('adsPeriodInfo');
  if (periodInfo) periodInfo.textContent = `${result.periodLabel} ／ 対象求人 ${main.rowCount.toLocaleString()}件`;

  // KPI描画
  adsRenderKpiMain(main, compare);
  adsRenderKpiSub(main, compare);
  // ファネル描画
  adsRenderFunnel(main);
}

// メインKPI 5枚
function adsRenderKpiMain(t, compare) {
  const el = document.getElementById('adsKpiMain');
  if (!el) return;
  const items = [
    { label: '表示回数', value: t.imp.toLocaleString(), key: 'imp' },
    { label: 'クリック数', value: t.click.toLocaleString(), key: 'click' },
    { label: '応募開始数', value: t.apply_start.toLocaleString(), key: 'apply_start' },
    { label: '応募完了数', value: t.apply.toLocaleString(), key: 'apply', emphasis: true },
    { label: '費用', value: '¥' + Math.round(t.cost).toLocaleString(), key: 'cost' },
  ];
  el.innerHTML = items.map(it => {
    let diff = '';
    if (compare) {
      const prev = compare[it.key] || 0;
      const cur = t[it.key] || 0;
      if (prev > 0) {
        const pct = ((cur - prev) / prev) * 100;
        const isUp = pct >= 0;
        // 費用だけは増加が悪いのでロジック反転（or 単純に差分表示でもいい）
        const color = isUp ? '#3B6D11' : '#D85A30';
        const arrow = isUp ? '▲' : '▼';
        diff = `<div style="font-size:9px;color:${color};margin-top:2px;">${arrow} ${Math.abs(pct).toFixed(1)}%</div>`;
      } else if (cur > 0) {
        diff = `<div style="font-size:9px;color:#3B6D11;margin-top:2px;">新規発生</div>`;
      }
    }
    const emphasisColor = it.emphasis ? '#5a8a48' : '#1a1a1a';
    return `<div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:10px;padding:11px 13px;">
      <div style="font-size:10px;color:#888;letter-spacing:.04em;">${it.label}</div>
      <div style="font-size:20px;font-weight:500;color:${emphasisColor};margin-top:1px;">${it.value}</div>
      ${diff}
    </div>`;
  }).join('');
}

// サブ指標 4枚
function adsRenderKpiSub(t, compare) {
  const el = document.getElementById('adsKpiSub');
  if (!el) return;
  const items = [
    { label: 'CTR（クリック率）', value: (t.ctr * 100).toFixed(2) + '%' },
    { label: 'CPC（クリック単価）', value: '¥' + Math.round(t.cpc).toLocaleString() },
    { label: 'CPA（応募単価）', value: t.apply > 0 ? '¥' + Math.round(t.cpa).toLocaleString() : '—' },
    { label: '応募完了率', value: (t.completion_rate * 100).toFixed(1) + '%' },
  ];
  el.innerHTML = items.map(it => `
    <div style="background:#fafafa;border:0.5px solid #e8ebe9;border-radius:8px;padding:9px 12px;">
      <div style="font-size:9px;color:#888;letter-spacing:.04em;">${it.label}</div>
      <div style="font-size:15px;font-weight:500;color:#1a1a1a;">${it.value}</div>
    </div>
  `).join('');
}

// 応募ファネル
function adsRenderFunnel(t) {
  const el = document.getElementById('adsFunnel');
  if (!el) return;
  if (t.imp === 0) {
    el.innerHTML = `<div style="font-size:12px;color:#888;text-align:center;padding:24px;">表示データなし</div>`;
    return;
  }
  const ctrPct = (t.ctr * 100).toFixed(2);
  const asrPct = (t.asr * 100).toFixed(2);
  const compPct = (t.completion_rate * 100).toFixed(1);
  // 表示幅は表示回数を1.0として比例配分
  const clickW = t.imp > 0 ? Math.max(0.10, t.click / t.imp) : 0.10;
  const startW = t.imp > 0 ? Math.max(0.06, t.apply_start / t.imp) : 0.06;
  const applyW = t.imp > 0 ? Math.max(0.04, t.apply / t.imp) : 0.04;
  el.innerHTML = `
    <div style="font-size:12px;font-weight:500;color:#1a1a1a;margin-bottom:10px;">🎯 応募ファネル</div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="flex:1;min-width:120px;">
        <div style="background:#5a8a48;height:34px;border-radius:6px;display:flex;align-items:center;padding:0 14px;color:#fff;font-size:12px;font-weight:500;">表示 ${t.imp.toLocaleString()}</div>
      </div>
      <div style="font-size:10px;color:#888;width:55px;text-align:center;">CTR<br><strong style="color:#1a1a1a;font-weight:500;">${ctrPct}%</strong></div>
      <div style="flex:${clickW.toFixed(3)};min-width:90px;">
        <div style="background:#7da66a;height:34px;border-radius:6px;display:flex;align-items:center;padding:0 12px;color:#fff;font-size:12px;font-weight:500;">クリック ${t.click.toLocaleString()}</div>
      </div>
      <div style="font-size:10px;color:#888;width:55px;text-align:center;">ASR<br><strong style="color:#1a1a1a;font-weight:500;">${asrPct}%</strong></div>
      <div style="flex:${startW.toFixed(3)};min-width:80px;">
        <div style="background:#a8c596;height:34px;border-radius:6px;display:flex;align-items:center;padding:0 10px;color:#fff;font-size:11px;font-weight:500;">開始 ${t.apply_start.toLocaleString()}</div>
      </div>
      <div style="font-size:10px;color:#888;width:55px;text-align:center;">完了率<br><strong style="color:#1a1a1a;font-weight:500;">${compPct}%</strong></div>
      <div style="flex:${applyW.toFixed(3)};min-width:70px;">
        <div style="background:#c7dab6;height:34px;border-radius:6px;display:flex;align-items:center;padding:0 8px;color:#3B6D11;font-size:11px;font-weight:500;">完了 ${t.apply.toLocaleString()}</div>
      </div>
    </div>
  `;
}

// グローバル公開
if (typeof window !== 'undefined') {
  window.adsLoadAnalytics = adsLoadAnalytics;
  window.adsSetMedia = adsSetMedia;
  window.adsSetPeriodMode = adsSetPeriodMode;
  window.adsRefreshAnalytics = adsRefreshAnalytics;
}

// ============================================================================
// 📊 フェーズ2：分析画面 - パート2（月別推移、CP別、都道府県TOP5）
// 2026/05/12 追加
// ============================================================================

let adsMonthlyView = 'table';  // 'table' or 'graph'

// パート1の adsRefreshAnalytics 拡張：パート2のセクションも描画
const _origAdsRefreshAnalytics = window.adsRefreshAnalytics;
window.adsRefreshAnalytics = function() {
  if (typeof _origAdsRefreshAnalytics === 'function') _origAdsRefreshAnalytics();
  // パート2セクション描画
  adsRenderMonthlyTrend();
  adsRenderCampaignPerf();
  adsRenderPrefTop();
};

// --- 月別パフォーマンス推移 ---
function adsRenderMonthlyTrend() {
  const el = document.getElementById('adsMonthlyTrend');
  if (!el) return;
  // 媒体・CPで絞ったrowsの中で、月ごとに集計
  const cp = document.getElementById('adsCampaignFilter')?.value || '';
  const filtered = adsRows.filter(r => {
    if (adsActiveMedia !== 'all' && r.media_type !== adsActiveMedia) return false;
    if (cp && r.campaign !== cp) return false;
    return true;
  });

  // 月別グルーピング
  const byMonth = {};
  filtered.forEach(r => {
    const m = r._month;
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(r);
  });
  const months = Object.keys(byMonth).sort();
  if (months.length === 0) {
    el.innerHTML = '';
    return;
  }

  // 各月の集計
  const monthData = months.map(m => ({
    month: m,
    agg: adsAggregate(byMonth[m]),
  }));

  // 最新月
  const latestMonth = months[months.length - 1];
  // 応募完了の最大値（棒グラフのスケール用）
  const maxApply = Math.max(...monthData.map(d => d.agg.apply), 1);

  // テーブル/グラフ切替の見た目
  const tableBtn = adsMonthlyView === 'table'
    ? `<button onclick="adsSetMonthlyView('table')" style="padding:3px 9px;background:#5a8a48;color:#fff;border:none;border-radius:4px;font-size:10px;font-family:inherit;cursor:pointer;">テーブル</button>`
    : `<button onclick="adsSetMonthlyView('table')" style="padding:3px 9px;background:#fff;color:#666;border:1px solid #e3e3e0;border-radius:4px;font-size:10px;font-family:inherit;cursor:pointer;">テーブル</button>`;
  const graphBtn = adsMonthlyView === 'graph'
    ? `<button onclick="adsSetMonthlyView('graph')" style="padding:3px 9px;background:#5a8a48;color:#fff;border:none;border-radius:4px;font-size:10px;font-family:inherit;cursor:pointer;">グラフ</button>`
    : `<button onclick="adsSetMonthlyView('graph')" style="padding:3px 9px;background:#fff;color:#666;border:1px solid #e3e3e0;border-radius:4px;font-size:10px;font-family:inherit;cursor:pointer;">グラフ</button>`;

  let body = '';
  if (adsMonthlyView === 'table') {
    // 列幅を固定して、ヘッダーと数値の位置を一致させる
    // tbl-fixedレイアウトで各列の幅を厳密に制御
    const colWidths = {
      month:      '12%',
      imp:        '11%',
      click:      '10%',
      ctr:         '8%',
      applyStart:  '10%',
      apply:       '10%',
      completion:  '9%',
      cost:       '12%',
      cpa:        '12%',
      arrow:       '6%',
    };
    // 数値セルの共通スタイル：右寄せ＋右側に少し余白
    const numTh = `padding:7px 14px 7px 6px;font-weight:500;text-align:right;`;
    const numTd = `padding:8px 14px 8px 6px;text-align:right;`;
    body = `<div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:780px;table-layout:fixed;">
        <colgroup>
          <col style="width:${colWidths.month}">
          <col style="width:${colWidths.imp}">
          <col style="width:${colWidths.click}">
          <col style="width:${colWidths.ctr}">
          <col style="width:${colWidths.applyStart}">
          <col style="width:${colWidths.apply}">
          <col style="width:${colWidths.completion}">
          <col style="width:${colWidths.cost}">
          <col style="width:${colWidths.cpa}">
          <col style="width:${colWidths.arrow}">
        </colgroup>
        <thead>
          <tr style="border-bottom:1px solid #e8ebe9;color:#666;">
            <th style="padding:7px 6px;font-weight:500;text-align:left;">月</th>
            <th style="${numTh}">表示</th>
            <th style="${numTh}">クリック</th>
            <th style="${numTh}">CTR</th>
            <th style="${numTh}">応募開始</th>
            <th style="${numTh}">応募完了</th>
            <th style="${numTh}">完了率</th>
            <th style="${numTh}">費用</th>
            <th style="${numTh}">CPA</th>
            <th style="padding:7px 6px;font-weight:500;text-align:center;"></th>
          </tr>
        </thead>
        <tbody>
          ${monthData.map(d => {
            const isLatest = d.month === latestMonth;
            const rowBg = isLatest ? 'background:#fafdf7;' : '';
            const a = d.agg;
            const monthLabel = `${d.month.replace('-', '年')}月`;
            return `<tr style="border-bottom:0.5px solid #f0f0ee;${rowBg}">
              <td style="padding:8px 6px;text-align:left;font-weight:500;color:#1a1a1a;white-space:nowrap;">${monthLabel}${isLatest ? ' <span style="font-size:9px;color:#5a8a48;font-weight:500;background:#eaf3de;padding:1px 5px;border-radius:8px;margin-left:3px;">最新</span>' : ''}</td>
              <td style="${numTd}${isLatest ? 'font-weight:500;' : ''}">${a.imp.toLocaleString()}</td>
              <td style="${numTd}${isLatest ? 'font-weight:500;' : ''}">${a.click.toLocaleString()}</td>
              <td style="${numTd}color:#666;">${(a.ctr * 100).toFixed(2)}%</td>
              <td style="${numTd}${isLatest ? 'font-weight:500;' : ''}">${a.apply_start.toLocaleString()}</td>
              <td style="${numTd}font-weight:500;color:#5a8a48;">${a.apply.toLocaleString()}</td>
              <td style="${numTd}color:#666;">${(a.completion_rate * 100).toFixed(1)}%</td>
              <td style="${numTd}${isLatest ? 'font-weight:500;' : ''}">¥${Math.round(a.cost).toLocaleString()}</td>
              <td style="${numTd}color:#666;">${a.apply > 0 ? '¥' + Math.round(a.cpa).toLocaleString() : '—'}</td>
              <td style="padding:8px 6px;text-align:center;color:#5a8a48;cursor:pointer;" onclick="adsJumpToMonth('${d.month}')" title="この月にフィルタ">▶</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  } else {
    // グラフ表示：応募完了数の棒グラフ
    body = `<div style="display:flex;gap:8px;align-items:flex-end;height:160px;padding:10px 4px 4px;">
      ${monthData.map(d => {
        const isLatest = d.month === latestMonth;
        const h = Math.max(2, (d.agg.apply / maxApply) * 130);
        const barColor = isLatest ? '#5a8a48' : '#a8c596';
        const numColor = isLatest ? '#5a8a48' : '#3B6D11';
        const labelColor = isLatest ? '#5a8a48' : '#666';
        const labelWeight = isLatest ? '500' : '400';
        const monthLabel = d.month.slice(5).replace(/^0/, '') + '月';
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;" onclick="adsJumpToMonth('${d.month}')">
          <div style="font-size:10px;font-weight:500;color:${numColor};">${d.agg.apply}</div>
          <div style="background:${barColor};width:100%;height:${h}px;border-radius:4px 4px 0 0;transition:opacity .15s;" onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'"></div>
          <div style="font-size:9px;color:${labelColor};font-weight:${labelWeight};">${monthLabel}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="text-align:center;font-size:10px;color:#888;margin-top:6px;">応募完了数の月別推移（クリックでその月にフィルタ）</div>`;
  }

  el.innerHTML = `
    <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:10px;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:6px;">
        <div style="font-size:12px;font-weight:500;color:#1a1a1a;">📅 月別パフォーマンス推移</div>
        <div style="display:flex;gap:4px;align-items:center;">
          <span style="font-size:10px;color:#888;">表示形式：</span>
          ${tableBtn}${graphBtn}
        </div>
      </div>
      ${body}
    </div>
  `;
}

function adsSetMonthlyView(v) {
  adsMonthlyView = v;
  adsRenderMonthlyTrend();
}

function adsJumpToMonth(m) {
  // 単月モードにしてその月を選択
  adsPeriodMode = 'single';
  document.querySelectorAll('.ads-period-btn').forEach(b => {
    if (b.dataset.period === 'single') {
      b.style.background = '#5a8a48'; b.style.color = '#fff'; b.style.fontWeight = '500';
    } else {
      b.style.background = 'transparent'; b.style.color = '#666'; b.style.fontWeight = '400';
    }
  });
  document.getElementById('adsPeriodSingle').style.display = 'flex';
  document.getElementById('adsPeriodRange').style.display = 'none';
  document.getElementById('adsPeriodCompare').style.display = 'none';
  document.getElementById('adsSingleMonth').value = m;
  adsRefreshAnalytics();
  // 画面トップへスクロール
  document.getElementById('adsKpiMain')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- キャンペーン別パフォーマンス ---
function adsRenderCampaignPerf() {
  const el = document.getElementById('adsCampaignPerf');
  if (!el) return;
  const result = adsFilterRowsByPeriod();
  const rows = result.rows || [];

  // CPでグルーピング
  const byCp = {};
  rows.forEach(r => {
    const cp = r.campaign || '(未設定)';
    if (!byCp[cp]) byCp[cp] = [];
    byCp[cp].push(r);
  });
  const cps = Object.keys(byCp);
  if (cps.length === 0) {
    el.innerHTML = '';
    return;
  }

  // CPごとの集計
  const cpData = cps.map(cp => {
    const agg = adsAggregate(byCp[cp]);
    // CP名から予算を推測（"全案件￥1,200,000 - 2026年5月8日〜2026年5月31日"などのパターン）
    let budget = null;
    let cpPeriodStart = null;
    let cpPeriodEnd = null;
    const budM = cp.match(/[¥￥]\s*([0-9,]+)/);
    if (budM) budget = parseInt(budM[1].replace(/,/g, ''), 10);
    const dateM = cp.match(/(\d{4})年(\d{1,2})月(\d{1,2})日[～~〜](\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (dateM) {
      cpPeriodStart = `${dateM[1]}/${dateM[2]}/${dateM[3]}`;
      cpPeriodEnd = `${dateM[4]}/${dateM[5]}/${dateM[6]}`;
    } else {
      // AirWORK形式："2273482_東京請負【2026/5/1〜5/31】"
      const dateM2 = cp.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})[～~〜](\d{1,2})\/(\d{1,2})/);
      if (dateM2) {
        cpPeriodStart = `${dateM2[1]}/${dateM2[2]}/${dateM2[3]}`;
        cpPeriodEnd = `${dateM2[1]}/${dateM2[4]}/${dateM2[5]}`;
      }
    }
    // 進行中/終了判定
    let isOngoing = false;
    if (cpPeriodEnd) {
      const endDate = new Date(cpPeriodEnd.replace(/\//g, '-'));
      const today = new Date();
      isOngoing = endDate >= today;
    }
    return { cp, agg, budget, cpPeriodStart, cpPeriodEnd, isOngoing, rowCount: byCp[cp].length };
  });

  // 費用降順
  cpData.sort((a, b) => b.agg.cost - a.agg.cost);

  el.innerHTML = `
    <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:10px;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:6px;">
        <div style="font-size:12px;font-weight:500;color:#1a1a1a;">📣 キャンペーン別パフォーマンス</div>
        <span style="font-size:10px;color:#888;">${cpData.length}件のキャンペーン</span>
      </div>
      ${cpData.map(d => {
        const consumePct = d.budget && d.budget > 0 ? (d.agg.cost / d.budget) * 100 : null;
        const borderColor = d.isOngoing ? '#5a8a48' : '#888';
        const bgColor = d.isOngoing ? '#f7f6f1' : '#f7f6f1';
        const opacity = d.isOngoing ? '1' : '.85';
        const badge = d.isOngoing
          ? '<span style="background:#eaf3de;color:#3B6D11;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:500;">進行中</span>'
          : (d.cpPeriodEnd
              ? '<span style="background:#f1efe8;color:#5F5E5A;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:500;">終了</span>'
              : '');
        const periodLabel = (d.cpPeriodStart && d.cpPeriodEnd)
          ? `<span style="font-size:10px;color:#888;font-weight:400;">(${d.cpPeriodStart}〜${d.cpPeriodEnd})</span>` : '';
        return `<div style="background:${bgColor};border-radius:8px;padding:12px 14px;margin-bottom:10px;border-left:3px solid ${borderColor};opacity:${opacity};">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
            <div style="min-width:0;flex:1;">
              <div style="font-size:12px;font-weight:500;color:#1a1a1a;word-break:break-all;">${escapeHtml(d.cp)} ${periodLabel}</div>
              <div style="font-size:10px;color:#888;margin-top:2px;">
                対象求人 ${d.rowCount}件
                ${d.budget ? `／ 予算 ¥${d.budget.toLocaleString()}` : ''}
                ${consumePct !== null ? `／ 消化 ¥${Math.round(d.agg.cost).toLocaleString()}（${consumePct.toFixed(1)}%）` : ''}
              </div>
            </div>
            ${badge}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;font-size:11px;">
            <div><div style="font-size:9px;color:#888;">表示</div><div style="font-weight:500;color:#1a1a1a;margin-top:1px;">${d.agg.imp.toLocaleString()}</div></div>
            <div><div style="font-size:9px;color:#888;">クリック</div><div style="font-weight:500;color:#1a1a1a;margin-top:1px;">${d.agg.click.toLocaleString()}</div></div>
            <div><div style="font-size:9px;color:#888;">応募開始</div><div style="font-weight:500;color:#1a1a1a;margin-top:1px;">${d.agg.apply_start.toLocaleString()}</div></div>
            <div><div style="font-size:9px;color:#888;">応募完了</div><div style="font-weight:500;color:#5a8a48;margin-top:1px;">${d.agg.apply.toLocaleString()}</div></div>
            <div><div style="font-size:9px;color:#888;">消化額</div><div style="font-weight:500;color:#1a1a1a;margin-top:1px;">¥${Math.round(d.agg.cost).toLocaleString()}</div></div>
            <div><div style="font-size:9px;color:#888;">CPC</div><div style="font-weight:500;color:#1a1a1a;margin-top:1px;">${d.agg.click > 0 ? '¥' + Math.round(d.agg.cpc).toLocaleString() : '—'}</div></div>
            <div><div style="font-size:9px;color:#888;">CPA</div><div style="font-weight:500;color:#1a1a1a;margin-top:1px;">${d.agg.apply > 0 ? '¥' + Math.round(d.agg.cpa).toLocaleString() : '—'}</div></div>
          </div>
          ${consumePct !== null ? `
          <div style="margin-top:10px;background:#eee;border-radius:4px;height:6px;overflow:hidden;">
            <div style="background:${d.isOngoing ? '#5a8a48' : '#aaa'};width:${Math.min(consumePct, 100)}%;height:100%;"></div>
          </div>
          <div style="font-size:9px;color:#888;margin-top:3px;display:flex;justify-content:space-between;">
            <span>予算消化率</span><span>${consumePct.toFixed(1)}%</span>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

// --- 都道府県TOP5（応募完了数） ---
function adsRenderPrefTop() {
  const el = document.getElementById('adsPrefTop');
  if (!el) return;
  const result = adsFilterRowsByPeriod();
  const rows = result.rows || [];

  // 都道府県別グルーピング（応募完了数で集計）
  const byPref = {};
  rows.forEach(r => {
    const pref = (r.prefecture || '').trim();
    if (!pref) return;
    if (!byPref[pref]) byPref[pref] = { apply: 0, cost: 0, click: 0, imp: 0 };
    byPref[pref].apply += r.apply || 0;
    byPref[pref].cost += Number(r.cost) || 0;
    byPref[pref].click += r.click || 0;
    byPref[pref].imp += r.imp || 0;
  });
  const list = Object.entries(byPref)
    .map(([pref, d]) => ({ pref, ...d }))
    .filter(d => d.apply > 0)
    .sort((a, b) => b.apply - a.apply)
    .slice(0, 5);

  if (list.length === 0) {
    el.innerHTML = '';
    return;
  }

  const maxApply = list[0].apply;
  el.innerHTML = `
    <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:10px;padding:14px 16px;">
      <div style="font-size:12px;font-weight:500;color:#1a1a1a;margin-bottom:12px;">🗾 都道府県TOP5（応募完了数）</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        ${[0, 1].map(col => `
          <div style="display:flex;flex-direction:column;gap:7px;">
            ${list.slice(col * 3, col * 3 + 3).map((d, idx) => {
              const rank = col * 3 + idx + 1;
              const wPct = (d.apply / maxApply) * 100;
              return `<div style="display:grid;grid-template-columns:24px 90px 1fr 36px;gap:8px;font-size:11px;align-items:center;">
                <span style="color:#888;">${rank}</span>
                <span style="font-weight:500;color:#1a1a1a;">${escapeHtml(d.pref)}</span>
                <div style="background:#eaf3de;height:14px;border-radius:3px;"><div style="background:#5a8a48;width:${wPct}%;height:100%;border-radius:3px;"></div></div>
                <span style="text-align:right;font-weight:500;color:#1a1a1a;">${d.apply}</span>
              </div>`;
            }).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// グローバル公開
if (typeof window !== 'undefined') {
  window.adsSetMonthlyView = adsSetMonthlyView;
  window.adsJumpToMonth = adsJumpToMonth;
}

// ============================================================================
// 📊 フェーズ2：分析画面 - パート3（求人別ランキング + ワーストランキング4種）
// 2026/05/12 追加
// ============================================================================

let adsJobRankingMode = 'top';   // 'top' / 'cost' / 'click'
let adsWorstActiveTab = 'cost';  // 'cost' / 'ctr' / 'start' / 'complete'
// 全件表示モード（TOPだけ or 全件）
let adsJobRankingShowAll = false;   // 求人別ランキング
let adsWorstShowAll = { cost: false, ctr: false, start: false, complete: false }; // ワーストTAB別

// パート2の adsRefreshAnalytics を拡張
const _origAdsRefreshAnalytics_v3 = window.adsRefreshAnalytics;
window.adsRefreshAnalytics = function() {
  if (typeof _origAdsRefreshAnalytics_v3 === 'function') _origAdsRefreshAnalytics_v3();
  adsRenderJobRanking();
  adsRenderWorstSections();
};

// --- 求人別ランキング ---
function adsRenderJobRanking() {
  const el = document.getElementById('adsJobRanking');
  if (!el) return;
  const result = adsFilterRowsByPeriod();
  const rows = result.rows || [];

  if (rows.length === 0) {
    el.innerHTML = '';
    return;
  }

  // CPシェア基準セレクトの選択肢を作る（CP一覧）
  const cpSet = new Set(rows.map(r => r.campaign).filter(c => c && c !== '-'));
  const cpList = Array.from(cpSet).sort();

  // CPシェア基準（デフォルト：先頭のCP）
  const shareBasis = el.dataset.shareBasis || (cpList[0] || '');
  // 各CPの合計応募完了数を計算（シェアの分母）
  const cpTotals = {};
  cpList.forEach(cp => {
    cpTotals[cp] = rows.filter(r => r.campaign === cp).reduce((s, r) => s + (r.apply || 0), 0);
  });
  const totalApplyAll = rows.reduce((s, r) => s + (r.apply || 0), 0);

  // 並び順
  let sorted = [...rows];
  if (adsJobRankingMode === 'top') {
    sorted.sort((a, b) => (b.apply || 0) - (a.apply || 0));
  } else if (adsJobRankingMode === 'cost') {
    sorted.sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0));
  } else if (adsJobRankingMode === 'click') {
    sorted.sort((a, b) => (b.click || 0) - (a.click || 0));
  }
  // 全件表示モードならスライスなし、そうでなければTOP10
  const totalCount = sorted.length;
  const displayRows = adsJobRankingShowAll ? sorted : sorted.slice(0, 10);
  const top = displayRows;

  // CPシェア計算（シェア基準と該当行のCPが一致するときだけ計算）
  function calcShare(r) {
    let denom, basisLabel;
    if (shareBasis === '__all__') {
      denom = totalApplyAll;
      basisLabel = '全期間';
    } else {
      denom = cpTotals[shareBasis] || 0;
      basisLabel = shareBasis;
    }
    if (denom === 0) return { pct: null, applies: 0, denom };
    // シェア基準のCPと一致する応募のみカウント
    if (shareBasis !== '__all__' && r.campaign !== shareBasis) return { pct: null, applies: r.apply || 0, denom };
    return { pct: ((r.apply || 0) / denom) * 100, applies: r.apply || 0, denom };
  }

  // 行HTML
  const tableRows = top.map((r, idx) => {
    const share = calcShare(r);
    const shareCell = share.pct === null
      ? `<span style="color:#aaa;font-size:9px;">基準外CP</span>`
      : `<div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
           <div style="background:#eaf3de;width:36px;height:6px;border-radius:3px;"><div style="background:#5a8a48;width:${Math.min(100, share.pct * 5)}%;height:100%;border-radius:3px;"></div></div>
           <span style="font-weight:500;color:#3B6D11;">${share.pct.toFixed(2)}%</span>
         </div>`;
    const urlLink = r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" style="color:#185FA5;text-decoration:none;font-size:10px;cursor:pointer;">求人 →</a>` : '<span style="color:#aaa;font-size:10px;">—</span>';
    return `<tr style="border-bottom:0.5px solid #f0f0ee;">
      <td style="padding:6px 4px;color:#888;">${idx + 1}</td>
      <td style="padding:6px 4px;font-weight:500;color:#1a1a1a;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.job_title || '')}">${escapeHtml(r.job_title || '—')}</td>
      <td style="padding:6px 4px;color:#666;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.company || '')}">${escapeHtml(r.company || '—')}</td>
      <td style="padding:6px 4px;text-align:right;">${(r.imp || 0).toLocaleString()}</td>
      <td style="padding:6px 4px;text-align:right;">${(r.click || 0).toLocaleString()}</td>
      <td style="padding:6px 4px;text-align:right;font-weight:500;color:#5a8a48;">${(r.apply || 0).toLocaleString()}</td>
      <td style="padding:6px 4px;text-align:right;">¥${Math.round(Number(r.cost) || 0).toLocaleString()}</td>
      <td style="padding:6px 4px;text-align:right;color:#666;">${(r.apply || 0) > 0 && Number(r.cost) > 0 ? '¥' + Math.round(Number(r.cost) / r.apply).toLocaleString() : '—'}</td>
      <td style="padding:6px 4px;text-align:right;background:#fafdf7;border-left:2px solid #5a8a48;">${shareCell}</td>
      <td style="padding:6px 4px;text-align:center;">${urlLink}</td>
    </tr>`;
  }).join('');

  // セレクトオプション
  let shareOptions = '';
  if (cpList.length > 0) {
    cpList.forEach(cp => {
      const label = cp.length > 40 ? cp.slice(0, 38) + '…' : cp;
      shareOptions += `<option value="${escapeHtml(cp)}" ${cp === shareBasis ? 'selected' : ''}>シェア基準：${escapeHtml(label)}</option>`;
    });
    shareOptions += `<option value="__all__" ${shareBasis === '__all__' ? 'selected' : ''}>シェア基準：全期間合算</option>`;
  }

  el.innerHTML = `
    <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:10px;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:12px;font-weight:500;color:#1a1a1a;">🏆 求人別ランキング${adsJobRankingShowAll ? `（全${totalCount}件）` : `（TOP10 / 全${totalCount}件）`}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <select onchange="adsSetJobRankingMode(this.value)" style="padding:4px 8px;border:1px solid #e3e3e0;border-radius:5px;font-size:10px;background:#fff;font-family:inherit;">
            <option value="top" ${adsJobRankingMode === 'top' ? 'selected' : ''}>並び：応募完了数</option>
            <option value="cost" ${adsJobRankingMode === 'cost' ? 'selected' : ''}>並び：費用</option>
            <option value="click" ${adsJobRankingMode === 'click' ? 'selected' : ''}>並び：クリック数</option>
          </select>
          ${cpList.length > 0 ? `<select onchange="adsSetJobShareBasis(this.value)" style="padding:4px 8px;border:1px solid #e3e3e0;border-radius:5px;font-size:10px;background:#fff;font-family:inherit;max-width:280px;">${shareOptions}</select>` : ''}
          <button onclick="adsExportJobRankingCsv()" style="padding:4px 10px;background:#5a8a48;color:#fff;border:none;border-radius:5px;font-size:10px;font-family:inherit;cursor:pointer;font-weight:500;">CSV出力</button>
        </div>
      </div>
      <div style="overflow-x:auto;${adsJobRankingShowAll ? 'max-height:600px;overflow-y:auto;' : ''}">
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;min-width:780px;">
          <thead>
            <tr style="border-bottom:1px solid #e8ebe9;color:#666;text-align:left;${adsJobRankingShowAll ? 'position:sticky;top:0;background:#fff;z-index:1;' : ''}">
              <th style="padding:6px 4px;font-weight:500;width:20px;">#</th>
              <th style="padding:6px 4px;font-weight:500;">求人</th>
              <th style="padding:6px 4px;font-weight:500;">企業</th>
              <th style="padding:6px 4px;font-weight:500;text-align:right;">表示</th>
              <th style="padding:6px 4px;font-weight:500;text-align:right;">CL</th>
              <th style="padding:6px 4px;font-weight:500;text-align:right;">応募</th>
              <th style="padding:6px 4px;font-weight:500;text-align:right;">費用</th>
              <th style="padding:6px 4px;font-weight:500;text-align:right;">CPA</th>
              <th style="padding:6px 4px;font-weight:500;text-align:right;background:#f4f8f1;border-left:2px solid #5a8a48;">CPシェア</th>
              <th style="padding:6px 4px;font-weight:500;text-align:center;">操作</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      ${totalCount > 10 ? `<div style="text-align:center;margin-top:10px;">
        <button onclick="adsToggleJobRankingShowAll()" style="padding:6px 14px;background:#fff;border:1px solid #5a8a48;color:#5a8a48;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:500;transition:all .15s;" onmouseover="this.style.background='#eaf3de'" onmouseout="this.style.background='#fff'">${adsJobRankingShowAll ? '🔼 TOP10に戻す' : `🔽 全${totalCount}件を表示`}</button>
      </div>` : ''}
      <div style="margin-top:8px;font-size:9px;color:#888;line-height:1.6;background:#fafaf8;padding:6px 10px;border-radius:5px;">
        💡 CPシェア = 該当求人の応募完了数 ÷ 基準CP内の総応募完了数。フィルタで基準を切替可能。
      </div>
    </div>
  `;
}

function adsSetJobRankingMode(m) {
  adsJobRankingMode = m;
  adsRenderJobRanking();
}
function adsSetJobShareBasis(v) {
  const el = document.getElementById('adsJobRanking');
  if (el) el.dataset.shareBasis = v;
  adsRenderJobRanking();
}
function adsToggleJobRankingShowAll() {
  adsJobRankingShowAll = !adsJobRankingShowAll;
  adsRenderJobRanking();
}

// 求人別ランキングをCSV出力
function adsExportJobRankingCsv() {
  const result = adsFilterRowsByPeriod();
  const rows = result.rows || [];
  if (rows.length === 0) { alert('出力するデータがありません'); return; }
  let sorted = [...rows];
  if (adsJobRankingMode === 'top') sorted.sort((a, b) => (b.apply || 0) - (a.apply || 0));
  else if (adsJobRankingMode === 'cost') sorted.sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0));
  else if (adsJobRankingMode === 'click') sorted.sort((a, b) => (b.click || 0) - (a.click || 0));

  const header = ['順位','求人','企業','勤務地','媒体','キャンペーン','表示','クリック','応募開始','応募完了','費用','CTR','CPC','CPA','URL'];
  const csvRows = [header.join(',')];
  sorted.forEach((r, i) => {
    const ctr = r.imp > 0 ? ((r.click || 0) / r.imp * 100).toFixed(2) + '%' : '';
    const cpc = (r.click || 0) > 0 ? Math.round((Number(r.cost) || 0) / r.click) : '';
    const cpa = (r.apply || 0) > 0 ? Math.round((Number(r.cost) || 0) / r.apply) : '';
    const fields = [
      i + 1,
      `"${(r.job_title || '').replace(/"/g, '""')}"`,
      `"${(r.company || '').replace(/"/g, '""')}"`,
      `"${(r.prefecture || '') + (r.city || '')}"`,
      r.media_type === 'indeed' ? 'Indeed' : 'AirWORK',
      `"${(r.campaign || '').replace(/"/g, '""')}"`,
      r.imp || 0, r.click || 0, r.apply_start || 0, r.apply || 0,
      Math.round(Number(r.cost) || 0), ctr, cpc, cpa,
      `"${(r.url || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(fields.join(','));
  });
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const fn = `job_ranking_${result.periodLabel.replace(/[\/\s]/g, '_')}.csv`;
  link.download = fn;
  link.click();
}

// --- ワーストランキング（改善が必要な求人） ---
function adsRenderWorstSections() {
  const el = document.getElementById('adsWorstSections');
  if (!el) return;
  const result = adsFilterRowsByPeriod();
  const rows = result.rows || [];

  if (rows.length === 0) {
    el.innerHTML = '';
    return;
  }

  // ① 費用かかってるのに応募ゼロ
  const w1 = rows.filter(r => (r.apply || 0) === 0 && (Number(r.cost) || 0) > 0)
                 .sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0));
  const w1Cost = w1.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const totalCost = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0);

  // ② 表示多いのにクリックされない
  const w2 = rows.filter(r => (r.imp || 0) >= 100 && (r.click || 0) === 0 || ((r.imp || 0) >= 100 && (r.click || 0) / r.imp < 0.01))
                 .sort((a, b) => (b.imp || 0) - (a.imp || 0));

  // ③ クリック多いのに応募開始されない
  const w3 = rows.filter(r => (r.click || 0) >= 20 && (r.apply_start || 0) === 0)
                 .sort((a, b) => (b.click || 0) - (a.click || 0));

  // ④ 応募開始してるのに完了されない
  const w4 = rows.filter(r => (r.apply_start || 0) >= 3 && (r.apply || 0) / r.apply_start < 0.5)
                 .sort((a, b) => (b.apply_start || 0) - (a.apply_start || 0));

  // CP別費用集計（①シェア計算用）
  const cpCostTotals = {};
  rows.forEach(r => {
    const cp = r.campaign || '(未設定)';
    if (!cpCostTotals[cp]) cpCostTotals[cp] = 0;
    cpCostTotals[cp] += Number(r.cost) || 0;
  });

  // タブの見た目
  const tabBtn = (key, color, label, count, sub) => {
    const isActive = adsWorstActiveTab === key;
    const bg = isActive ? color.bg : '#fff';
    const border = isActive ? color.border : '#e8ebe9';
    const numColor = isActive ? color.numActive : color.num;
    return `<button onclick="adsSetWorstTab('${key}')" style="background:${bg};border:1.5px solid ${border};border-radius:8px;padding:10px 12px;text-align:left;cursor:pointer;font-family:inherit;color:#1a1a1a;${isActive ? '' : 'filter:saturate(.6) opacity:.7;'}">
      <div style="font-size:9px;color:${color.label};letter-spacing:.04em;font-weight:500;">${label}</div>
      <div style="font-size:18px;font-weight:500;color:${numColor};margin-top:1px;">${count}<span style="font-size:10px;font-weight:400;color:#888;">件</span></div>
      <div style="font-size:9px;color:${color.label};margin-top:1px;">${sub}</div>
    </button>`;
  };

  const c1 = { bg: '#fdf2ee', border: '#F0997B', label: '#993C1D', num: '#712B13', numActive: '#712B13' };
  const c2 = { bg: '#fef7e9', border: '#EF9F27', label: '#854F0B', num: '#633806', numActive: '#633806' };
  const c3 = { bg: '#f5f4fd', border: '#AFA9EC', label: '#3C3489', num: '#26215C', numActive: '#26215C' };
  const c4 = { bg: '#fbeaf0', border: '#ED93B1', label: '#993556', num: '#4B1528', numActive: '#4B1528' };

  // 詳細テーブル
  let detailHtml = '';
  if (adsWorstActiveTab === 'cost') {
    detailHtml = adsRenderWorstCost(w1, totalCost, cpCostTotals);
  } else if (adsWorstActiveTab === 'ctr') {
    detailHtml = adsRenderWorstCtr(w2);
  } else if (adsWorstActiveTab === 'start') {
    detailHtml = adsRenderWorstStart(w3);
  } else if (adsWorstActiveTab === 'complete') {
    detailHtml = adsRenderWorstComplete(w4);
  }

  el.innerHTML = `
    <div style="background:#fff;border:0.5px solid #e8ebe9;border-radius:10px;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div style="font-size:13px;font-weight:500;color:#1a1a1a;">⚠️ 改善が必要な求人</div>
        <span style="font-size:10px;color:#888;">カードをクリックで詳細切替</span>
      </div>
      <div style="font-size:10.5px;color:#666;line-height:1.6;margin-bottom:14px;">応募ファネルの各段階で「進まなかった」求人を特定。改善余地が大きい順に並んでいます。</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
        ${tabBtn('cost', c1, '①費用ムダ', w1.length, totalCost > 0 ? `¥${Math.round(w1Cost).toLocaleString()}を消費（${(w1Cost/totalCost*100).toFixed(1)}%）` : '対象なし')}
        ${tabBtn('ctr', c2, '②CTR低', w2.length, '表示100+ & CTR1%未満')}
        ${tabBtn('start', c3, '③応募開始0', w3.length, 'CL20+ & 応募開始0')}
        ${tabBtn('complete', c4, '④応募完了率低', w4.length, '開始3+ & 完了率50%未満')}
      </div>

      ${detailHtml}
    </div>
  `;
}

function adsSetWorstTab(t) {
  adsWorstActiveTab = t;
  adsRenderWorstSections();
}

// ワーストランキング各タブの「全件表示」トグル
function adsToggleWorstShowAll(key) {
  if (adsWorstShowAll[key] === undefined) return;
  adsWorstShowAll[key] = !adsWorstShowAll[key];
  adsRenderWorstSections();
}

// 各ワーストランキングのテーブル描画
function adsRenderWorstCost(list, totalCost, cpCostTotals) {
  if (list.length === 0) return `<div style="background:#fdf2ee;border-left:3px solid #D85A30;border-radius:0 8px 8px 0;padding:14px;font-size:11px;color:#712B13;">✓ 応募ゼロで費用が出てる求人はありません。素晴らしい！</div>`;
  const totalWaste = list.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const showAll = adsWorstShowAll.cost;
  const displayList = showAll ? list : list.slice(0, 5);

  const tableRows = displayList.map((r, i) => {
    const cp = r.campaign || '(未設定)';
    const cpDisplay = cp.length > 28 ? cp.slice(0, 26) + '…' : cp;
    const cpTotal = cpCostTotals[cp] || 0;
    const sharePct = cpTotal > 0 ? ((Number(r.cost) || 0) / cpTotal * 100) : 0;
    const urlLink = r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" style="color:#185FA5;text-decoration:none;font-size:10px;">求人 →</a>` : '<span style="color:#aaa;font-size:10px;">—</span>';
    return `<tr style="border-bottom:0.5px solid rgba(0,0,0,.05);">
      <td style="padding:5px 4px;color:#888;">${i + 1}</td>
      <td style="padding:5px 4px;font-weight:500;color:#1a1a1a;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.job_title || '')}">${escapeHtml(r.job_title || '—')}</td>
      <td style="padding:5px 4px;color:#666;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.company || '')}">${escapeHtml(r.company || '—')}</td>
      <td style="padding:5px 4px;color:#555;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(cp)}"><span style="display:inline-block;background:#fff;color:#993C1D;padding:1px 6px;border-radius:8px;font-size:10px;border:0.5px solid #F0997B;">${escapeHtml(cpDisplay)}</span></td>
      <td style="padding:5px 4px;text-align:right;">${(r.imp || 0).toLocaleString()}</td>
      <td style="padding:5px 4px;text-align:right;">${(r.click || 0).toLocaleString()}</td>
      <td style="padding:5px 4px;text-align:right;font-weight:500;color:#712B13;">¥${Math.round(Number(r.cost) || 0).toLocaleString()}</td>
      <td style="padding:5px 4px;text-align:right;background:rgba(216,90,48,.05);border-left:2px solid #D85A30;">
        <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
          <div style="background:#fdf2ee;width:36px;height:6px;border-radius:3px;"><div style="background:#D85A30;width:${Math.min(100, sharePct * 5)}%;height:100%;border-radius:3px;"></div></div>
          <span style="font-weight:500;color:#993C1D;">${sharePct.toFixed(2)}%</span>
        </div>
      </td>
      <td style="padding:5px 4px;text-align:center;">${urlLink}</td>
    </tr>`;
  }).join('');

  return `<div style="background:#fdf2ee;border-left:3px solid #D85A30;border-radius:0 8px 8px 0;padding:12px 14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
      <div>
        <div style="font-size:12px;font-weight:500;color:#712B13;">① 費用かかってるのに応募ゼロ ${showAll ? `（全${list.length}件）` : `TOP5`}</div>
        <div style="font-size:10px;color:#993C1D;margin-top:1px;">合計 ¥${Math.round(totalWaste).toLocaleString()} ${totalCost > 0 ? `（全費用の${(totalWaste/totalCost*100).toFixed(1)}%）` : ''}が成果ゼロ ／ 全${list.length}件</div>
      </div>
    </div>
    <div style="overflow-x:auto;${showAll ? 'max-height:500px;overflow-y:auto;' : ''}">
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;min-width:820px;">
        <thead>
          <tr style="border-bottom:0.5px solid rgba(0,0,0,.08);color:#993C1D;text-align:left;${showAll ? 'position:sticky;top:0;background:#fdf2ee;z-index:1;' : ''}">
            <th style="padding:5px 4px;font-weight:500;width:20px;">#</th>
            <th style="padding:5px 4px;font-weight:500;">求人</th>
            <th style="padding:5px 4px;font-weight:500;">企業</th>
            <th style="padding:5px 4px;font-weight:500;">CP</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">表示</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">CL</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">費用</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;background:rgba(216,90,48,.08);border-left:2px solid #D85A30;">CP内費用シェア</th>
            <th style="padding:5px 4px;font-weight:500;text-align:center;">操作</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${list.length > 5 ? `<div style="text-align:center;margin-top:8px;">
      <button onclick="adsToggleWorstShowAll('cost')" style="padding:5px 12px;background:#fff;border:1px solid #D85A30;color:#712B13;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:500;transition:all .15s;" onmouseover="this.style.background='#fdf2ee'" onmouseout="this.style.background='#fff'">${showAll ? '🔼 TOP5に戻す' : `🔽 全${list.length}件を表示`}</button>
    </div>` : ''}
    <div style="margin-top:6px;font-size:9px;color:#993C1D;line-height:1.6;">※ CP内費用シェア = 該当求人の費用 ÷ そのCP内の総費用</div>
  </div>`;
}

function adsRenderWorstCtr(list) {
  if (list.length === 0) return `<div style="background:#fef7e9;border-left:3px solid #BA7517;border-radius:0 8px 8px 0;padding:14px;font-size:11px;color:#854F0B;">✓ 表示が多いのにクリックされない求人はありません</div>`;
  const showAll = adsWorstShowAll.ctr;
  const displayList = showAll ? list : list.slice(0, 5);
  const tableRows = displayList.map((r, i) => {
    const ctr = (r.imp || 0) > 0 ? ((r.click || 0) / r.imp * 100).toFixed(2) : '0.00';
    const cp = r.campaign || '(未設定)';
    const cpDisplay = cp.length > 28 ? cp.slice(0, 26) + '…' : cp;
    const urlLink = r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" style="color:#185FA5;text-decoration:none;font-size:10px;">求人 →</a>` : '<span style="color:#aaa;font-size:10px;">—</span>';
    return `<tr style="border-bottom:0.5px solid rgba(0,0,0,.05);">
      <td style="padding:5px 4px;color:#888;">${i + 1}</td>
      <td style="padding:5px 4px;font-weight:500;color:#1a1a1a;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.job_title || '')}">${escapeHtml(r.job_title || '—')}</td>
      <td style="padding:5px 4px;color:#666;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.company || '')}">${escapeHtml(r.company || '—')}</td>
      <td style="padding:5px 4px;color:#555;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(cp)}"><span style="display:inline-block;background:#fff;color:#854F0B;padding:1px 6px;border-radius:8px;font-size:10px;border:0.5px solid #EF9F27;">${escapeHtml(cpDisplay)}</span></td>
      <td style="padding:5px 4px;text-align:right;font-weight:500;">${(r.imp || 0).toLocaleString()}</td>
      <td style="padding:5px 4px;text-align:right;">${(r.click || 0).toLocaleString()}</td>
      <td style="padding:5px 4px;text-align:right;font-weight:500;color:#854F0B;">${ctr}%</td>
      <td style="padding:5px 4px;text-align:right;">¥${Math.round(Number(r.cost) || 0).toLocaleString()}</td>
      <td style="padding:5px 4px;text-align:center;">${urlLink}</td>
    </tr>`;
  }).join('');

  return `<div style="background:#fef7e9;border-left:3px solid #BA7517;border-radius:0 8px 8px 0;padding:12px 14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
      <div>
        <div style="font-size:12px;font-weight:500;color:#854F0B;">② 表示多いのにクリックされない ${showAll ? `（全${list.length}件）` : `TOP5`}</div>
        <div style="font-size:10px;color:#BA7517;margin-top:1px;">求人タイトル・画像・冒頭文を改善する余地大 ／ 全${list.length}件</div>
      </div>
    </div>
    <div style="overflow-x:auto;${showAll ? 'max-height:500px;overflow-y:auto;' : ''}">
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;min-width:780px;">
        <thead>
          <tr style="border-bottom:0.5px solid rgba(0,0,0,.08);color:#854F0B;text-align:left;${showAll ? 'position:sticky;top:0;background:#fef7e9;z-index:1;' : ''}">
            <th style="padding:5px 4px;font-weight:500;width:20px;">#</th>
            <th style="padding:5px 4px;font-weight:500;">求人</th>
            <th style="padding:5px 4px;font-weight:500;">企業</th>
            <th style="padding:5px 4px;font-weight:500;">CP</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">表示</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">CL</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">CTR</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">費用</th>
            <th style="padding:5px 4px;font-weight:500;text-align:center;">操作</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${list.length > 5 ? `<div style="text-align:center;margin-top:8px;">
      <button onclick="adsToggleWorstShowAll('ctr')" style="padding:5px 12px;background:#fff;border:1px solid #BA7517;color:#854F0B;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:500;transition:all .15s;" onmouseover="this.style.background='#fef7e9'" onmouseout="this.style.background='#fff'">${showAll ? '🔼 TOP5に戻す' : `🔽 全${list.length}件を表示`}</button>
    </div>` : ''}
  </div>`;
}

function adsRenderWorstStart(list) {
  if (list.length === 0) return `<div style="background:#f5f4fd;border-left:3px solid #534AB7;border-radius:0 8px 8px 0;padding:14px;font-size:11px;color:#3C3489;">✓ クリックされた求人はちゃんと応募開始まで進んでいます！</div>`;
  const showAll = adsWorstShowAll.start;
  const displayList = showAll ? list : list.slice(0, 5);
  const tableRows = displayList.map((r, i) => {
    const cp = r.campaign || '(未設定)';
    const cpDisplay = cp.length > 28 ? cp.slice(0, 26) + '…' : cp;
    const urlLink = r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" style="color:#185FA5;text-decoration:none;font-size:10px;">求人 →</a>` : '<span style="color:#aaa;font-size:10px;">—</span>';
    return `<tr style="border-bottom:0.5px solid rgba(0,0,0,.05);">
      <td style="padding:5px 4px;color:#888;">${i + 1}</td>
      <td style="padding:5px 4px;font-weight:500;color:#1a1a1a;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.job_title || '')}">${escapeHtml(r.job_title || '—')}</td>
      <td style="padding:5px 4px;color:#666;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.company || '')}">${escapeHtml(r.company || '—')}</td>
      <td style="padding:5px 4px;color:#555;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(cp)}"><span style="display:inline-block;background:#fff;color:#3C3489;padding:1px 6px;border-radius:8px;font-size:10px;border:0.5px solid #AFA9EC;">${escapeHtml(cpDisplay)}</span></td>
      <td style="padding:5px 4px;text-align:right;font-weight:500;">${(r.click || 0).toLocaleString()}</td>
      <td style="padding:5px 4px;text-align:right;font-weight:500;color:#D85A30;">0</td>
      <td style="padding:5px 4px;text-align:right;">¥${Math.round(Number(r.cost) || 0).toLocaleString()}</td>
      <td style="padding:5px 4px;text-align:center;">${urlLink}</td>
    </tr>`;
  }).join('');

  return `<div style="background:#f5f4fd;border-left:3px solid #534AB7;border-radius:0 8px 8px 0;padding:12px 14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
      <div>
        <div style="font-size:12px;font-weight:500;color:#26215C;">③ クリックされてるのに応募開始されない ${showAll ? `（全${list.length}件）` : `TOP5`}</div>
        <div style="font-size:10px;color:#3C3489;margin-top:1px;">タイトルで惹けてるが、求人内容で離脱 → 本文改善余地大 ／ 全${list.length}件</div>
      </div>
    </div>
    <div style="overflow-x:auto;${showAll ? 'max-height:500px;overflow-y:auto;' : ''}">
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;min-width:780px;">
        <thead>
          <tr style="border-bottom:0.5px solid rgba(0,0,0,.08);color:#3C3489;text-align:left;${showAll ? 'position:sticky;top:0;background:#f5f4fd;z-index:1;' : ''}">
            <th style="padding:5px 4px;font-weight:500;width:20px;">#</th>
            <th style="padding:5px 4px;font-weight:500;">求人</th>
            <th style="padding:5px 4px;font-weight:500;">企業</th>
            <th style="padding:5px 4px;font-weight:500;">CP</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">CL</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">応募開始</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">費用</th>
            <th style="padding:5px 4px;font-weight:500;text-align:center;">操作</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${list.length > 5 ? `<div style="text-align:center;margin-top:8px;">
      <button onclick="adsToggleWorstShowAll('start')" style="padding:5px 12px;background:#fff;border:1px solid #534AB7;color:#26215C;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:500;transition:all .15s;" onmouseover="this.style.background='#f5f4fd'" onmouseout="this.style.background='#fff'">${showAll ? '🔼 TOP5に戻す' : `🔽 全${list.length}件を表示`}</button>
    </div>` : ''}
  </div>`;
}

function adsRenderWorstComplete(list) {
  if (list.length === 0) return `<div style="background:#fbeaf0;border-left:3px solid #D4537E;border-radius:0 8px 8px 0;padding:14px;font-size:11px;color:#993556;">✓ 応募開始した人はほぼ完了まで進んでいます！</div>`;
  const showAll = adsWorstShowAll.complete;
  const displayList = showAll ? list : list.slice(0, 5);
  const tableRows = displayList.map((r, i) => {
    const rate = (r.apply_start || 0) > 0 ? ((r.apply || 0) / r.apply_start * 100).toFixed(0) : '0';
    const cp = r.campaign || '(未設定)';
    const cpDisplay = cp.length > 28 ? cp.slice(0, 26) + '…' : cp;
    const urlLink = r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" style="color:#185FA5;text-decoration:none;font-size:10px;">求人 →</a>` : '<span style="color:#aaa;font-size:10px;">—</span>';
    return `<tr style="border-bottom:0.5px solid rgba(0,0,0,.05);">
      <td style="padding:5px 4px;color:#888;">${i + 1}</td>
      <td style="padding:5px 4px;font-weight:500;color:#1a1a1a;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.job_title || '')}">${escapeHtml(r.job_title || '—')}</td>
      <td style="padding:5px 4px;color:#666;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(r.company || '')}">${escapeHtml(r.company || '—')}</td>
      <td style="padding:5px 4px;color:#555;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(cp)}"><span style="display:inline-block;background:#fff;color:#993556;padding:1px 6px;border-radius:8px;font-size:10px;border:0.5px solid #ED93B1;">${escapeHtml(cpDisplay)}</span></td>
      <td style="padding:5px 4px;text-align:right;font-weight:500;">${r.apply_start || 0}</td>
      <td style="padding:5px 4px;text-align:right;">${r.apply || 0}</td>
      <td style="padding:5px 4px;text-align:right;font-weight:500;color:#D4537E;">${rate}%</td>
      <td style="padding:5px 4px;text-align:center;">${urlLink}</td>
    </tr>`;
  }).join('');

  return `<div style="background:#fbeaf0;border-left:3px solid #D4537E;border-radius:0 8px 8px 0;padding:12px 14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
      <div>
        <div style="font-size:12px;font-weight:500;color:#4B1528;">④ 応募開始してるのに完了されない ${showAll ? `（全${list.length}件）` : `TOP5`}</div>
        <div style="font-size:10px;color:#993556;margin-top:1px;">応募フォームが長すぎ・難しすぎ → 簡素化で改善可 ／ 全${list.length}件</div>
      </div>
    </div>
    <div style="overflow-x:auto;${showAll ? 'max-height:500px;overflow-y:auto;' : ''}">
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;min-width:780px;">
        <thead>
          <tr style="border-bottom:0.5px solid rgba(0,0,0,.08);color:#993556;text-align:left;${showAll ? 'position:sticky;top:0;background:#fbeaf0;z-index:1;' : ''}">
            <th style="padding:5px 4px;font-weight:500;width:20px;">#</th>
            <th style="padding:5px 4px;font-weight:500;">求人</th>
            <th style="padding:5px 4px;font-weight:500;">企業</th>
            <th style="padding:5px 4px;font-weight:500;">CP</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">応募開始</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">応募完了</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">完了率</th>
            <th style="padding:5px 4px;font-weight:500;text-align:center;">操作</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${list.length > 5 ? `<div style="text-align:center;margin-top:8px;">
      <button onclick="adsToggleWorstShowAll('complete')" style="padding:5px 12px;background:#fff;border:1px solid #D4537E;color:#4B1528;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:500;transition:all .15s;" onmouseover="this.style.background='#fbeaf0'" onmouseout="this.style.background='#fff'">${showAll ? '🔼 TOP5に戻す' : `🔽 全${list.length}件を表示`}</button>
    </div>` : ''}
  </div>`;
}

// グローバル公開
if (typeof window !== 'undefined') {
  window.adsSetJobRankingMode = adsSetJobRankingMode;
  window.adsSetJobShareBasis = adsSetJobShareBasis;
  window.adsExportJobRankingCsv = adsExportJobRankingCsv;
  window.adsSetWorstTab = adsSetWorstTab;
  window.adsToggleJobRankingShowAll = adsToggleJobRankingShowAll;
  window.adsToggleWorstShowAll = adsToggleWorstShowAll;
}

// ============================================================================
// 🐨 フェーズ3：コアラ診断（モック版）
// 2026/05/12 追加
// ============================================================================
// 構成：
// - adsGenerateKoalaDiagnosis(): メイン関数。後で本物AIに差し替え可能
// - adsGenerateMockDiagnosis(): ルールベースで診断結果を組み立てる
// - adsRenderKoalaDiagnosisCard(): カードのHTML描画
// - adsAskKoala() / adsCloseKoalaChat() などUI操作
// ============================================================================

let adsKoalaCache = {};   // key: シグネチャ, value: 診断結果
let adsKoalaChatHistory = [];  // {role, text}

// パート3の adsRefreshAnalytics を更に拡張：コアラも描画
const _origAdsRefreshAnalytics_v4 = window.adsRefreshAnalytics;
window.adsRefreshAnalytics = function() {
  if (typeof _origAdsRefreshAnalytics_v4 === 'function') _origAdsRefreshAnalytics_v4();
  adsRenderKoalaDiagnosisCard();
};

// メイン：診断を取得（キャッシュ→生成）
async function adsGenerateKoalaDiagnosis(payload, forceRefresh) {
  const sig = adsBuildDiagnosisSignature(payload);
  if (!forceRefresh && adsKoalaCache[sig]) {
    return { ...adsKoalaCache[sig], cached: true };
  }
  // ★ ここを将来 adsCallClaudeAPI(payload) に差し替えるだけで本物AI化できる ★
  const result = adsGenerateMockDiagnosis(payload);
  adsKoalaCache[sig] = result;
  return { ...result, cached: false };
}

// 診断データの「指紋」生成（キャッシュキー）
function adsBuildDiagnosisSignature(p) {
  return [
    p.media, p.periodLabel, p.cp,
    p.main.imp, p.main.click, p.main.apply_start, p.main.apply, p.main.cost,
    (p.compare ? `${p.compare.imp}|${p.compare.click}|${p.compare.apply}|${p.compare.cost}` : 'noCmp'),
    p.worst.cost.length, p.worst.ctr.length, p.worst.start.length, p.worst.complete.length,
  ].join('::');
}

// ====== モック診断ロジック ======
function adsGenerateMockDiagnosis(p) {
  const m = p.main;
  const c = p.compare;
  const w = p.worst;
  const cpData = p.cpData;  // CP別データ

  // 全体所感（応募数の前期比、CPAの状況）
  let mood;  // 'great' / 'good' / 'caution' / 'warn'
  let summary;
  let summaryDetail;

  const applyDiff = c && c.apply > 0 ? ((m.apply - c.apply) / c.apply) * 100 : null;
  const costDiff = c && c.cost > 0 ? ((m.cost - c.cost) / c.cost) * 100 : null;
  const cpaCur = m.apply > 0 ? m.cost / m.apply : 0;
  const cpaPrev = c && c.apply > 0 ? c.cost / c.apply : 0;
  const cpaDiff = cpaPrev > 0 ? ((cpaCur - cpaPrev) / cpaPrev) * 100 : null;
  const wasteRate = m.cost > 0 ? (w.cost.reduce((s, r) => s + (Number(r.cost) || 0), 0) / m.cost) * 100 : 0;

  // ムード判定
  if (m.apply === 0 && m.imp > 0) {
    mood = 'caution';
    summary = '応募ゼロが続いてるよ…一緒に原因を探そう';
    summaryDetail = `${p.periodLabel}は応募が0件でした。表示は${m.imp.toLocaleString()}回あったので、求人が表示されてはいるんだけど、応募完了まで至っていない状態です。求人タイトルや募集条件を見直すと改善できるかも。`;
  } else if (applyDiff !== null) {
    // 前期比あり
    if (applyDiff >= 20 && (cpaDiff === null || cpaDiff <= 0)) {
      mood = 'great';
      summary = `応募${m.apply}件で前期比+${applyDiff.toFixed(1)}%！絶好調だよ✨`;
      summaryDetail = `${p.periodLabel}は前期比+${applyDiff.toFixed(1)}%で応募完了${m.apply}件達成。CPAも${cpaDiff !== null ? cpaDiff.toFixed(1) + '%改善' : '安定'}してて、運用が効いてるね〜！この調子！`;
    } else if (applyDiff >= 0) {
      mood = 'good';
      summary = `応募${m.apply}件で前期比+${applyDiff.toFixed(1)}%、堅調だね〜`;
      summaryDetail = `${p.periodLabel}は応募完了${m.apply}件で前期比+${applyDiff.toFixed(1)}%。順調に伸びてるよ。${wasteRate > 5 ? `ただ、応募ゼロのまま費用がかかってる求人が${w.cost.length}件あって、全費用の${wasteRate.toFixed(1)}%（¥${Math.round(w.cost.reduce((s,r)=>s+Number(r.cost||0),0)).toLocaleString()}）がムダになってる可能性があるんだ。` : ''}`;
    } else if (applyDiff >= -10) {
      mood = 'caution';
      summary = `応募${m.apply}件、前月よりちょっと下がってる…`;
      summaryDetail = `${p.periodLabel}は応募完了${m.apply}件で前期比${applyDiff.toFixed(1)}%。少し下がってるね。${cpaDiff !== null && cpaDiff > 10 ? `CPAも${cpaDiff.toFixed(1)}%上がってて、効率が悪化してる可能性あり。` : ''}原因を一緒に探してみよう。`;
    } else {
      mood = 'warn';
      summary = `応募が大幅に下がってる…(${applyDiff.toFixed(1)}%)`;
      summaryDetail = `${p.periodLabel}は応募完了${m.apply}件で前期比${applyDiff.toFixed(1)}%と大きく低下。求人内容・予算配分・媒体側のアルゴリズム変化など複数要因が考えられます。早めに対処したいね。`;
    }
  } else {
    // 前期比なし
    if (m.apply >= 50) {
      mood = 'good';
      summary = `応募${m.apply}件、順調だね〜`;
      summaryDetail = `${p.periodLabel}は応募完了${m.apply}件。${m.cost > 0 ? `費用¥${Math.round(m.cost).toLocaleString()}でCPA¥${Math.round(cpaCur).toLocaleString()}` : ''}。${wasteRate > 5 ? `応募ゼロ求人が${w.cost.length}件あって、改善余地もあるよ。` : '効率的に運用できてるよ。'}`;
    } else {
      mood = 'good';
      summary = `応募${m.apply}件の月だったね`;
      summaryDetail = `${p.periodLabel}は応募完了${m.apply}件。${m.cost > 0 ? `費用¥${Math.round(m.cost).toLocaleString()}で運用` : ''}。比較する前期データがあると、もっと深く分析できるよ。`;
    }
  }

  // 気になるポイント①（最大ムダ費用の求人）
  const insights = [];
  if (w.cost.length > 0) {
    const top = w.cost[0];
    insights.push({
      type: 'warn',
      color: '#D85A30',
      label: '⚠ 気になる①',
      title: `「${(top.job_title || '').slice(0, 24)}${top.job_title && top.job_title.length > 24 ? '…' : ''}」がムダ費用TOP`,
      detail: `¥${Math.round(Number(top.cost) || 0).toLocaleString()}消費でクリック${top.click || 0}なのに応募0。求人本文の見直しか出稿停止を検討してね。`
    });
  }

  // 気になるポイント②（応募開始されない or 応募完了率低い）
  if (w.start.length > 0) {
    insights.push({
      type: 'warn',
      color: '#BA7517',
      label: '⚠ 気になる②',
      title: `クリックされてるのに応募開始0が${w.start.length}件`,
      detail: 'タイトルで惹けてるけど、求人本文で離脱されてるかも。仕事内容や応募条件を魅力的にしてみよう。'
    });
  } else if (w.complete.length > 0) {
    insights.push({
      type: 'warn',
      color: '#BA7517',
      label: '⚠ 気になる②',
      title: `応募完了率が低い求人が${w.complete.length}件`,
      detail: '応募開始したのに完了しない＝応募フォームか必要書類が重い可能性。簡素化を検討してみよう。'
    });
  } else if (w.ctr.length > 0) {
    insights.push({
      type: 'warn',
      color: '#BA7517',
      label: '⚠ 気になる②',
      title: `CTRが低い求人が${w.ctr.length}件`,
      detail: '表示されてもクリックされない＝求人タイトルや画像が弱いかも。タイトルに具体的な数字を入れると改善するよ。'
    });
  }

  // 改善アクション
  let action;
  if (cpData && cpData.length >= 2) {
    // 複数CPある場合：CPAの差を見て予算配分提案
    const sorted = [...cpData].filter(d => d.agg.apply > 0).sort((a, b) => a.agg.cpa - b.agg.cpa);
    if (sorted.length >= 2) {
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const diff = Math.round(worst.agg.cpa - best.agg.cpa);
      if (diff > 500) {
        action = {
          color: '#5a8a48',
          label: '💡 こうしてみない？',
          title: `予算をCPA優秀なCPに寄せよう`,
          detail: `「${best.cp.slice(0, 20)}…」がCPA¥${Math.round(best.agg.cpa).toLocaleString()}で最効率。低効率CPから予算を移すと月+${Math.round(diff/best.agg.cpa)}件くらい見込めるかも。`
        };
      }
    }
  }
  if (!action && m.apply > 0 && wasteRate > 5) {
    action = {
      color: '#5a8a48',
      label: '💡 こうしてみない？',
      title: '応募ゼロ求人の出稿を見直す',
      detail: `応募ゼロで¥${Math.round(w.cost.reduce((s,r)=>s+Number(r.cost||0),0)).toLocaleString()}（${wasteRate.toFixed(1)}%）が消費されてる。これらを停止すると、その分の予算を他に回せるよ。`
    };
  }
  if (!action && m.imp > 0 && m.click === 0) {
    action = {
      color: '#5a8a48',
      label: '💡 こうしてみない？',
      title: 'まず求人タイトルから見直そう',
      detail: '表示はあるけどクリックが0。これは求人タイトルが採用層に刺さってない可能性が高いよ。「経験者歓迎」「未経験OK」など具体的なキーワードを入れてみて。'
    };
  }
  if (!action) {
    action = {
      color: '#5a8a48',
      label: '💡 こうしてみない？',
      title: '現状の運用を維持しつつ微調整',
      detail: '今のところ大きな問題は見当たらないよ。CPシェアが高い求人の予算を維持しつつ、低パフォーマンス求人の見直しを継続しよう。'
    };
  }
  insights.push(action);

  return {
    mood,
    summary,
    summaryDetail,
    insights,
    generatedAt: new Date().toISOString(),
  };
}

// コアラ画像URLをムードから決定
function adsGetKoalaImage(mood) {
  switch (mood) {
    case 'great':   return 'assets/koala-kira.png';
    case 'good':    return 'assets/koala-good.png';
    case 'caution': return 'assets/koala-think.png';
    case 'warn':    return 'assets/koala-think.png';
    case 'loading': return 'assets/koala-pc.png';
    default:        return 'assets/koala-pc.png';
  }
}
function adsGetKoalaMoodLabel(mood) {
  switch (mood) {
    case 'great':   return 'キラキラ✨ コアラ';
    case 'good':    return 'グッド👍 コアラ';
    case 'caution': return '考えるコアラ🤔';
    case 'warn':    return '心配コアラ😟';
    default:        return 'コアラ';
  }
}

// 現在のフィルタ状態から診断用payloadを構築
function adsBuildDiagnosisPayload() {
  const result = adsFilterRowsByPeriod();
  const rows = result.rows || [];
  const compareRows = result.compareRows || null;
  const main = adsAggregate(rows);
  const compare = compareRows ? adsAggregate(compareRows) : null;

  // ワーストランキング
  const w_cost = rows.filter(r => (r.apply || 0) === 0 && (Number(r.cost) || 0) > 0)
                     .sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0));
  const w_ctr = rows.filter(r => (r.imp || 0) >= 100 && ((r.click || 0) === 0 || (r.click || 0) / r.imp < 0.01))
                    .sort((a, b) => (b.imp || 0) - (a.imp || 0));
  const w_start = rows.filter(r => (r.click || 0) >= 20 && (r.apply_start || 0) === 0)
                      .sort((a, b) => (b.click || 0) - (a.click || 0));
  const w_complete = rows.filter(r => (r.apply_start || 0) >= 3 && (r.apply || 0) / r.apply_start < 0.5)
                         .sort((a, b) => (b.apply_start || 0) - (a.apply_start || 0));

  // CP別データ
  const byCp = {};
  rows.forEach(r => {
    const cp = r.campaign || '(未設定)';
    if (!byCp[cp]) byCp[cp] = [];
    byCp[cp].push(r);
  });
  const cpData = Object.keys(byCp).map(cp => ({
    cp,
    agg: adsAggregate(byCp[cp]),
  }));

  return {
    media: adsActiveMedia,
    periodLabel: result.periodLabel,
    cp: document.getElementById('adsCampaignFilter')?.value || '',
    main, compare,
    worst: { cost: w_cost, ctr: w_ctr, start: w_start, complete: w_complete },
    cpData,
    rowCount: rows.length,
  };
}

// コアラ診断カードを描画
async function adsRenderKoalaDiagnosisCard() {
  const el = document.getElementById('adsKoalaDiagnosisCard');
  if (!el) return;

  const payload = adsBuildDiagnosisPayload();
  if (payload.main.rowCount === 0) {
    // データなし
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#fafdf7 0%,#f4f8f1 100%);border:1px solid #c0dd97;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px;">
        <img src="assets/koala-think.png" alt="コアラ" style="width:54px;height:54px;object-fit:contain;">
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:500;color:#3B6D11;margin-bottom:2px;">🐨 コアラ診断</div>
          <div style="font-size:11px;color:#555;line-height:1.7;">${payload.periodLabel}にはまだデータがないみたい。期間を変えるか、CSVをアップロードしてくれたら診断するよ〜</div>
        </div>
      </div>`;
    return;
  }

  // ローディング表示
  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#fafdf7 0%,#f4f8f1 100%);border:1px solid #c0dd97;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px;">
      <img src="assets/koala-pc.png" alt="コアラ" style="width:54px;height:54px;object-fit:contain;">
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:500;color:#3B6D11;margin-bottom:2px;">🐨 コアラ診断</div>
        <div style="font-size:11px;color:#5a8a48;line-height:1.7;">📊 データを分析してるよ…</div>
      </div>
    </div>`;

  const diag = await adsGenerateKoalaDiagnosis(payload);

  // 本体描画
  const insightsHtml = diag.insights.map(ins => `
    <div style="background:#fff;border-radius:8px;padding:10px 12px;border:1px solid #e8ebe9;border-top:3px solid ${ins.color};">
      <div style="font-size:10px;color:${ins.color};font-weight:500;margin-bottom:3px;">${ins.label}</div>
      <div style="font-size:11px;color:#1a1a1a;font-weight:500;line-height:1.5;margin-bottom:3px;">${escapeHtml(ins.title)}</div>
      <div style="font-size:10px;color:#666;line-height:1.6;">${escapeHtml(ins.detail)}</div>
    </div>
  `).join('');

  const koalaImg = adsGetKoalaImage(diag.mood);
  const moodLabel = adsGetKoalaMoodLabel(diag.mood);
  const cached = diag.cached ? '<span style="font-size:9px;color:#aaa;margin-left:6px;">（キャッシュ表示）</span>' : '';

  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#fafdf7 0%,#f4f8f1 100%);border:1px solid #c0dd97;border-radius:12px;padding:16px 18px;">
      <div style="display:flex;align-items:flex-start;gap:14px;">

        <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;">
          <div style="width:88px;height:88px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #c0dd97;position:relative;overflow:hidden;">
            <img src="${koalaImg}" alt="コアラ" style="width:74px;height:74px;object-fit:contain;">
          </div>
          <div style="font-size:9px;color:#5a8a48;font-weight:500;margin-top:6px;letter-spacing:.04em;text-align:center;">${moodLabel}</div>
        </div>

        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
            <div>
              <div style="font-size:14px;font-weight:500;color:#1a1a1a;letter-spacing:.04em;">🐨 コアラ診断${cached}</div>
              <div style="font-size:10px;color:#888;margin-top:1px;">${escapeHtml(payload.periodLabel)} ／ 対象求人 ${payload.main.rowCount.toLocaleString()}件 ／ ${new Date(diag.generatedAt).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})} 生成</div>
            </div>
            <button onclick="adsRefreshKoalaDiagnosis()" style="padding:5px 11px;background:#fff;color:#5a8a48;border:1px solid #5a8a48;border-radius:6px;font-size:10px;font-weight:500;font-family:inherit;cursor:pointer;">🔄 もう一度診てもらう</button>
          </div>

          <div style="background:#fff;border-radius:8px;padding:11px 13px;margin-bottom:8px;border-left:3px solid #5a8a48;position:relative;">
            <div style="position:absolute;top:14px;left:-7px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-right:8px solid #fff;"></div>
            <div style="font-size:11px;font-weight:500;color:#1a1a1a;margin-bottom:4px;">${escapeHtml(diag.summary)}</div>
            <div style="font-size:11px;color:#444;line-height:1.7;">${escapeHtml(diag.summaryDetail)}</div>
          </div>

          <div style="display:grid;grid-template-columns:${diag.insights.length === 3 ? 'repeat(3,1fr)' : 'repeat(2,1fr)'};gap:8px;">
            ${insightsHtml}
          </div>

          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
            <button onclick="adsOpenKoalaDetail()" style="padding:4px 10px;background:#fff;border:1px solid #e3e3e0;border-radius:14px;font-size:10px;color:#5a8a48;cursor:pointer;font-family:inherit;">📋 もっと詳しく聞く</button>
            <button onclick="adsOpenKoalaChat()" style="padding:4px 10px;background:#fff;border:1px solid #e3e3e0;border-radius:14px;font-size:10px;color:#666;cursor:pointer;font-family:inherit;">💬 コアラに質問</button>
          </div>
        </div>
      </div>

      <div style="margin-top:10px;padding-top:10px;border-top:0.5px dashed #c0dd97;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <div style="font-size:9.5px;color:#5a8a48;">💡 コアラの顔は診断内容で変わるよ：考える🤔→注意あり / グッド👍→順調 / キラキラ✨→絶好調</div>
        <div style="font-size:9px;color:#888;">Powered by Saiyo Core 🐨</div>
      </div>
    </div>
  `;
}

// 「もう一度診てもらう」ボタン
async function adsRefreshKoalaDiagnosis() {
  const payload = adsBuildDiagnosisPayload();
  const sig = adsBuildDiagnosisSignature(payload);
  delete adsKoalaCache[sig];
  await adsRenderKoalaDiagnosisCard();
}

// ====== 「もっと詳しく聞く」モーダル ======
function adsOpenKoalaDetail() {
  const payload = adsBuildDiagnosisPayload();
  const m = payload.main;
  const c = payload.compare;
  const w = payload.worst;
  const cpData = payload.cpData;

  document.getElementById('adsKoalaDetailPeriod').textContent = `${payload.periodLabel} ／ 対象求人 ${m.rowCount.toLocaleString()}件`;

  // 詳しい診断レポート（より長いテキスト）
  let html = '';
  // 全体サマリー
  html += `<div style="background:#fafdf7;border-left:3px solid #5a8a48;border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:14px;">
    <div style="font-size:13px;font-weight:500;color:#3B6D11;margin-bottom:6px;">📈 全体パフォーマンス</div>
    <div style="font-size:11.5px;color:#444;line-height:1.8;">
      ${escapeHtml(payload.periodLabel)}の運用結果は、表示<strong>${m.imp.toLocaleString()}</strong>回、クリック<strong>${m.click.toLocaleString()}</strong>回、応募開始<strong>${m.apply_start}</strong>件、応募完了<strong style="color:#5a8a48;">${m.apply}</strong>件、費用<strong>¥${Math.round(m.cost).toLocaleString()}</strong>でした。<br>
      CTRは<strong>${(m.ctr * 100).toFixed(2)}%</strong>、応募完了率は<strong>${(m.completion_rate * 100).toFixed(1)}%</strong>。${m.apply > 0 ? `CPAは<strong>¥${Math.round(m.cpa).toLocaleString()}</strong>でした。` : ''}
    </div>
  </div>`;

  // 前期比較
  if (c) {
    const applyDiff = c.apply > 0 ? ((m.apply - c.apply) / c.apply * 100).toFixed(1) : '—';
    const costDiff = c.cost > 0 ? ((m.cost - c.cost) / c.cost * 100).toFixed(1) : '—';
    const cpaCur = m.apply > 0 ? m.cost / m.apply : 0;
    const cpaPrev = c.apply > 0 ? c.cost / c.apply : 0;
    const cpaDiff = cpaPrev > 0 ? ((cpaCur - cpaPrev) / cpaPrev * 100).toFixed(1) : '—';
    html += `<div style="background:#f5f5f3;border-radius:8px;padding:12px 14px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:500;color:#1a1a1a;margin-bottom:6px;">📊 前期との比較</div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <tr><td style="padding:3px 0;color:#666;width:40%;">応募完了数</td><td style="padding:3px 0;color:#1a1a1a;">${m.apply} ← ${c.apply}（${applyDiff !== '—' ? (parseFloat(applyDiff) >= 0 ? '+' : '') + applyDiff + '%' : '—'}）</td></tr>
        <tr><td style="padding:3px 0;color:#666;">費用</td><td style="padding:3px 0;color:#1a1a1a;">¥${Math.round(m.cost).toLocaleString()} ← ¥${Math.round(c.cost).toLocaleString()}（${costDiff !== '—' ? (parseFloat(costDiff) >= 0 ? '+' : '') + costDiff + '%' : '—'}）</td></tr>
        <tr><td style="padding:3px 0;color:#666;">CPA</td><td style="padding:3px 0;color:#1a1a1a;">${cpaCur > 0 ? '¥' + Math.round(cpaCur).toLocaleString() : '—'} ← ${cpaPrev > 0 ? '¥' + Math.round(cpaPrev).toLocaleString() : '—'}（${cpaDiff !== '—' ? (parseFloat(cpaDiff) >= 0 ? '+' : '') + cpaDiff + '%' : '—'}）</td></tr>
      </table>
    </div>`;
  }

  // 改善ポイント
  html += `<div style="background:#fff;border:1px solid #e8ebe9;border-radius:8px;padding:12px 14px;margin-bottom:14px;">
    <div style="font-size:13px;font-weight:500;color:#1a1a1a;margin-bottom:8px;">⚠ 改善ポイント詳細</div>
    <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
      <tr style="border-bottom:0.5px solid #f0f0ee;"><td style="padding:5px 0;color:#666;">①費用かかってるのに応募0</td><td style="padding:5px 0;text-align:right;font-weight:500;color:${w.cost.length > 5 ? '#D85A30' : '#666'};">${w.cost.length}件 ／ ¥${Math.round(w.cost.reduce((s,r)=>s+Number(r.cost||0),0)).toLocaleString()}</td></tr>
      <tr style="border-bottom:0.5px solid #f0f0ee;"><td style="padding:5px 0;color:#666;">②表示多いのにクリックされない</td><td style="padding:5px 0;text-align:right;font-weight:500;color:${w.ctr.length > 3 ? '#BA7517' : '#666'};">${w.ctr.length}件</td></tr>
      <tr style="border-bottom:0.5px solid #f0f0ee;"><td style="padding:5px 0;color:#666;">③クリック多いのに応募開始0</td><td style="padding:5px 0;text-align:right;font-weight:500;color:${w.start.length > 3 ? '#534AB7' : '#666'};">${w.start.length}件</td></tr>
      <tr><td style="padding:5px 0;color:#666;">④応募開始したのに完了率低</td><td style="padding:5px 0;text-align:right;font-weight:500;color:${w.complete.length > 3 ? '#D4537E' : '#666'};">${w.complete.length}件</td></tr>
    </table>
  </div>`;

  // CP別の推奨アクション
  if (cpData && cpData.length >= 2) {
    const sorted = [...cpData].filter(d => d.agg.apply > 0).sort((a, b) => a.agg.cpa - b.agg.cpa);
    if (sorted.length >= 2) {
      html += `<div style="background:#fff;border:1px solid #e8ebe9;border-radius:8px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:500;color:#1a1a1a;margin-bottom:8px;">📣 CP別パフォーマンス</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="border-bottom:1px solid #e8ebe9;color:#666;text-align:left;">
            <th style="padding:5px 4px;font-weight:500;">CP</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">応募</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">CPA</th>
            <th style="padding:5px 4px;font-weight:500;text-align:right;">費用</th>
          </tr></thead>
          <tbody>${sorted.map(d => `<tr style="border-bottom:0.5px solid #f0f0ee;">
            <td style="padding:5px 4px;color:#1a1a1a;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(d.cp)}">${escapeHtml(d.cp.slice(0, 32))}${d.cp.length > 32 ? '…' : ''}</td>
            <td style="padding:5px 4px;text-align:right;font-weight:500;">${d.agg.apply}</td>
            <td style="padding:5px 4px;text-align:right;">¥${Math.round(d.agg.cpa).toLocaleString()}</td>
            <td style="padding:5px 4px;text-align:right;">¥${Math.round(d.agg.cost).toLocaleString()}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    }
  }

  // アクションサマリ
  html += `<div style="background:#fafdf7;border-left:3px solid #5a8a48;border-radius:0 8px 8px 0;padding:12px 14px;">
    <div style="font-size:13px;font-weight:500;color:#3B6D11;margin-bottom:6px;">💡 次のアクション提案</div>
    <div style="font-size:11.5px;color:#444;line-height:1.8;">
      ${w.cost.length > 5 ? `• 応募ゼロで¥${Math.round(w.cost.reduce((s,r)=>s+Number(r.cost||0),0)).toLocaleString()}を消費している${w.cost.length}件の求人を見直し、不要なものは停止<br>` : ''}
      ${w.ctr.length > 0 ? `• CTRが低い${w.ctr.length}件は求人タイトルを見直し、具体的な数字や訴求ポイントを追加<br>` : ''}
      ${w.start.length > 0 ? `• クリックされても応募開始されない${w.start.length}件は求人本文（仕事内容・条件）を改善<br>` : ''}
      ${w.complete.length > 0 ? `• 応募完了率が低い${w.complete.length}件は応募フォームの簡素化を検討<br>` : ''}
      ${cpData && cpData.length >= 2 ? `• 効率の良いCPに予算を寄せて、低効率CPの予算を削減する<br>` : ''}
      • 月次でこの診断を確認し、改善サイクルを回そう
    </div>
  </div>`;

  document.getElementById('adsKoalaDetailBody').innerHTML = html;
  document.getElementById('adsKoalaDetailModal').style.display = 'flex';
}
function adsCloseKoalaDetail() {
  document.getElementById('adsKoalaDetailModal').style.display = 'none';
}
function adsCloseKoalaDetailBg(e) {
  if (e && e.target && e.target.id === 'adsKoalaDetailModal') adsCloseKoalaDetail();
}

// ====== 「コアラに質問」チャット ======
function adsOpenKoalaChat() {
  adsKoalaChatHistory = [];
  // ウェルカムメッセージ
  adsKoalaChatHistory.push({
    role: 'koala',
    text: 'やあ！何か気になることがあったら聞いてね〜！データを見て答えるよ。'
  });
  adsRenderKoalaChat();
  document.getElementById('adsKoalaChatInput').value = '';
  document.getElementById('adsKoalaChatModal').style.display = 'flex';
  setTimeout(() => document.getElementById('adsKoalaChatInput')?.focus(), 100);
}
function adsCloseKoalaChat() {
  document.getElementById('adsKoalaChatModal').style.display = 'none';
}
function adsCloseKoalaChatBg(e) {
  if (e && e.target && e.target.id === 'adsKoalaChatModal') adsCloseKoalaChat();
}

function adsRenderKoalaChat() {
  const body = document.getElementById('adsKoalaChatBody');
  if (!body) return;
  body.innerHTML = adsKoalaChatHistory.map(msg => {
    if (msg.role === 'user') {
      return `<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <div style="background:#5a8a48;color:#fff;padding:8px 12px;border-radius:14px 14px 4px 14px;font-size:12px;max-width:80%;line-height:1.6;">${escapeHtml(msg.text)}</div>
      </div>`;
    } else {
      return `<div style="display:flex;justify-content:flex-start;margin-bottom:8px;gap:6px;align-items:flex-end;">
        <img src="assets/koala-pc.png" alt="コアラ" style="width:28px;height:28px;object-fit:contain;flex-shrink:0;">
        <div style="background:#fff;border:1px solid #e8ebe9;color:#1a1a1a;padding:8px 12px;border-radius:14px 14px 14px 4px;font-size:12px;max-width:80%;line-height:1.7;">${msg.text.replace(/\n/g, '<br>')}</div>
      </div>`;
    }
  }).join('');
  body.scrollTop = body.scrollHeight;
}

// 質問の送信（モック回答）
async function adsAskKoala(presetText) {
  const input = document.getElementById('adsKoalaChatInput');
  const q = presetText || (input ? input.value.trim() : '');
  if (!q) return;
  if (input) input.value = '';

  adsKoalaChatHistory.push({ role: 'user', text: q });
  adsRenderKoalaChat();

  // ローディング表示
  adsKoalaChatHistory.push({ role: 'koala', text: '🤔 考えてるよ…' });
  adsRenderKoalaChat();

  // 少し待つ（演出）
  await new Promise(r => setTimeout(r, 600));

  // 最後の「考えてるよ」を本当の回答に差し替え
  const payload = adsBuildDiagnosisPayload();
  const answer = adsGenerateMockChatAnswer(q, payload);
  adsKoalaChatHistory[adsKoalaChatHistory.length - 1] = { role: 'koala', text: answer };
  adsRenderKoalaChat();
}

// 質問内容に応じて動的に回答を組み立てる
function adsGenerateMockChatAnswer(q, p) {
  const m = p.main;
  const c = p.compare;
  const w = p.worst;
  const cpData = p.cpData;
  const cpaCur = m.apply > 0 ? m.cost / m.apply : 0;
  const cpaPrev = c && c.apply > 0 ? c.cost / c.apply : 0;

  // キーワード判定
  if (/CPA|単価|高い|上が|下が/.test(q)) {
    if (c) {
      const diff = cpaPrev > 0 ? ((cpaCur - cpaPrev) / cpaPrev * 100) : 0;
      if (diff > 5) {
        return `CPAは前期¥${Math.round(cpaPrev).toLocaleString()} → 今期¥${Math.round(cpaCur).toLocaleString()}（+${diff.toFixed(1)}%）と上がってるね。主な要因は：\n` +
               `• 応募ゼロで費用がかかってる求人${w.cost.length}件（¥${Math.round(w.cost.reduce((s,r)=>s+Number(r.cost||0),0)).toLocaleString()}）\n` +
               `• 表示数は伸びてるけどクリック率が${(m.ctr * 100).toFixed(2)}%でやや低い\n` +
               `特に①の低パフォーマンス求人を見直すと、CPA改善できるよ。`;
      } else if (diff < -5) {
        return `CPAは前期¥${Math.round(cpaPrev).toLocaleString()} → 今期¥${Math.round(cpaCur).toLocaleString()}（${diff.toFixed(1)}%）と改善してるよ！✨\n運用が効いてる証拠だね。この調子で続けよう。`;
      }
      return `CPAは前期¥${Math.round(cpaPrev).toLocaleString()} → 今期¥${Math.round(cpaCur).toLocaleString()}でほぼ横ばい。安定運用できてるね。`;
    }
    return `現在のCPAは¥${Math.round(cpaCur).toLocaleString()}。前期データと比較すると変化が分かるから、「比較」モードに切り替えてみて！`;
  }
  if (/予算|配分|どこ|増やす|減らす/.test(q)) {
    if (cpData && cpData.length >= 2) {
      const sorted = [...cpData].filter(d => d.agg.apply > 0).sort((a, b) => a.agg.cpa - b.agg.cpa);
      if (sorted.length >= 2) {
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];
        return `予算配分のヒントだよ！\n\n` +
               `🥇 最も効率の良いCP\n「${best.cp.slice(0,40)}」\nCPA: ¥${Math.round(best.agg.cpa).toLocaleString()}（応募${best.agg.apply}件）\n\n` +
               `🐌 効率が低いCP\n「${worst.cp.slice(0,40)}」\nCPA: ¥${Math.round(worst.agg.cpa).toLocaleString()}（応募${worst.agg.apply}件）\n\n` +
               `差は¥${Math.round(worst.agg.cpa - best.agg.cpa).toLocaleString()}。低効率CPの予算を減らして、高効率CPに寄せると、同じ予算で応募数が増えるよ。`;
      }
    }
    return `予算を最適化するには、まずCP別の効率を見るのがおすすめ！\n• 応募ゼロで費用がかかってる求人（${w.cost.length}件）を停止\n• CPAが安いCPに予算を寄せる\n• 季節要因や採用緊急度に応じて調整\nこの3点を意識してみて！`;
  }
  if (/応募|増やす|少ない/.test(q)) {
    let msg = `応募数を増やすコツだよ！\n\n`;
    if (w.ctr.length > 0) msg += `1️⃣ CTRが低い求人${w.ctr.length}件 → 求人タイトルを見直し（具体的な数字や訴求を追加）\n`;
    if (w.start.length > 0) msg += `2️⃣ クリックされてるのに応募開始0が${w.start.length}件 → 求人本文を魅力的に\n`;
    if (w.complete.length > 0) msg += `3️⃣ 応募完了率が低い${w.complete.length}件 → 応募フォームを簡素化\n`;
    if (w.cost.length > 0) msg += `4️⃣ 応募ゼロで費用がかかってる${w.cost.length}件 → 出稿停止か内容刷新\n`;
    msg += `\n特に1番効果が出やすいのは、求人タイトルの改善だよ。`;
    return msg;
  }
  if (/求人|どれ|タイトル|本文/.test(q)) {
    if (w.cost.length > 0) {
      const top = w.cost[0];
      return `見直すべき求人No.1は「${(top.job_title || '').slice(0, 30)}」だよ。\n¥${Math.round(Number(top.cost) || 0).toLocaleString()}の費用がかかってるのに応募0件。\n` +
             `提案：\n• 求人タイトルを見直す（具体的な仕事内容・特徴を追加）\n• 募集条件をもう一度確認\n• 一旦出稿を停止して、内容を改修してから再開する`;
    }
    return `分析を見て気になる求人があったら、ワーストランキングの「求人 →」リンクから実際のページを確認してみて！具体的な改善点が見えてくるはず。`;
  }
  if (/CTR|クリック率/.test(q)) {
    return `現在のCTRは${(m.ctr * 100).toFixed(2)}%。\n${m.ctr * 100 >= 5 ? '✨ 業界平均（3-5%）と比べても良い水準！' : m.ctr * 100 >= 2 ? '👍 一般的な水準だけど、もう少し伸ばせそう。' : '⚠ ちょっと低いかも。求人タイトルを見直すと改善できるよ。'}`;
  }
  if (/フォーム|応募完了/.test(q)) {
    if (w.complete.length > 0) {
      return `応募完了率が低い求人が${w.complete.length}件あるよ。応募フォームが長すぎる・複雑すぎる場合に起きやすい現象。\n対策：\n• 必須項目を最小限に\n• 履歴書添付を任意にする（電話面談で確認）\n• ファイル形式を制限しすぎない\nまずは詳細ランキングで該当求人を確認してみて。`;
    }
    return `応募完了率は${(m.completion_rate * 100).toFixed(1)}%。${m.completion_rate >= 0.5 ? '✨ 良好です！フォームがちゃんと機能してるね。' : '⚠ もう少し改善余地ありそう。フォーム簡素化を検討してみて。'}`;
  }
  // デフォルト
  return `その質問にはまだうまく答えられないけど、データから言えることは：\n` +
         `• 応募完了 ${m.apply}件 ／ 費用 ¥${Math.round(m.cost).toLocaleString()}\n` +
         `• CPA ${m.apply > 0 ? '¥' + Math.round(m.cpa).toLocaleString() : '—'} ／ CTR ${(m.ctr * 100).toFixed(2)}%\n` +
         `• 改善余地のある求人 ${w.cost.length + w.ctr.length + w.start.length + w.complete.length}件\n\n` +
         `他に「CPAを下げるには？」「予算配分は？」「応募を増やすには？」などの質問もできるよ！`;
}

// ====== 本物のClaude API化のための切替ポイント ======
// 将来この関数を実装して、adsGenerateKoalaDiagnosis内のadsGenerateMockDiagnosis呼び出しを
// 以下に差し替えるだけで本物AI化できる：
//
// async function adsCallClaudeAPI(payload) {
//   const res = await fetch('/api/koala-diagnose', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   });
//   if (!res.ok) throw new Error('API error');
//   const data = await res.json();
//   return data;  // { mood, summary, summaryDetail, insights, generatedAt }
// }
//
// プロキシ側（Supabase Edge Function等）でClaude APIを呼び、
// 同じ形式のJSONを返すように実装。

// グローバル公開
if (typeof window !== 'undefined') {
  window.adsRefreshKoalaDiagnosis = adsRefreshKoalaDiagnosis;
  window.adsOpenKoalaDetail = adsOpenKoalaDetail;
  window.adsCloseKoalaDetail = adsCloseKoalaDetail;
  window.adsCloseKoalaDetailBg = adsCloseKoalaDetailBg;
  window.adsOpenKoalaChat = adsOpenKoalaChat;
  window.adsCloseKoalaChat = adsCloseKoalaChat;
  window.adsCloseKoalaChatBg = adsCloseKoalaChatBg;
  window.adsAskKoala = adsAskKoala;
}

// 起動完了ログ
console.log('[app.js] 読み込み完了');
