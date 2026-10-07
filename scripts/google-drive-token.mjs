// Googleドライブ連携（Googleアカウント方式）用のリフレッシュトークンを取得する
//
// 使い方（PCで実行）:
//   node scripts/google-drive-token.mjs <クライアントID> <クライアントシークレット>
//
// 1. ブラウザが開くので、連携に使うGoogleアカウントでログインして許可する
// 2. 画面に表示される GOOGLE_OAUTH_REFRESH_TOKEN を Vercel の環境変数に設定する
//
// 事前準備: Google Cloud で Drive API を有効化し、
//          OAuth クライアントID（種類「デスクトップ アプリ」）を作成しておく。
// ※ 追加ライブラリ不要（npm install なしで実行できる）。Node.js 18 以上。
import http from 'node:http';
import { exec } from 'node:child_process';

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error('使い方: node scripts/google-drive-token.mjs <クライアントID> <クライアントシークレット>');
  process.exit(1);
}

const server = http.createServer();
server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  const redirectUri = `http://127.0.0.1:${port}`;
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/drive',
    });

  server.on('request', async (req, res) => {
    const url = new URL(req.url, redirectUri);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (!code && !error) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (error) {
      res.end(`<p>許可されませんでした（${error}）。ターミナルに戻ってください。</p>`);
      console.error(`\n許可されませんでした: ${error}`);
      server.close();
      process.exit(1);
    }
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokens.error_description || tokens.error || `HTTP ${tokenRes.status}`);
      res.end('<p>取得できました。このタブを閉じて、ターミナルに戻ってください。</p>');
      if (!tokens.refresh_token) {
        console.error('\nリフレッシュトークンが返されませんでした。もう一度実行してください。');
        process.exit(1);
      }
      console.log('\n以下を Vercel の環境変数に設定してください:\n');
      console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`);
      console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`);
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\n※ このトークンはドライブ全体にアクセスできます。チャットやGitHubには貼らないでください。');
    } catch (err) {
      res.end('<p>トークンの取得に失敗しました。ターミナルを確認してください。</p>');
      console.error('\nトークンの取得に失敗しました:', err.message);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });

  console.log('ブラウザでGoogleのログイン画面を開きます。開かない場合は次のURLを開いてください:\n');
  console.log(authUrl + '\n');
  const opener =
    process.platform === 'win32' ? `start "" "${authUrl}"` :
    process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
  exec(opener, () => {});
});
