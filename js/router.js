// ===========================================================
// 採用コア SPAルーター（History API版）
// ===========================================================
// 目的：URLとセクションを同期させる
//   - /dashboard ⇔ showSec('dashboard')
//   - /applicants ⇔ showSec('list')
//   - /applicants/new ⇔ goNewApplicantForm()
//   - /applicants/:id ⇔ openApplicantEdit(id)
//
// base path 対応：
//   - GitHub Pages (mukaemura.github.io/saiyo-core) → base = '/saiyo-core'
//   - カスタムドメイン (app.link-core.co.jp) → base = '' （ルート）
//   - ローカル開発 → base = ''
//
// 2026/5/12 修正：有料広告実績タブ用に /ads ルートを追加
// ===========================================================

(function() {
  'use strict';

  // ===== base path 自動判定 =====
  function detectBasePath() {
    const host = window.location.hostname;
    const path = window.location.pathname;

    // カスタムドメイン or localhost or IP → base なし（ルート運用）
    // github.io ドメインのときだけ、最初のパスセグメントを base とする
    if (host.endsWith('.github.io')) {
      const seg = path.split('/')[1] || '';
      if (seg && seg !== 'index.html' && seg !== '404.html') {
        return '/' + seg;
      }
    }
    return '';
  }

  const BASE = detectBasePath();
  console.log('[router] BASE =', BASE || '(root)', '| host =', window.location.hostname);

  // ===== ルート定義 =====
  const routes = [
    { path: '/login',              section: null,         action: 'showLogin' },
    { path: '/reset-password',     section: null,         action: 'resetPassword' },
    { path: '/home',               section: null,         action: 'modeHome' },
    { path: '/dashboard',          section: 'dashboard' },
    // Step 1: モード直URL対応（各モードのデフォルトセクションへ）
    { path: '/operation',          section: 'list',       action: 'modeOperation' },
    { path: '/analytics-mode',     section: 'analytics',  action: 'modeAnalytics' },
    { path: '/admin-settings',     section: 'master',     action: 'modeAdminSettings' },
    { path: '/applicants',         section: 'list' },
    { path: '/applicants/new',     section: 'add',        action: 'newApplicant' },
    { path: '/applicants/import',  section: 'import' },
    { path: '/applicants/choice',  section: 'add-choice' },
    { path: '/applicants/paste',   section: 'add-paste' },
    { path: '/applicants/:id',     section: 'add',        action: 'editApplicant' },
    { path: '/schedule',           section: 'schedule' },
    { path: '/analytics-dash',     section: 'analytics-dash' },
    { path: '/analytics',          section: 'analytics' },
    { path: '/minutes',            section: 'minutes' },
    { path: '/tasks',              section: 'tasks' },
    { path: '/budget',             section: 'budget' },
    { path: '/ads',                section: 'ads' },
    { path: '/master',             section: 'master' },
    { path: '/staff',              section: 'staff' },
    { path: '/admin',              section: 'admin' },
  ];

  // セクションID → パス
  const sectionToPath = {
    'dashboard':  '/dashboard',
    'list':       '/applicants',
    'schedule':   '/schedule',
    'analytics-dash': '/analytics-dash',
    'analytics':  '/analytics',
    'minutes':    '/minutes',
    'tasks':      '/tasks',
    'budget':     '/budget',
    'ads':        '/ads',
    'master':     '/master',
    'staff':      '/staff',
    'admin':      '/admin',
    'add':        '/applicants/new',
    'add-choice': '/applicants/choice',
    'add-paste':  '/applicants/paste',
    'import':     '/applicants/import',
  };

  // 内部遷移フラグ（無限ループ防止）
  let _routerInternal = false;

  // ===== ルートマッチング =====
  function matchRoute(pathOnly) {
    for (const r of routes) {
      if (r.path === pathOnly) return { route: r, params: {} };
      if (r.path.includes(':')) {
        const re = new RegExp('^' + r.path.replace(/:[a-zA-Z]+/g, '([^/]+)') + '$');
        const m = pathOnly.match(re);
        if (m) {
          const keys = (r.path.match(/:([a-zA-Z]+)/g) || []).map(k => k.substring(1));
          const params = {};
          keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
          return { route: r, params };
        }
      }
    }
    return null;
  }

  // ===== 現在のパス（base を除いた）を取得 =====
  function getCurrentPath() {
    let p = window.location.pathname;
    if (BASE && p.startsWith(BASE)) p = p.substring(BASE.length);
    if (!p || p === '/' || p === '/index.html') return '/';
    if (p.endsWith('/index.html')) p = p.replace(/\/index\.html$/, '');
    return p || '/';
  }

  // ===== URLを更新（pushState or replaceState） =====
  function updateUrl(path, replace) {
    const fullPath = BASE + path;
    const current = window.location.pathname + window.location.search;
    const next = fullPath + window.location.search;
    if (current === next) return;
    try {
      if (replace) {
        history.replaceState({ path }, '', next);
      } else {
        history.pushState({ path }, '', next);
      }
      console.log('[router] updateUrl →', path, replace ? '(replace)' : '(push)');
    } catch(e) {
      console.warn('[router] history API エラー:', e);
    }
  }

  // ===== セクション切替時にURLを同期 =====
  function syncUrlFromSection(sectionId, options) {
    if (_routerInternal) return;
    options = options || {};
    let path;
    if (sectionId === 'add' && options.editId) {
      path = '/applicants/' + encodeURIComponent(options.editId);
    } else if (sectionToPath[sectionId]) {
      path = sectionToPath[sectionId];
    } else {
      return;
    }
    updateUrl(path, options.replace);
  }

  // ===== URLからセクションを切替 =====
  function navigateFromUrl() {
    if (!isLoggedIn()) {
      console.log('[router] 未ログインのため URL ナビゲートスキップ');
      return;
    }
    const pathOnly = getCurrentPath();
    console.log('[router] navigateFromUrl path =', pathOnly);

    if (pathOnly === '/' || pathOnly === '') {
      _routerInternal = true;
      try { if (typeof showSec === 'function') showSec('dashboard'); } catch(e) {}
      _routerInternal = false;
      updateUrl('/dashboard', true);
      return;
    }

    const matched = matchRoute(pathOnly);
    if (!matched) {
      console.warn('[router] マッチなし:', pathOnly, '→ ダッシュボードへ');
      _routerInternal = true;
      try { if (typeof showSec === 'function') showSec('dashboard'); } catch(e) {}
      _routerInternal = false;
      updateUrl('/dashboard', true);
      return;
    }

    const { route, params } = matched;
    _routerInternal = true;
    try {
      if (route.action === 'editApplicant' && params.id) {
        if (typeof openApplicantEdit === 'function') {
          openApplicantEdit(params.id);
        }
      } else if (route.action === 'newApplicant') {
        if (typeof goNewApplicantForm === 'function') {
          goNewApplicantForm();
        } else if (typeof showSec === 'function') {
          showSec('add');
        }
      } else if (route.action === 'modeHome') {
        // モード選択ホーム画面
        if (typeof showModeHome === 'function') showModeHome();
        else if (typeof goHome === 'function') goHome();
      } else if (route.action === 'modeOperation') {
        // Step 1: 採用運用モードへ
        if (typeof setMode === 'function') setMode('operation');
        else if (typeof showSec === 'function') showSec('list');
      } else if (route.action === 'modeAnalytics') {
        if (typeof setMode === 'function') setMode('analytics');
        else if (typeof showSec === 'function') showSec('analytics');
      } else if (route.action === 'modeAdminSettings') {
        if (typeof setMode === 'function') setMode('admin_settings');
        else if (typeof showSec === 'function') showSec('master');
      } else if (route.section) {
        if (typeof showSec === 'function') showSec(route.section);
      }
    } catch(e) {
      console.error('[router] navigateFromUrl エラー:', e);
    } finally {
      _routerInternal = false;
    }
  }

  // ===== ログイン状態判定 =====
  function isLoggedIn() {
    const mainApp = document.getElementById('mainApp');
    if (mainApp && mainApp.style.display !== 'none' && mainApp.style.display !== '') {
      return true;
    }
    if (typeof currentClientId !== 'undefined' && currentClientId) {
      return true;
    }
    return false;
  }

  // ===== ログイン完了後に呼ばれる：保存していたURLへ復帰 =====
  function onLoginComplete() {
    const stored = sessionStorage.getItem('saiyoCoreRedirectAfterLogin');
    if (stored) {
      sessionStorage.removeItem('saiyoCoreRedirectAfterLogin');
      console.log('[router] ログイン後リダイレクト:', stored);
      try {
        history.replaceState({ path: stored }, '', BASE + stored);
      } catch(e) {}
      navigateFromUrl();
      return;
    }
    const pathOnly = getCurrentPath();
    if (pathOnly && pathOnly !== '/' && pathOnly !== '/login') {
      navigateFromUrl();
      return;
    }
    updateUrl('/dashboard', true);
  }

  // ===== 未ログイン時のアクセス先を覚えておく =====
  function rememberRedirectIfNeeded() {
    if (isLoggedIn()) return;
    const pathOnly = getCurrentPath();
    if (!pathOnly || pathOnly === '/' || pathOnly === '/login' || pathOnly === '/reset-password') return;
    if (window.location.hash && window.location.hash.includes('type=recovery')) return;
    sessionStorage.setItem('saiyoCoreRedirectAfterLogin', pathOnly);
    console.log('[router] 未ログイン → リダイレクト先記憶:', pathOnly);
  }

  // ===== popstate（ブラウザの戻る/進む） =====
  window.addEventListener('popstate', function(e) {
    console.log('[router] popstate event');
    if (!isLoggedIn()) return;
    navigateFromUrl();
  });

  // ===== DOMContentLoaded：初期化 =====
  window.addEventListener('DOMContentLoaded', function() {
    // 404.html → SPAフォールバックでURLを復帰
    try {
      const fallback = sessionStorage.getItem('saiyoCoreSpaFallback');
      if (fallback) {
        sessionStorage.removeItem('saiyoCoreSpaFallback');
        history.replaceState(null, '', BASE + fallback);
        console.log('[router] 404フォールバック → URL復帰:', BASE + fallback);
      }
    } catch(e) {}

    if (!window.location.hash || !window.location.hash.includes('type=recovery')) {
      setTimeout(function() {
        if (!isLoggedIn()) {
          rememberRedirectIfNeeded();
        }
      }, 100);
    }
  });

  // ===== 外部公開API =====
  window.SaiyoRouter = {
    BASE: BASE,
    navigate: function(path, options) {
      updateUrl(path, options && options.replace);
      _routerInternal = true;
      try {
        navigateFromUrl();
      } finally {
        _routerInternal = false;
      }
    },
    syncUrlFromSection: syncUrlFromSection,
    navigateFromUrl: navigateFromUrl,
    onLoginComplete: onLoginComplete,
    rememberRedirectIfNeeded: rememberRedirectIfNeeded,
    getCurrentPath: getCurrentPath,
    isLoggedIn: isLoggedIn
  };

  console.log('[router] router.js 読み込み完了');
})();
