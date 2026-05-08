// ===========================================================
// 採用コア SPAルーター（History API版）
// ===========================================================
// 目的：URLとセクションを同期させる
//   - /saiyo-core/dashboard ⇔ showSec('dashboard')
//   - /saiyo-core/applicants ⇔ showSec('list')
//   - /saiyo-core/applicants/new ⇔ showSec('add') + goNewApplicantForm()
//   - /saiyo-core/applicants/:id ⇔ openApplicantEdit(id)
//   - リロードしても画面復元
//   - ブラウザ戻る/進む対応
//
// GitHub Pages 対策：
//   - base path（/saiyo-core/）を自動判定
//   - 404.html → index.html リダイレクトで直URLアクセス対応
//   - パスワードリセット（#access_token=...）はSupabase用に予約、ハッシュは触らない
// ===========================================================

(function() {
  'use strict';

  // ===== base path 自動判定 =====
  // GitHub Pages: https://mukaemura.github.io/saiyo-core/  → '/saiyo-core'
  // ローカル: http://localhost:8000/                      → ''
  // index.html を含むパスから判定
  function detectBasePath() {
    const path = window.location.pathname;
    // /saiyo-core/ で始まっていれば /saiyo-core が base
    const ghMatch = path.match(/^(\/[^/]+)\/(?:index\.html)?(?:$|[a-z])/i);
    if (ghMatch && !path.startsWith('/index.html')) {
      // 末尾が index.html だけの場合は base なし
      // たとえば /saiyo-core/index.html → base=/saiyo-core
      // たとえば /index.html → base=''
      const seg = ghMatch[1];
      // GitHub Pages リポジトリ名らしき場合のみ採用（'/' のみ等は除外）
      if (seg.length > 1) return seg;
    }
    return '';
  }

  const BASE = detectBasePath();
  console.log('[router] BASE =', BASE || '(root)');

  // ===== ルート定義 =====
  // パス → セクション + アクション
  // ":id" は動的パラメータ
  const routes = [
    { path: '/login',                    section: null,         action: 'showLogin' },
    { path: '/reset-password',           section: null,         action: 'resetPassword' },
    { path: '/dashboard',                section: 'dashboard' },
    { path: '/applicants',               section: 'list' },
    { path: '/applicants/new',           section: 'add',        action: 'newApplicant' },
    { path: '/applicants/import',        section: 'import' },
    { path: '/applicants/choice',        section: 'add-choice' },
    { path: '/applicants/paste',         section: 'add-paste' },
    { path: '/applicants/:id',           section: 'add',        action: 'editApplicant' },
    { path: '/schedule',                 section: 'schedule' },
    { path: '/analytics',                section: 'analytics' },
    { path: '/minutes',                  section: 'minutes' },
    { path: '/tasks',                    section: 'tasks' },
    { path: '/budget',                   section: 'budget' },
    { path: '/master',                   section: 'master' },
    { path: '/staff',                    section: 'staff' },
    { path: '/admin',                    section: 'admin' },
  ];

  // セクション → パス（逆引き、デフォルトURL）
  const sectionToPath = {
    'dashboard':  '/dashboard',
    'list':       '/applicants',
    'schedule':   '/schedule',
    'analytics':  '/analytics',
    'minutes':    '/minutes',
    'tasks':      '/tasks',
    'budget':     '/budget',
    'master':     '/master',
    'staff':      '/staff',
    'admin':      '/admin',
    'add':        '/applicants/new',
    'add-choice': '/applicants/choice',
    'add-paste':  '/applicants/paste',
    'import':     '/applicants/import',
  };

  // ===== 内部状態 =====
  // ルーター起因で showSec を呼んだことを示すフラグ（無限ループ防止）
  let _routerInternal = false;

  // ===== パスマッチング =====
  function matchRoute(pathOnly) {
    for (const r of routes) {
      if (r.path === pathOnly) return { route: r, params: {} };
      // 動的パラメータマッチ
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

  // ===== 現在のパスを取得（base除去） =====
  function getCurrentPath() {
    let p = window.location.pathname;
    if (BASE && p.startsWith(BASE)) p = p.substring(BASE.length);
    if (!p || p === '/' || p === '/index.html') return '/';
    if (p.endsWith('/index.html')) p = p.replace(/\/index\.html$/, '');
    return p || '/';
  }

  // ===== URLを更新（pushState） =====
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

  // ===== セクション切替時にURLを反映 =====
  // 既存の showSec() から呼ばれる。ルーター起因の場合はスキップ。
  function syncUrlFromSection(sectionId, options) {
    if (_routerInternal) return;
    options = options || {};
    let path;
    // 編集モードの場合は ID 付きパスに
    if (sectionId === 'add' && options.editId) {
      path = '/applicants/' + encodeURIComponent(options.editId);
    } else if (sectionToPath[sectionId]) {
      path = sectionToPath[sectionId];
    } else {
      return; // マッピングがないセクションは無視
    }
    updateUrl(path, options.replace);
  }

  // ===== URLからセクションを復元 =====
  function navigateFromUrl() {
    // ログインしてない場合は触らない（loginScreenが表示されるはず）
    if (!isLoggedIn()) {
      console.log('[router] 未ログイン → URLナビ保留');
      return;
    }

    const pathOnly = getCurrentPath();
    console.log('[router] navigateFromUrl path =', pathOnly);

    // ルートパスはダッシュボードへ
    if (pathOnly === '/' || pathOnly === '') {
      _routerInternal = true;
      try { if (typeof showSec === 'function') showSec('dashboard'); } catch(e) {}
      _routerInternal = false;
      updateUrl('/dashboard', true);
      return;
    }

    const matched = matchRoute(pathOnly);
    if (!matched) {
      console.warn('[router] マッチしないパス:', pathOnly, '→ ダッシュボードへ');
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
        // 応募者編集画面
        if (typeof openApplicantEdit === 'function') {
          openApplicantEdit(params.id);
        } else {
          console.warn('[router] openApplicantEdit が未定義');
        }
      } else if (route.action === 'newApplicant') {
        // 新規登録画面
        if (typeof goNewApplicantForm === 'function') {
          goNewApplicantForm();
        } else if (typeof showSec === 'function') {
          showSec('add');
        }
      } else if (route.section) {
        if (typeof showSec === 'function') showSec(route.section);
      }
    } catch(e) {
      console.error('[router] ナビゲーション例外:', e);
    } finally {
      _routerInternal = false;
    }
  }

  // ===== ログインしているか =====
  function isLoggedIn() {
    // mainAppが表示されてるか、currentClientIdがセットされてるかで判定
    const mainApp = document.getElementById('mainApp');
    if (mainApp && mainApp.style.display !== 'none' && mainApp.style.display !== '') {
      return true;
    }
    if (typeof currentClientId !== 'undefined' && currentClientId) {
      return true;
    }
    return false;
  }

  // ===== ログイン直後にURL復元 =====
  // startApp 完了後に呼び出される
  function onLoginComplete() {
    // 保存していたリダイレクト先があればそこへ
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
    // 現在のURLが意味あるパスなら、そこへ
    const pathOnly = getCurrentPath();
    if (pathOnly && pathOnly !== '/' && pathOnly !== '/login') {
      navigateFromUrl();
      return;
    }
    // それ以外は dashboard へ
    updateUrl('/dashboard', true);
    // showSec('dashboard') は startApp の中で呼ばれている
  }

  // ===== ログイン画面に来た時にURLを保存 =====
  // 未ログインで /applicants にアクセスされた → ログインさせて元のURLへ戻す
  function rememberRedirectIfNeeded() {
    if (isLoggedIn()) return;
    const pathOnly = getCurrentPath();
    if (!pathOnly || pathOnly === '/' || pathOnly === '/login' || pathOnly === '/reset-password') return;
    // パスワードリカバリー中はスキップ
    if (window.location.hash && window.location.hash.includes('type=recovery')) return;
    sessionStorage.setItem('saiyoCoreRedirectAfterLogin', pathOnly);
    console.log('[router] 未ログイン → ログイン後に戻すURLを保存:', pathOnly);
  }

  // ===== popstate（戻る・進む） =====
  window.addEventListener('popstate', function(e) {
    console.log('[router] popstate event');
    if (!isLoggedIn()) return;
    navigateFromUrl();
  });

  // ===== DOMContentLoaded時の初期化 =====
  // app.js が読み込まれた後、Supabaseセッション復元 → startApp の流れの中で
  // onLoginComplete() が呼ばれることを想定
  // ただし、未ログインで直アクセスされた場合は rememberRedirectIfNeeded で保存しておく
  window.addEventListener('DOMContentLoaded', function() {
    // 404.html フォールバック経由でこのページに来た場合、URLを本来のパスに戻す
    try {
      const fallback = sessionStorage.getItem('saiyoCoreSpaFallback');
      if (fallback) {
        sessionStorage.removeItem('saiyoCoreSpaFallback');
        // BASE が付いた状態の本来のURL に書き換え（リロード防止のため replaceState のみ）
        history.replaceState(null, '', BASE + fallback);
        console.log('[router] 404フォールバック経由 → URL復元:', BASE + fallback);
      }
    } catch(e) {}

    // パスワードリカバリーはハッシュベースなので、それ以外をチェック
    if (!window.location.hash || !window.location.hash.includes('type=recovery')) {
      // 短い遅延の後、ログイン状態を確認
      setTimeout(function() {
        if (!isLoggedIn()) {
          rememberRedirectIfNeeded();
        }
      }, 100);
    }
  });

  // ===== 公開API =====
  window.SaiyoRouter = {
    BASE: BASE,
    navigate: function(path, options) {
      // path: '/dashboard' など
      // options.replace: trueで履歴を残さず置換
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

  console.log('[router] router.js 初期化完了');
})();
