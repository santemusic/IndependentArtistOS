import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';

test('HTTP OAuth: PKCE, replay, restart, refresh binding and upstream failures', async () => {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = (socket.address() as any).port; await new Promise<void>(r => socket.close(() => r()));
  const origin = `http://127.0.0.1:${port}`, redirect = 'https://chatgpt.com/connector/oauth/callback';
  const secret = randomBytes(32).toString('hex');
  let child: ChildProcess;
  async function start() {
    child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/oauth-server.ts'], { env: { ...process.env, PORT: String(port), MCP_PUBLIC_URL: origin, MCP_AUTH_TOKEN: secret, NOTION_OAUTH_CLIENT_ID: 'fixture', NOTION_OAUTH_CLIENT_SECRET: 'fixture', NOTION_ARTISTS_DATABASE_ID: 'fixture', NOTION_TASKS_DATABASE_ID: 'fixture', NOTION_ARTIST_ACL_JSON: '{}' }, stdio: ['ignore','pipe','pipe'] });
    await new Promise<void>((resolve, reject) => { child.stdout!.on('data', d => { if (String(d).includes('listening')) resolve(); }); child.once('exit', () => reject(new Error('Test server exited'))); });
  }
  async function stop() { const done = once(child, 'exit'); child.kill('SIGTERM'); await done; }
  const post = (path: string, data: Record<string,string>) => fetch(origin + path, { method:'POST', body: new URLSearchParams(data) });
  await start();
  try {
    assert.equal((await fetch(origin+'/mcp')).status,401);
    assert.equal((await fetch(origin+'/oauth/notion/callback?code=x&state=invalid')).status,400);
    const bad = await fetch(origin+'/oauth/register',{method:'POST',body:JSON.stringify({redirect_uris:['https://evil.example/callback']})}); assert.equal(bad.status,400);
    const registration = await fetch(origin+'/oauth/register',{method:'POST',body:JSON.stringify({redirect_uris:[redirect]})});
    const {client_id} = await registration.json() as any; assert.equal(registration.status,201);
    const verifier='v'.repeat(43), challenge=createHash('sha256').update(verifier).digest('base64url');
    const params=new URLSearchParams({response_type:'code',client_id,redirect_uri:redirect,code_challenge:challenge,code_challenge_method:'S256',resource:origin+'/mcp',scope:'artist_os:read',state:'client-state'});
    const authorize=await fetch(origin+'/oauth/authorize?'+params,{redirect:'manual'}); assert.equal(authorize.status,302);
    const upstream=new URL(authorize.headers.get('location')!); assert.equal(upstream.hostname,'api.notion.com');
    const state=upstream.searchParams.get('state')!;
    for(const code of ['network-error','malformed']) {
      const fail=await fetch(origin+'/oauth/notion/callback?'+new URLSearchParams({state,code}),{redirect:'manual'});
      assert.equal(fail.status,502); assert.equal(await fail.text(),JSON.stringify({error:'request_failed'}));
      assert.equal((await fetch(origin+'/health')).status,200);
    }
    async function code() { const r=await fetch(origin+'/oauth/notion/callback?'+new URLSearchParams({state,code:'success'}),{redirect:'manual'}); assert.equal(r.status,302); const u=new URL(r.headers.get('location')!);assert.equal(u.searchParams.get('state'),'client-state');return u.searchParams.get('code')!; }
    const first=await code();
    const grant={grant_type:'authorization_code',client_id,redirect_uri:redirect,code_verifier:verifier,code:first};
    assert.equal((await post('/oauth/token',{...grant,code_verifier:'x'.repeat(43)})).status,400);
    const response=await post('/oauth/token',grant); assert.equal(response.status,200);const tokens=await response.json() as any;
    assert.equal((await post('/oauth/token',grant)).status,400);
    assert.equal((await post('/oauth/token',{grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:'wrong'})).status,400);
    assert.equal((await post('/oauth/token',{grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id})).status,200);
    const write=await fetch(origin+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'create_task',arguments:{}}})});assert.equal(write.status,403);
    const denied=await fetch(origin+'/mcp',{headers:{Authorization:'Bearer '+tokens.access_token}});assert.equal(denied.status,401);
    const pending=await code();await stop();await start();
    assert.equal((await post('/oauth/token',{...grant,code:pending})).status,400);
    assert.equal((await post('/oauth/token',{grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id})).status,200);
  } finally { await stop(); }
});
