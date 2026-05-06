// ============================================================
// チップ式選択UI機能（2026/05/06追加）
// ・性別、応募職種、部署をボタン横並び（チップ）で選択
// ・複数選択モード対応（data-multiple="true"）
// ・hidden input または text input に値を反映（カンマ区切り）
// ・職種マスタはマスター管理から追加・削除可（kind='jobType'）
// ============================================================

// 性別の固定選択肢
const GENDER_CHIPS = ['男性', '女性', 'その他', '未回答'];

// 全チップグループを描画
function renderAllChips() {
  // 性別（単一選択、固定値）
  renderChipGroup('chipsGe', GENDER_CHIPS, false);
  // 応募職種（複数選択、マスタ）
  const jobTypes = (typeof masters !== 'undefined' && masters?.jobType) ? masters.jobType : [];
  renderChipGroup('chipsJT', jobTypes, true);
  // 部署（複数選択、マスタ）
  const depts = (typeof masters !== 'undefined' && masters?.dept) ? masters.dept : [];
  renderChipGroup('chipsDept', depts, true);
}

function renderChipGroup(hostId, options, isMultiple) {
  const host = document.getElementById(hostId);
  if (!host) return;
  host.innerHTML = '';
  if (!options || options.length === 0) {
    if (hostId === 'chipsDept') {
      host.innerHTML = '<span style="font-size:11px;color:#888;font-style:italic;">部署マスタが未設定です。マスター管理→部署タブから追加してください。</span>';
    } else if (hostId === 'chipsJT') {
      host.innerHTML = '<span style="font-size:11px;color:#888;font-style:italic;">職種マスタが未設定です。下の手動入力欄を使うか、マスター管理→職種タブから追加してください。</span>';
    }
    return;
  }
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.dataset.value = opt;
    btn.textContent = opt;
    btn.onclick = () => onChipClick(hostId, opt, isMultiple);
    host.appendChild(btn);
  });
}

function onChipClick(hostId, value, isMultiple) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const targetId = host.dataset.target;
  const targetEl = document.getElementById(targetId);
  if (isMultiple) {
    // 複数選択：トグル
    const btn = host.querySelector(`.chip-btn[data-value="${CSS.escape(value)}"]`);
    if (!btn) return;
    btn.classList.toggle('selected');
    syncChipsToInput(hostId);
  } else {
    // 単一選択：他をオフ、自分をオン
    host.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('selected'));
    const btn = host.querySelector(`.chip-btn[data-value="${CSS.escape(value)}"]`);
    if (btn) btn.classList.add('selected');
    if (targetEl) targetEl.value = value;
    // change イベントを発火（既存のロジックがchange依存している場合に備えて）
    if (targetEl) targetEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// チップグループ → input にカンマ区切りで反映（複数選択用）
function syncChipsToInput(hostId) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const targetId = host.dataset.target;
  const targetEl = document.getElementById(targetId);
  if (!targetEl) return;
  const isMultiple = host.dataset.multiple === 'true';
  if (!isMultiple) return;
  const selected = Array.from(host.querySelectorAll('.chip-btn.selected')).map(b => b.dataset.value);
  // 手動入力欄（type=text）の場合、既存の手動入力値を保持しつつチップ値を統合
  if (targetEl.type === 'text') {
    // 過去に「手動入力」分があれば保持。現在の入力欄の値からチップ値を除いた残りを「手動分」とする
    const existingValues = (targetEl.value || '').split(',').map(s => s.trim()).filter(Boolean);
    const allChipValues = Array.from(host.querySelectorAll('.chip-btn')).map(b => b.dataset.value);
    const manualOnly = existingValues.filter(v => !allChipValues.includes(v));
    const merged = [...selected, ...manualOnly];
    targetEl.value = merged.join(', ');
  } else {
    targetEl.value = selected.join(', ');
  }
}

