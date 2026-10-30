import { createServer as nodeServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractWithAi } from './ai.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'web');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
const headers = { 'x-content-type-options':'nosniff', 'referrer-policy':'no-referrer', 'cache-control':'no-store', 'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };
export async function readLocalKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const content = await readFile(new URL('./.env.local', import.meta.url), 'utf8');
    const line = content.split(/\r?\n/).find(x => /^\s*OPENAI_API_KEY\s*=/.test(x));
    return line?.replace(/^\s*OPENAI_API_KEY\s*=\s*/, '').trim().replace(/^['"]|['"]$/g, '') ?? '';
  } catch { return ''; }
}
function json(res, code, body) { res.writeHead(code, { ...headers, 'content-type':'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
async function bodyText(req) {
  const timeout = setTimeout(() => req.destroy(new Error('Překročen čas pro odeslání požadavku.')), 10000);
  let chunks = [], bytes = 0;
  try {
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 12000) throw new Error('Příliš dlouhý požadavek.'); chunks.push(chunk); }
    return Buffer.concat(chunks).toString('utf8');
  } finally { clearTimeout(timeout); }
}
export function createOfferServer({ apiKey = '', fetchImpl = fetch, model = 'gpt-5.4-mini', maxAiCalls = 20, windowMs = 86400000, now = Date.now } = {}) {
  let active = 0, used = 0, windowStart = now();
  const remaining = () => {
    if (now() - windowStart >= windowMs) { windowStart = now(); used = 0; }
    return Math.max(0, maxAiCalls - used);
  };
  return nodeServer(async (req,res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok:true, aiConfigured: Boolean(apiKey), model, remainingAiCalls: remaining() });
      if (url.pathname === '/api/extract') {
        if (req.method !== 'POST') return json(res, 405, { error:'Nepodporovaná metoda.' });
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) return json(res, 415, { error:'Požadován JSON.' });
        const origin = req.headers.origin;
        if (origin && origin !== `http://127.0.0.1:${req.socket.localPort}`) return json(res, 403, { error:'Nepovolený původ požadavku.' });
        if (active >= 2) return json(res, 429, { error:'Probíhá příliš mnoho extrakcí.' });
        active++;
        try {
          let payload; try { payload = JSON.parse(await bodyText(req)); } catch { return json(res, 400, { error:'Neplatný nebo příliš dlouhý JSON.' }); }
          if (typeof payload.text !== 'string' || payload.text.trim().length < 30 || payload.text.length > 8000) return json(res, 400, { error:'Text nabídky musí mít 30 až 8 000 znaků.' });
          if (!apiKey) return json(res, 503, { error:'AI není na serveru nakonfigurována.' });
          if (!remaining()) return json(res, 429, { error:'Denní limit AI extrakcí byl vyčerpán.' });
          used++;
          try { const result = await extractWithAi(payload.text, { apiKey, fetchImpl, model }); return json(res, 200, { ...result, remainingAiCalls: remaining() }); }
          catch (error) { return json(res, 502, { error: error instanceof Error ? error.message : 'Extrakce selhala.' }); }
        }
        finally { active--; }
      }
      if (!['GET','HEAD'].includes(req.method)) return json(res, 405, { error:'Nepodporovaná metoda.' });
      const decoded = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(root, '.' + decoded);
      if (!file.startsWith(root + path.sep)) return json(res, 403, { error:'Nepovolená cesta.' });
      const data = await readFile(file);
      res.writeHead(200, { ...headers, 'content-type':mime[path.extname(file)] ?? 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) { json(res, error?.code === 'ENOENT' ? 404 : 400, { error:'Požadavek nelze zpracovat.' }); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apiKey = await readLocalKey();
  createOfferServer({ apiKey }).listen(4174, '127.0.0.1', () => console.log('OfferLens: http://127.0.0.1:4174'));
}
