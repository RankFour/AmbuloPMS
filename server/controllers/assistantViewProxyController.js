import { URL } from 'url';
import https from 'https';
import http from 'http';

const ALLOWED_HOSTS = new Set([
  'res.cloudinary.com',
]);

function isAllowed(targetUrl) {
  try {
    const u = new URL(targetUrl);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = String(u.hostname || '').toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return true;
    // Also allow subdomains like sub.res.cloudinary.com
    if (host.endsWith('.res.cloudinary.com')) return true;
    return false;
  } catch {
    return false;
  }
}

export async function proxy(req, res) {
  const raw = (req.query && (req.query.url || req.query.u)) || '';
  if (!raw) return res.status(400).json({ error: 'Missing url' });
  if (!isAllowed(raw)) return res.status(400).json({ error: 'URL not allowed' });
  let u;
  try { u = new URL(raw); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  const client = u.protocol === 'https:' ? https : http;
  const headers = {
    'User-Agent': 'AmbuloPMS-Assistant-Proxy/1.0',
    // Hint inline rendering where supported
    'Accept': 'application/pdf, image/*;q=0.9, */*;q=0.8',
  };
  const reqOpts = { method: 'GET', protocol: u.protocol, hostname: u.hostname, port: u.port || undefined, path: u.pathname + (u.search || ''), headers };

  const upstream = client.request(reqOpts, (up) => {
    const ct = up.headers['content-type'] || '';
    const len = up.headers['content-length'];
    const filename = (u.pathname.split('/').pop() || 'file');
    res.setHeader('Content-Type', ct || 'application/octet-stream');
    if (len) res.setHeader('Content-Length', len);
    // Force inline display in browser viewers
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    // Basic caching
    res.setHeader('Cache-Control', 'private, max-age=300');
    up.on('error', (err) => {
      res.status(502).json({ error: 'Upstream error', detail: err.message || String(err) });
    });
    up.pipe(res);
  });
  upstream.on('error', (err) => res.status(502).json({ error: 'Proxy error', detail: err.message || String(err) }));
  upstream.end();
}

export default { proxy };
