// Test-only upstream. Never imported by production code.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) === 'https://api.notion.com/v1/oauth/token') {
    const body = JSON.parse(String(init?.body));
    if (body.code === 'network-error') throw new Error('SENSITIVE_PROVIDER_ERROR');
    if (body.code === 'malformed') return new Response('not-json');
    return Response.json({ access_token: 'fixture-notion-token', workspace_id: 'fixture-workspace', owner: { user: { id: 'fixture-owner' } } });
  }
  return realFetch(url, init);
};
await import('../../src/server.js');