// input側 → チップに反映（編集モーダル開いた時など、既存値からチップを点灯させる）
function applyValueToChips(hostId, value) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const isMultiple = host.dataset.multiple === 'true';
  // 値の正規化
  const values = isMultiple ?
    String(value || '').split(',').map(s => s.trim()).filter(Boolean) :
    [String(value || '').trim()];
  // 全チップをリセット
  host.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('selected'));
  // 該当する値のチップだけ点灯
  values.forEach(v => {
    if (!v) return;
    const btn = host.querySelector(`.chip-btn[data-value="${CSS.escape(v)}"]`);
    if (btn) btn.classList.add('selected');
  });
  // 手動入力分を保持するため、targetEl.value自体は変えない
}

// resetForm のフックでチップもリセット
(function setupResetFormHookForChips() {
  const orig = window.resetForm;
  if (typeof orig !== 'function') return;
  window.resetForm = function() {
    orig.apply(this, arguments);
    // チップを全部解除
    document.querySelectorAll('.chip-group .chip-btn.selected').forEach(b => b.classList.remove('selected'));
    // 手動入力欄も空に
    const fJT = document.getElementById('fJT');
    if (fJT) fJT.value = '';
    const fGe = document.getElementById('fGe');
    if (fGe) fGe.value = '';
    const fDept2 = document.getElementById('fDept2');
    if (fDept2) fDept2.value = '';
  };
})();

// editApp フック：編集モーダル開いたとき、既存値をチップに反映
(function hookEditAppForChips() {
  const orig = window.editApp;
  if (typeof orig !== 'function') return;
  window.editApp = function(id) {
    const ret = orig.apply(this, arguments);
    try {
      const a = (typeof applicants !== 'undefined' && applicants) ? applicants.find(x => x.id === id) : null;
      if (a) {
        // 性別
        applyValueToChips('chipsGe', a.gender || '');
        const fGe = document.getElementById('fGe');
        if (fGe) fGe.value = a.gender || '';
        // 応募職種（複数対応：カンマ区切り）
        applyValueToChips('chipsJT', a.jobType || '');
        const fJT = document.getElementById('fJT');
        if (fJT) fJT.value = a.jobType || '';
        // 部署
        applyValueToChips('chipsDept', a.dept || '');
        const fDept2 = document.getElementById('fDept2');
        if (fDept2) fDept2.value = a.dept || '';
      }
    } catch (e) {}
    return ret;
  };
})();

// goNewApplicantForm フック：新規登録画面に入った時にチップを描画
(function hookGoNewApplicantFormForChips() {
  const orig = window.goNewApplicantForm;
  if (typeof orig !== 'function') return;
  window.goNewApplicantForm = function() {
    const ret = orig.apply(this, arguments);
    setTimeout(() => renderAllChips(), 50);
    return ret;
  };
})();

// loadMasters後に再描画（マスタ更新時に追従）
(function hookLoadMastersForChips() {
  const orig = window.loadMasters;
  if (typeof orig !== 'function') return;
  window.loadMasters = async function() {
    const ret = await orig.apply(this, arguments);
    setTimeout(() => renderAllChips(), 50);
    return ret;
  };
})();

