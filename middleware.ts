import type { RequestContext } from 'vite-plugin-vercel/server';

export const config = {
  runtime: 'edge',
};

export default function middleware(req: RequestContext): Response | void {
  // 環境変数から認証情報を取得
  const validUser = process.env.BASIC_AUTH_USER;
  const validPass = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数が設定されていない場合は認証をスキップ（開発環境用）
  if (!validUser || !validPass) {
    return;
  }

  // Authorization ヘッダーを取得
  const basicAuth = req.request.headers.get('authorization');

  // 認証ヘッダーがない場合
  if (!basicAuth) {
    return new Response('認証が必要です', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Lstep集計ツール", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  // Basic認証のフォーマットを確認
  const [scheme, encoded] = basicAuth.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    return new Response('認証形式が不正です', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Lstep集計ツール", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  // Base64デコード
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return new Response('認証情報のデコードに失敗しました', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Lstep集計ツール", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  // ユーザー名とパスワードを分離
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return new Response('認証情報の形式が不正です', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Lstep集計ツール", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  const user = decoded.substring(0, separatorIndex);
  const pass = decoded.substring(separatorIndex + 1);

  // 認証チェック
  if (user === validUser && pass === validPass) {
    // 認証成功 - 続行（void返却）
    return;
  }

  // 認証失敗
  return new Response('ユーザー名またはパスワードが正しくありません', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Lstep集計ツール", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
