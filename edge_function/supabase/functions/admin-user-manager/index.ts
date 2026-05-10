// ========================================
// admin-user-manager Edge Function（v2: update_email追加）
// ========================================
// 採用コア用：admin専用のクライアントユーザー管理
//
// 機能:
//   1. create        : クライアント新規作成（Authユーザー + clients行）
//   2. reset_password: クライアントのパスワードリセット（手入力）
//   3. update_email  : クライアントのメアド変更（Auth + clients同期）
//   4. delete        : クライアント削除（Authユーザー + clients行）
//
// 必須環境変数:
//   SUPABASE_URL              : プロジェクトURL（Dashboardが自動設定）
//   SUPABASE_SERVICE_ROLE_KEY : Service Role Key（Default secrets で自動）
//
// 認可:
//   呼び出し元のJWTを検証し、app_metadata.role === 'admin' のみ許可
// ========================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// CORS ヘッダー（採用コア本番ドメインから呼ばれるため）
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // CORS プリフライト
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    // ─────────────────────────────────────
    // 1. 環境変数取得
    // ─────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Server misconfigured (env missing)' }, 500);
    }

    // ─────────────────────────────────────
    // 2. JWT 取得・検証（呼び出し元のロール確認）
    // ─────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return jsonResponse({ ok: false, error: 'Missing Authorization header' }, 401);
    }

    // service role キーで管理クライアント作成
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // JWT からユーザー情報を取得
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return jsonResponse({ ok: false, error: 'Invalid or expired token' }, 401);
    }

    const callerUser = userData.user;
    const callerRole = callerUser.app_metadata?.role;
    if (callerRole !== 'admin') {
      return jsonResponse({ ok: false, error: 'Forbidden: admin only' }, 403);
    }

    // ─────────────────────────────────────
    // 3. リクエストボディ パース
    // ─────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const action = String(body.action || '').trim();

    // ─────────────────────────────────────
    // 4. アクション分岐
    // ─────────────────────────────────────

    // ───── action: create ─────
    if (action === 'create') {
      const email = String(body.email || '').trim();
      const password = String(body.password || '');
      const clientName = String(body.client_name || '').trim();

      if (!email || !password || !clientName) {
        return jsonResponse({ ok: false, error: 'email / password / client_name は必須です' }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ ok: false, error: 'パスワードは6文字以上にしてください' }, 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ ok: false, error: 'メールアドレスの形式が不正です' }, 400);
      }

      // clients テーブルでメアド重複チェック
      const { data: dupClient } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('client_id', email)
        .maybeSingle();
      if (dupClient) {
        return jsonResponse({ ok: false, error: 'そのメールアドレスは既に登録されています' }, 400);
      }

      // Auth側ユーザー作成
      const { data: createdAuth, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // 確認メール不要
        app_metadata: {}, // 一般クライアントなのでrole未設定
      });
      if (createAuthErr || !createdAuth?.user) {
        return jsonResponse({ ok: false, error: 'Auth作成に失敗: ' + (createAuthErr?.message || 'unknown') }, 500);
      }

      const newAuthUserId = createdAuth.user.id;

      // clients テーブルに INSERT
      const { error: insertErr } = await supabaseAdmin
        .from('clients')
        .insert({
          client_id: email,
          password: password, // adminが見る用に平文保存（既存仕様踏襲）
          name: clientName,
          auth_user_id: newAuthUserId,
        });

      if (insertErr) {
        // clients INSERT失敗ならAuth側もロールバック
        await supabaseAdmin.auth.admin.deleteUser(newAuthUserId).catch(() => {});
        return jsonResponse({ ok: false, error: 'clients登録失敗（ロールバック済）: ' + insertErr.message }, 500);
      }

      return jsonResponse({ ok: true, action: 'create', user_id: newAuthUserId, email });
    }

    // ───── action: reset_password ─────
    if (action === 'reset_password') {
      const userId = String(body.user_id || '').trim();
      const newPassword = String(body.new_password || '');

      if (!userId || !newPassword) {
        return jsonResponse({ ok: false, error: 'user_id / new_password は必須です' }, 400);
      }
      if (newPassword.length < 6) {
        return jsonResponse({ ok: false, error: 'パスワードは6文字以上にしてください' }, 400);
      }

      // 自分自身のリセットはこの経路では拒否（誤操作防止）
      if (userId === callerUser.id) {
        return jsonResponse({ ok: false, error: '自分自身のパスワードはここからは変更できません' }, 400);
      }

      // Auth側パスワード更新
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (updErr) {
        return jsonResponse({ ok: false, error: 'Auth更新失敗: ' + updErr.message }, 500);
      }

      // clients.password も更新（admin見る用、auth_user_id で照合）
      const { error: tblErr } = await supabaseAdmin
        .from('clients')
        .update({ password: newPassword })
        .eq('auth_user_id', userId);
      if (tblErr) {
        // Authは成功してclients側のみ失敗 → 警告だけ返してok
        return jsonResponse({
          ok: true,
          action: 'reset_password',
          warning: 'Authは更新済み、clientsテーブル側の同期失敗: ' + tblErr.message,
        });
      }

      return jsonResponse({ ok: true, action: 'reset_password' });
    }

    // ───── action: update_email ─────
    if (action === 'update_email') {
      const userId = String(body.user_id || '').trim();
      const newEmail = String(body.new_email || '').trim();

      if (!userId || !newEmail) {
        return jsonResponse({ ok: false, error: 'user_id / new_email は必須です' }, 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return jsonResponse({ ok: false, error: 'メールアドレスの形式が不正です' }, 400);
      }

      // 自分自身のメアド変更も拒否（誤操作防止）
      if (userId === callerUser.id) {
        return jsonResponse({ ok: false, error: '自分自身のメアドはここからは変更できません' }, 400);
      }

      // 重複チェック（他のclientsレコードで既に使われていないか）
      const { data: dupRow } = await supabaseAdmin
        .from('clients')
        .select('id, auth_user_id')
        .eq('client_id', newEmail)
        .maybeSingle();
      if (dupRow && dupRow.auth_user_id !== userId) {
        return jsonResponse({ ok: false, error: 'そのメールアドレスは他のクライアントで使用されています' }, 400);
      }

      // Auth側メアド更新（email_confirm:trueで確認メール飛ばさず即時反映）
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: newEmail,
        email_confirm: true,
      });
      if (updErr) {
        return jsonResponse({ ok: false, error: 'Auth更新失敗: ' + updErr.message }, 500);
      }

      // clients.client_id も更新
      const { error: tblErr } = await supabaseAdmin
        .from('clients')
        .update({ client_id: newEmail })
        .eq('auth_user_id', userId);
      if (tblErr) {
        return jsonResponse({
          ok: true,
          action: 'update_email',
          warning: 'Authは更新済み、clientsテーブル側の同期失敗: ' + tblErr.message,
        });
      }

      return jsonResponse({ ok: true, action: 'update_email' });
    }

    // ───── action: delete ─────
    if (action === 'delete') {
      const userId = String(body.user_id || '').trim();
      const clientsRowId = body.clients_row_id; // clients.id（数値想定）

      if (!userId) {
        return jsonResponse({ ok: false, error: 'user_id は必須です' }, 400);
      }

      // 自分自身の削除は拒否
      if (userId === callerUser.id) {
        return jsonResponse({ ok: false, error: '自分自身は削除できません' }, 400);
      }

      // Auth側削除
      const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delAuthErr) {
        return jsonResponse({ ok: false, error: 'Auth削除失敗: ' + delAuthErr.message }, 500);
      }

      // clients テーブルから削除
      let delQuery = supabaseAdmin.from('clients').delete();
      if (clientsRowId !== undefined && clientsRowId !== null) {
        delQuery = delQuery.eq('id', clientsRowId);
      } else {
        delQuery = delQuery.eq('auth_user_id', userId);
      }

      const { error: delTblErr } = await delQuery;
      if (delTblErr) {
        return jsonResponse({
          ok: true,
          action: 'delete',
          warning: 'Authは削除済み、clientsテーブル側の削除失敗: ' + delTblErr.message,
        });
      }

      return jsonResponse({ ok: true, action: 'delete' });
    }

    // ───── 不明な action ─────
    return jsonResponse({ ok: false, error: 'Unknown action: ' + action }, 400);

  } catch (e) {
    return jsonResponse({ ok: false, error: 'Internal error: ' + (e?.message || String(e)) }, 500);
  }
});