// ============================================================
// マスター管理「職種」タブの追加サポート
// ・既存のマスタ管理ロジック（媒体・部署と同じ）に乗っかる
// ・switchMmTab('jobType') で動くように、サイドナビボタンを追加する
// ============================================================
(function ensureJobTypeMasterTab() {
  // DOMContentLoaded 後にサイドナビへ「職種」ボタンを追加
  function inject() {
    const sideNav = document.querySelector('.mm-side');
    if (!sideNav) return;
    // 既に追加済みならスキップ
    if (document.querySelector('[data-mm-tab="jobType"]')) return;
    // 「紹介会社」ボタンの後に挿入（部署→紹介会社→職種、の並び）
    const agencyBtn = document.querySelector('[data-mm-tab="agency"]');
    const newBtn = document.createElement('button');
    newBtn.className = 'mm-side-btn';
    newBtn.dataset.mmTab = 'jobType';
    newBtn.setAttribute('onclick', "switchMmTab('jobType')");
    newBtn.innerHTML = `
      <span class="mm-side-icon">💼</span>
      <span class="mm-side-label">職種</span>
      <span class="mm-side-count" id="mmCountJobType">0</span>
    `;
    if (agencyBtn && agencyBtn.parentNode) {
      agencyBtn.parentNode.insertBefore(newBtn, agencyBtn.nextSibling);
    } else {
      sideNav.appendChild(newBtn);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

// switchMmTab フック：jobTypeタブ選択時に件数バッジ更新＋既存ロジックに乗せる
(function hookSwitchMmTabForJobType() {
  const orig = window.switchMmTab;
  if (typeof orig !== 'function') return;
  window.switchMmTab = function(tab) {
    // ★既存のswitchMmTabは tab='media','dept','agency','assignee','status','settings' に対応
    // 'jobType' は未対応なので、直接ここで処理する
    if (tab === 'jobType') {
      // ナビアクティブ切替
      document.querySelectorAll('.mm-side-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector('[data-mm-tab="jobType"]');
      if (btn) btn.classList.add('active');
      // ペイン切替
      document.querySelectorAll('.mm-pane').forEach(p => p.style.display = 'none');
      let pane = document.getElementById('mmPane-jobType');
      if (!pane) {
        // ペインを動的生成
        pane = createJobTypeMasterPane();
      }
      pane.style.display = '';
      renderJobTypeMasterPane();
      return;
    }
    return orig.apply(this, arguments);
  };
})();

function createJobTypeMasterPane() {
  const host = document.querySelector('.mm-content') || document.querySelector('.sec#sec-master section');
  if (!host) return null;
  const pane = document.createElement('div');
  pane.className = 'mm-pane';
  pane.id = 'mmPane-jobType';
  pane.style.display = 'none';
  pane.innerHTML = `
    <div class="mm-pane-header">
      <h3>💼 職種マスター</h3>
      <input type="text" id="jobTypeFilter" placeholder="🔍 絞り込み" oninput="filterJobTypeList(this.value)" style="padding:5px 10px;border:0.5px solid #e0e0e0;border-radius:6px;font-size:11px;width:140px;font-family:inherit;">
    </div>
    <div style="background:#FAEEDA;border-left:3px solid #f9a825;padding:10px 12px;border-radius:0 6px 6px 0;font-size:11px;color:#5F5E5A;line-height:1.6;margin-bottom:12px;">
      💡 応募者新規登録時の職種チップに表示される項目です。<br>
      クライアントごとに管理可能。デフォルトで9種類の職種が登録されています。
    </div>
    <div id="jobTypeList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;"></div>
    <div style="display:flex;gap:6px;">
      <input type="text" id="jobTypeNewInput" placeholder="職種名を追加" style="flex:1;padding:7px 10px;border:0.5px solid #e0e0e0;border-radius:6px;font-size:11px;font-family:inherit;" onkeydown="if(event.key==='Enter'){event.preventDefault();addJobType();}">
      <button onclick="addJobType()" style="padding:7px 16px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:500;">+ 追加</button>
    </div>
  `;
  host.appendChild(pane);
  return pane;
}

function renderJobTypeMasterPane() {
  const list = document.getElementById('jobTypeList');
  const cnt = document.getElementById('mmCountJobType');
  if (!list) return;
  const items = (typeof masters !== 'undefined' && masters?.jobType) ? masters.jobType : [];
  if (cnt) cnt.textContent = items.length;
  list.innerHTML = '';
  if (items.length === 0) {
    list.innerHTML = '<div style="padding:14px;text-align:center;color:#aaa;font-size:11px;font-style:italic;background:#fafafa;border-radius:6px;">職種が未登録です</div>';
    return;
  }
  // 使用件数集計
  const usageCount = {};
  if (typeof applicants !== 'undefined' && applicants) {
    applicants.forEach(a => {
      const types = (a.jobType || '').split(',').map(s => s.trim()).filter(Boolean);
      types.forEach(t => { usageCount[t] = (usageCount[t] || 0) + 1; });
    });
  }
  items.forEach(name => {
    const cnt = usageCount[name] || 0;
    const row = document.createElement('div');
    row.style.cssText = 'background:#f8f8f7;padding:7px 10px;border-radius:5px;display:flex;align-items:center;gap:8px;font-size:11px;';
    row.innerHTML = `
      <span style="cursor:grab;color:#aaa;">⋮⋮</span>
      <span style="flex:1;cursor:pointer;" onclick="renameJobType('${escapeHtmlAttr(name)}')">${escapeHtmlText(name)}</span>
      ${cnt > 0
        ? `<span style="background:#EAF3DE;color:#3B6D11;padding:1px 6px;border-radius:3px;font-size:10px;">${cnt}件使用中</span>`
        : `<span style="background:#FAEEDA;color:#854F0B;padding:1px 6px;border-radius:3px;font-size:10px;">未使用</span>`}
      <button onclick="deleteJobType('${escapeHtmlAttr(name)}')" style="background:transparent;border:none;color:#aaa;font-size:14px;cursor:pointer;line-height:1;">×</button>
    `;
    list.appendChild(row);
  });
}

function escapeHtmlAttr(s) {
  return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
function escapeHtmlText(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function filterJobTypeList(keyword) {
  const list = document.getElementById('jobTypeList');
  if (!list) return;
  const k = (keyword || '').toLowerCase();
  Array.from(list.children).forEach(row => {
    const txt = row.textContent.toLowerCase();
    row.style.display = (!k || txt.includes(k)) ? '' : 'none';
  });
}

async function addJobType() {
  const inp = document.getElementById('jobTypeNewInput');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) return;
  if (!masters.jobType) masters.jobType = [];
  if (masters.jobType.includes(name)) { alert('既に登録されています'); return; }
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  try {
    const { error } = await sb.from('masters').insert({ client_id: cid, type: 'jobType', value: name });
    if (error) { alert('追加失敗: ' + error.message); return; }
    masters.jobType.push(name);
    inp.value = '';
    renderJobTypeMasterPane();
    renderAllChips();
  } catch (e) {
    alert('追加エラー: ' + e.message);
  }
}

async function deleteJobType(name) {
  if (!confirm(`職種「${name}」を削除しますか？\n（既に登録されている応募者の値は残ります）`)) return;
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  try {
    const { error } = await sb.from('masters').delete().eq('client_id', cid).eq('type', 'jobType').eq('value', name);
    if (error) { alert('削除失敗: ' + error.message); return; }
    masters.jobType = masters.jobType.filter(v => v !== name);
    renderJobTypeMasterPane();
    renderAllChips();
  } catch (e) {
    alert('削除エラー: ' + e.message);
  }
}

async function renameJobType(oldName) {
  const newName = prompt(`職種「${oldName}」を新しい名前に変更`, oldName);
  if (!newName || newName === oldName) return;
  if (masters.jobType.includes(newName)) { alert('同名の職種が既に存在します'); return; }
  const cid = (typeof isAdmin !== 'undefined' && isAdmin) ? 'admin' : currentClientId;
  try {
    // masters更新
    await sb.from('masters').update({ value: newName }).eq('client_id', cid).eq('type', 'jobType').eq('value', oldName);
    // 既存応募者のjobTypeフィールドも更新（カンマ区切りに対応）
    const { data: apps } = await sb.from('applicants').select('id, job_type').eq('client_id', cid);
    if (apps) {
      for (const a of apps) {
        const types = (a.job_type || '').split(',').map(s => s.trim());
        if (types.includes(oldName)) {
          const newTypes = types.map(t => t === oldName ? newName : t).join(', ');
          await sb.from('applicants').update({ job_type: newTypes }).eq('id', a.id);
        }
      }
    }
    // ローカル更新
    const idx = masters.jobType.indexOf(oldName);
    if (idx >= 0) masters.jobType[idx] = newName;
    if (typeof loadApplicants === 'function') await loadApplicants();
    renderJobTypeMasterPane();
    renderAllChips();
  } catch (e) {
    alert('リネームエラー: ' + e.message);
  }
}

// ============================================================
// グローバル公開
// ============================================================
if (typeof window !== 'undefined') {
  window.renderAllChips = renderAllChips;
  window.renderChipGroup = renderChipGroup;
  window.applyValueToChips = applyValueToChips;
  window.renderJobTypeMasterPane = renderJobTypeMasterPane;
  window.filterJobTypeList = filterJobTypeList;
  window.addJobType = addJobType;
  window.deleteJobType = deleteJobType;
  window.renameJobType = renameJobType;
}

console.log('[chip-feature] 読み込み完了');
