'use strict';
// Progress MIND:IN — server senza dipendenze esterne (solo Node >= 18).
// Dati salvati in DATA_DIR/db.json con scrittura atomica.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const MAX_BODY = 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });

let db = { people: [], clients: [], projects: [] };
if (fs.existsSync(DB_FILE)) {
  try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); }
  catch (e) { console.error('db.json illeggibile, avvio interrotto per non sovrascrivere i dati:', e.message); process.exit(1); }
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  // copia di sicurezza giornaliera
  const day = new Date().toISOString().slice(0, 10);
  const bak = path.join(DATA_DIR, `backup-${day}.json`);
  if (!fs.existsSync(bak)) fs.copyFileSync(DB_FILE, bak);
}

const uid = () => crypto.randomBytes(6).toString('hex');
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const long = (v) => (typeof v === 'string' ? v.slice(0, 10000) : '');
const date = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

function rememberClient(name) {
  if (name && !db.clients.some((c) => c.toLowerCase() === name.toLowerCase())) {
    db.clients.push(name);
    db.clients.sort((a, b) => a.localeCompare(b, 'it'));
  }
}

function cleanProject(body, existing) {
  const oldMs = new Map(((existing && existing.milestones) || []).map((m) => [m.id, m]));
  const milestones = (Array.isArray(body.milestones) ? body.milestones : []).slice(0, 100).map((m) => {
    const prev = m && oldMs.get(m.id);
    return {
      id: prev ? prev.id : uid(),
      title: str(m && m.title, 160),
      date: date(m && m.date),
      done: !!(m && m.done),
      comments: prev ? prev.comments : [], // i commenti si gestiscono solo via endpoint dedicato
    };
  }).filter((m) => m.title);
  const ids = new Set(db.people.map((p) => p.id));
  return {
    id: existing ? existing.id : uid(),
    client: str(body.client, 120),
    name: str(body.name, 160),
    jobNumber: str(body.jobNumber, 60),
    start: date(body.start),
    due: date(body.due),
    people: (Array.isArray(body.people) ? body.people : []).filter((p) => ids.has(p)),
    notes: long(body.notes),
    milestones,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // dopo "api"
  const [coll, id, sub, sid, sub2, sid2] = parts;
  const m = req.method;
  try {
    if (coll === 'data' && m === 'GET') return send(res, 200, db);

    if (coll === 'people') {
      if (m === 'POST') {
        const b = await readBody(req); const name = str(b.name, 80);
        if (!name) return send(res, 400, { error: 'Nome obbligatorio' });
        const p = { id: uid(), name, role: str(b.role, 80) };
        db.people.push(p); save(); return send(res, 201, p);
      }
      const p = db.people.find((x) => x.id === id);
      if (!p) return send(res, 404, { error: 'Non trovato' });
      if (m === 'PUT') {
        const b = await readBody(req); const name = str(b.name, 80);
        if (!name) return send(res, 400, { error: 'Nome obbligatorio' });
        p.name = name; p.role = str(b.role, 80); save(); return send(res, 200, p);
      }
      if (m === 'DELETE') {
        db.people = db.people.filter((x) => x.id !== id);
        db.projects.forEach((pr) => { pr.people = pr.people.filter((x) => x !== id); });
        save(); return send(res, 200, { ok: true });
      }
    }

    if (coll === 'projects') {
      if (m === 'POST' && !id) {
        const pr = cleanProject(await readBody(req));
        if (!pr.client || !pr.name) return send(res, 400, { error: 'Cliente e nome progetto sono obbligatori' });
        db.projects.push(pr); rememberClient(pr.client); save(); return send(res, 201, pr);
      }
      const pr = db.projects.find((x) => x.id === id);
      if (!pr) return send(res, 404, { error: 'Non trovato' });
      if (!sub) {
        if (m === 'PUT') {
          const n = cleanProject(await readBody(req), pr);
          if (!n.client || !n.name) return send(res, 400, { error: 'Cliente e nome progetto sono obbligatori' });
          db.projects[db.projects.indexOf(pr)] = n; rememberClient(n.client); save(); return send(res, 200, n);
        }
        if (m === 'DELETE') { db.projects = db.projects.filter((x) => x.id !== id); save(); return send(res, 200, { ok: true }); }
      }
      if (sub === 'milestones') {
        const ms = pr.milestones.find((x) => x.id === sid);
        if (!ms) return send(res, 404, { error: 'Milestone non trovata' });
        if (!sub2 && m === 'PATCH') {
          const b = await readBody(req); ms.done = !!b.done; pr.updatedAt = new Date().toISOString(); save(); return send(res, 200, ms);
        }
        if (sub2 === 'comments') {
          if (m === 'POST') {
            const b = await readBody(req); const text = str(b.text, 2000);
            if (!text) return send(res, 400, { error: 'Commento vuoto' });
            const c = { id: uid(), text, author: str(b.author, 80), at: new Date().toISOString() };
            ms.comments.push(c); pr.updatedAt = c.at; save(); return send(res, 201, c);
          }
          if (m === 'DELETE') {
            ms.comments = ms.comments.filter((c) => c.id !== sid2); save(); return send(res, 200, { ok: true });
          }
        }
      }
    }
    return send(res, 404, { error: 'Endpoint inesistente' });
  } catch (e) {
    return send(res, 400, { error: 'Richiesta non valida' });
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

function authorized(req) {
  if (!APP_PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const given = Buffer.from(h.slice(6), 'base64').toString('utf8');
  const pass = given.slice(given.indexOf(':') + 1);
  const a = crypto.createHash('sha256').update(pass).digest();
  const b = crypto.createHash('sha256').update(APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

http.createServer((req, res) => {
  if (!authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Progress MIND:IN", charset="UTF-8"' });
    return res.end('Autenticazione richiesta');
  }
  const url = new URL(req.url, 'http://x');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }

  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Non trovato'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=300',
    });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`Progress MIND:IN in ascolto su http://localhost:${PORT} (dati in ${DATA_DIR})`));
