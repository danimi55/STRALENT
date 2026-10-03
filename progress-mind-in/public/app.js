'use strict';
const $ = (s, r = document) => r.querySelector(s);
const view = $('#view'), sheet = $('#sheet');
let S = { people: [], clients: [], projects: [] };
let current = 'week', weekOffset = 0, personFilter = '', openProject = null;
const DAY = 864e5;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => iso(new Date());
const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? parse(s).toLocaleDateString('it-IT', o) : '—');
const fmtFull = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
const COLORS = ['#5b3df0', '#0e8a6a', '#c2410c', '#0369a1', '#a21caf', '#b45309', '#be123c', '#4d7c0f'];
const colorOf = (id) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const person = (id) => S.people.find((p) => p.id === id);

async function api(method, url, body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Errore di rete');
  return j;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }
async function load() { S = await api('GET', '/data'); }
async function run(fn, ok) {
  try { await fn(); await load(); if (ok) toast(ok); render(); return true; }
  catch (e) { toast(e.message); return false; }
}

/* ---------- helpers di dominio ---------- */
const progress = (p) => (p.milestones.length ? Math.round(100 * p.milestones.filter((m) => m.done).length / p.milestones.length) : 0);
const isComplete = (p) => p.milestones.length > 0 && p.milestones.every((m) => m.done);
const isLate = (p) => !isComplete(p) && p.due && p.due < todayStr();
function statusPill(p) {
  if (isComplete(p)) return '<span class="pill ok">Completato</span>';
  if (isLate(p)) return '<span class="pill late">In ritardo</span>';
  return '<span class="pill">In corso</span>';
}
const avatars = (p) => `<div class="avs" aria-label="Team">${p.people.map(person).filter(Boolean).map((x) => `<span class="av" style="background:${colorOf(x.id)}" title="${esc(x.name)}">${esc(initials(x.name))}</span>`).join('')}</div>`;
const visible = () => S.projects.filter((p) => !personFilter || p.people.includes(personFilter));
const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999');

function personSelect() {
  return `<label class="sr" style="margin:0"><select id="pf" aria-label="Filtra per persona" style="width:auto;min-height:44px"><option value="">Tutto il team</option>${S.people.map((p) => `<option value="${p.id}" ${p.id === personFilter ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`;
}
function bindFilter() { const el = $('#pf'); if (el) el.onchange = () => { personFilter = el.value; render(); }; }

/* ---------- viste ---------- */
function renderWeek() {
  const now = new Date(); const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + weekOffset * 7);
  const days = [...Array(7)].map((_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
  const t = todayStr(); const ps = visible();
  const cols = days.map((d) => {
    const k = iso(d); const items = [];
    ps.forEach((p) => {
      p.milestones.filter((m) => m.date === k).forEach((m) => items.push(`<button class="item ${m.done ? 'done' : ''} ${!m.done && k < t ? 'late' : ''}" data-open="${p.id}"><b>${esc(m.title)}</b><small>${esc(p.client)} · ${esc(p.name)}</small></button>`));
      if (p.due === k) items.push(`<button class="item due" data-open="${p.id}"><b>Consegna finale</b><small>${esc(p.client)} · ${esc(p.name)}</small></button>`);
    });
    return `<section class="day ${k === t ? 'today' : ''}"><h3>${d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>${items.join('') || '<small style="color:var(--muted)">Nessuna scadenza</small>'}</section>`;
  }).join('');
  const late = [];
  ps.forEach((p) => p.milestones.filter((m) => !m.done && m.date && m.date < iso(mon)).forEach((m) => late.push({ p, m })));
  late.sort((a, b) => a.m.date.localeCompare(b.m.date));
  const range = `${fmt(iso(days[0]))} – ${fmt(iso(days[6]))}`;
  view.innerHTML = `<div class="bar"><div><h1>${weekOffset === 0 ? 'Questa settimana' : weekOffset === 1 ? 'Prossima settimana' : weekOffset === -1 ? 'Settimana scorsa' : 'Settimana'}</h1><p class="sub" style="margin:0">${range}</p></div><span class="sp"></span>
    <div class="bar" style="margin:0"><button class="btn" id="wp" aria-label="Settimana precedente">←</button><button class="btn" id="wt">Oggi</button><button class="btn" id="wn" aria-label="Settimana successiva">→</button>${personSelect()}</div></div>
    <div class="days">${cols}</div>
    ${late.length ? `<h2>Milestone in ritardo</h2><div class="card">${late.map(({ p, m }) => `<button class="item late" data-open="${p.id}"><b>${esc(m.title)}</b><small>${esc(p.client)} · ${esc(p.name)} · era per il ${fmt(m.date)}</small></button>`).join('')}</div>` : ''}`;
  $('#wp').onclick = () => { weekOffset--; render(); }; $('#wn').onclick = () => { weekOffset++; render(); }; $('#wt').onclick = () => { weekOffset = 0; render(); };
  bindFilter();
}

function renderProjects() {
  const ps = visible().sort(byDue);
  const card = (p) => `<button class="card pcard" data-open="${p.id}"><div class="client">${esc(p.client)}${p.jobNumber ? ' · #' + esc(p.jobNumber) : ''}</div>
    <div class="pname">${esc(p.name)}</div><div class="meta">${statusPill(p)}<span>Consegna ${fmtFull(p.due)}</span></div>
    <div class="prog" role="progressbar" aria-valuenow="${progress(p)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress(p)}%"></i></div>
    <div class="meta"><span>${progress(p)}% · ${p.milestones.filter((m) => m.done).length}/${p.milestones.length} milestone</span></div>${avatars(p)}</button>`;
  view.innerHTML = `<div class="bar"><div><h1>Progetti</h1><p class="sub" style="margin:0">${ps.length} ${ps.length === 1 ? 'progetto' : 'progetti'}</p></div><span class="sp"></span>${personSelect()}</div>
    ${ps.length ? `<div class="grid">${ps.map(card).join('')}</div>` : `<div class="empty"><b>Nessun progetto</b>Premi “Nuovo progetto” per iniziare.</div>`}`;
  bindFilter();
}

/* Gantt: rows = [{label, sub, bar:{from,to,cls}, marks:[{date,done,title}], onclick}] */
function gantt(rows, opts = {}) {
  const dates = []; rows.forEach((r) => { if (r.bar) dates.push(r.bar.from, r.bar.to); (r.marks || []).forEach((m) => m.date && dates.push(m.date)); });
  dates.push(todayStr()); const valid = dates.filter(Boolean).sort();
  const min = parse(valid[0]), max = parse(valid[valid.length - 1]);
  const start = new Date(min.getFullYear(), min.getMonth(), min.getDate() - ((min.getDay() + 6) % 7) - 7);
  const end = new Date(max.getFullYear(), max.getMonth(), max.getDate() + 14);
  const days = Math.round((end - start) / DAY), px = opts.fit ? Math.max(5, Math.min(16, Math.floor(opts.fit / days))) : 16, w = days * px;
  const x = (s) => Math.round((parse(s) - start) / DAY) * px + px / 2;
  const months = []; for (let d = new Date(start.getFullYear(), start.getMonth() + (start.getDate() === 1 ? 0 : 1), 1); d < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push(`<span class="g-mo" style="left:${Math.round((d - start) / DAY) * px + 4}px">${d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })}</span>`);
  }
  const t = todayStr();
  const line = `<div class="g-today" style="left:${x(t)}px" title="Oggi"></div>`;
  const body = rows.map((r, i) => `<div class="g-row">${r.open ? `<button class="g-lab" data-open="${r.open}">${esc(r.label)}<small>${esc(r.sub || '')}</small></button>` : `<div class="g-lab">${esc(r.label)}<small>${esc(r.sub || '')}</small></div>`}
    <div class="g-trk" style="width:${w}px;--wk:${7 * px}px">${r.bar && r.bar.from && r.bar.to ? `<div class="g-bar ${r.bar.cls || ''}" style="left:${x(r.bar.from) - px / 2}px;width:${Math.max(px, x(r.bar.to) - x(r.bar.from) + px)}px" title="${fmt(r.bar.from)} → ${fmt(r.bar.to)}"></div>` : ''}
    ${(r.marks || []).filter((m) => m.date).map((m) => `<div class="g-dia ${m.done ? 'done' : ''}" style="left:${x(m.date)}px" title="${esc(m.title)} · ${fmt(m.date)}"></div>`).join('')}</div></div>`).join('');
  return `<div class="gantt" id="${opts.id || ''}"><div class="g" style="--w:${w}px"><div class="g-row g-head"><div class="g-lab">${opts.head || ''}</div><div class="g-trk" style="width:${w}px">${months.join('')}</div></div>
    <div style="position:relative">${body}<div style="position:absolute;left:160px;top:0;bottom:0;width:${w}px;pointer-events:none">${line}</div></div></div></div>
    <div class="legend"><span>◆ milestone</span><span style="color:var(--ok)">◆ completata</span><span style="color:var(--accent)">▮ oggi</span></div>`;
}
const barCls = (p) => (isComplete(p) ? 'ok' : isLate(p) ? 'late' : '');

function renderTimeline() {
  const ps = visible().filter((p) => p.due || p.milestones.some((m) => m.date)).sort(byDue);
  view.innerHTML = `<div class="bar"><div><h1>Timeline</h1><p class="sub" style="margin:0">Tutti i progetti a colpo d'occhio</p></div><span class="sp"></span>${personSelect()}</div>
    ${ps.length ? gantt(ps.map((p) => ({ label: p.name, sub: p.client, open: p.id, bar: { from: p.start || p.due, to: p.due || p.start, cls: barCls(p) }, marks: p.milestones })), { head: 'Progetto' }) : '<div class="empty"><b>Niente da mostrare</b>Aggiungi un progetto con date di consegna.</div>'}`;
  bindFilter();
  const g = $('.gantt'); if (g) { const tl = g.querySelector('.g-today'); if (tl) g.scrollLeft = Math.max(0, parseInt(tl.style.left, 10) - g.clientWidth / 3); }
}

function renderTeam() {
  const t = todayStr();
  view.innerHTML = `<div class="bar"><div><h1>Team</h1><p class="sub" style="margin:0">Le persone dell'agenzia</p></div><span class="sp"></span><button class="btn pri" id="addp">+ Aggiungi persona</button></div>
    ${S.people.length ? `<div class="grid">${S.people.map((p) => {
      const mine = S.projects.filter((x) => x.people.includes(p.id) && !isComplete(x));
      return `<div class="card"><div style="display:flex;gap:12px;align-items:center"><span class="av" style="background:${colorOf(p.id)};width:44px;height:44px;margin:0;font-size:.95rem">${esc(initials(p.name))}</span>
      <div style="flex:1"><div class="pname" style="margin:0">${esc(p.name)}</div><div class="meta">${esc(p.role || 'Ruolo non indicato')}</div></div><button class="btn sm" data-editp="${p.id}">Modifica</button></div>
      <div class="meta" style="margin-top:12px">${mine.length} ${mine.length === 1 ? 'progetto attivo' : 'progetti attivi'}</div>
      ${mine.slice(0, 4).map((x) => `<button class="item" data-open="${x.id}" style="margin-top:6px"><b>${esc(x.name)}</b><small>${esc(x.client)} · consegna ${fmt(x.due)}</small></button>`).join('')}</div>`;
    }).join('')}</div>` : '<div class="empty"><b>Nessuna persona</b>Aggiungi i membri del team per poterli assegnare ai progetti.</div>'}`;
  $('#addp').onclick = () => personForm();
}

/* ---------- finestre ---------- */
function openSheet(html) { sheet.innerHTML = `<div class="sh">${html}</div>`; if (!sheet.open) sheet.showModal(); sheet.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeSheet)); }
function closeSheet() { sheet.close(); openProject = null; }
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
sheet.addEventListener('close', () => { openProject = null; });

function personForm(p) {
  openSheet(`<div class="sh-h"><h1>${p ? 'Modifica persona' : 'Nuova persona'}</h1><button class="x" data-close aria-label="Chiudi">×</button></div>
    <form id="pform"><label for="pn">Nome e cognome</label><input id="pn" type="text" required maxlength="80" value="${esc(p?.name)}" autocomplete="off">
    <label for="pr">Ruolo (facoltativo)</label><input id="pr" type="text" maxlength="80" value="${esc(p?.role)}" placeholder="es. Art Director" autocomplete="off">
    <div class="actions">${p ? '<button type="button" class="btn danger" id="pdel" style="margin-right:auto">Elimina</button>' : ''}<button type="button" class="btn" data-close>Annulla</button><button class="btn pri">Salva</button></div></form>`);
  $('#pform').onsubmit = async (e) => {
    e.preventDefault(); const b = { name: $('#pn').value, role: $('#pr').value };
    if (await run(() => (p ? api('PUT', '/people/' + p.id, b) : api('POST', '/people', b)), 'Salvato')) closeSheet();
  };
  if (p) $('#pdel').onclick = async () => { if (confirm(`Eliminare ${p.name}? Verrà rimosso dai progetti.`) && await run(() => api('DELETE', '/people/' + p.id), 'Persona eliminata')) closeSheet(); };
}

function projectForm(p) {
  const ms = p ? p.milestones : [];
  const msRow = (m = {}) => `<div class="msrow" data-id="${m.id || ''}"><input type="text" class="mt" placeholder="Nome milestone" value="${esc(m.title)}" aria-label="Nome milestone" maxlength="160"><input type="date" class="md" value="${esc(m.date)}" aria-label="Data milestone"><button type="button" class="x" aria-label="Rimuovi milestone">×</button></div>`;
  openSheet(`<div class="sh-h"><h1>${p ? 'Modifica progetto' : 'Nuovo progetto'}</h1><button class="x" data-close aria-label="Chiudi">×</button></div>
    <form id="form">
    <label for="f-client">Cliente</label><input id="f-client" type="text" required list="clients" maxlength="120" value="${esc(p?.client)}" autocomplete="off"><datalist id="clients">${S.clients.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
    <label for="f-name">Nome progetto</label><input id="f-name" type="text" required maxlength="160" value="${esc(p?.name)}" autocomplete="off">
    <div class="row2"><div><label for="f-job">Numero lavoro</label><input id="f-job" type="text" maxlength="60" value="${esc(p?.jobNumber)}" autocomplete="off"></div>
    <div><label for="f-due">Consegna finale</label><input id="f-due" type="date" value="${esc(p?.due)}"></div></div>
    <label for="f-start">Data di inizio</label><input id="f-start" type="date" value="${esc(p?.start || todayStr())}">
    <label id="lp">Persone sul progetto</label>${S.people.length ? `<div class="chips" role="group" aria-labelledby="lp">${S.people.map((x) => `<label class="chip" style="margin:0"><input type="checkbox" value="${x.id}" ${p?.people.includes(x.id) ? 'checked' : ''}><span>${esc(x.name)}</span></label>`).join('')}</div>` : '<p class="sub">Nessuna persona ancora: aggiungile dalla sezione Team.</p>'}
    <label>Milestone</label><div id="mslist">${ms.map(msRow).join('')}</div><button type="button" class="btn sm" id="addms">+ Aggiungi milestone</button>
    <label for="f-notes">Istruzioni e note sul progetto</label><textarea id="f-notes" maxlength="10000">${esc(p?.notes)}</textarea>
    <div class="actions">${p ? '<button type="button" class="btn danger" id="del" style="margin-right:auto">Elimina</button>' : ''}<button type="button" class="btn" data-close>Annulla</button><button class="btn pri">Salva progetto</button></div></form>`);
  const list = $('#mslist');
  const bindRm = () => list.querySelectorAll('.x').forEach((b) => (b.onclick = () => b.parentElement.remove()));
  bindRm();
  $('#addms').onclick = () => { list.insertAdjacentHTML('beforeend', msRow()); bindRm(); list.lastElementChild.querySelector('.mt').focus(); };
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    const old = new Map(ms.map((m) => [m.id, m]));
    const body = {
      client: $('#f-client').value, name: $('#f-name').value, jobNumber: $('#f-job').value, due: $('#f-due').value, start: $('#f-start').value, notes: $('#f-notes').value,
      people: [...sheet.querySelectorAll('.chips input:checked')].map((i) => i.value),
      milestones: [...list.children].map((r) => ({ id: r.dataset.id, title: r.querySelector('.mt').value, date: r.querySelector('.md').value, done: old.get(r.dataset.id)?.done || false })),
    };
    if (body.due && body.start && body.start > body.due && !confirm('La data di inizio è successiva alla consegna. Salvare comunque?')) return;
    const ok = await run(() => (p ? api('PUT', '/projects/' + p.id, body) : api('POST', '/projects', body)), 'Progetto salvato');
    if (ok) { closeSheet(); }
  };
  if (p) $('#del').onclick = async () => { if (confirm(`Eliminare definitivamente “${p.name}” con tutte le milestone e i commenti?`) && await run(() => api('DELETE', '/projects/' + p.id), 'Progetto eliminato')) closeSheet(); };
}

function projectDetail(id) {
  const p = S.projects.find((x) => x.id === id); if (!p) return closeSheet();
  openProject = id;
  const me = localStorage.getItem('mindin-author') || '';
  const rows = [{ label: 'Progetto', sub: `${fmt(p.start)} → ${fmt(p.due)}`, bar: { from: p.start || p.due, to: p.due || p.start, cls: barCls(p) }, marks: [] },
    ...p.milestones.map((m) => ({ label: m.title, sub: fmt(m.date), marks: [m] }))];
  openSheet(`<div class="sh-h"><div><div class="client">${esc(p.client)}${p.jobNumber ? ' · lavoro #' + esc(p.jobNumber) : ''}</div><h1 style="margin-top:2px">${esc(p.name)}</h1><div class="meta">${statusPill(p)}<span>Consegna ${fmtFull(p.due)}</span><span>${progress(p)}% completato</span></div></div><button class="x" data-close aria-label="Chiudi">×</button></div>
    ${avatars(p).replace('class="avs"', 'class="avs" style="margin-bottom:6px"')}
    <div class="bar" style="margin-top:10px"><button class="btn sm" id="edit">Modifica progetto</button></div>
    ${p.notes ? `<h2>Istruzioni e note</h2><div class="notes">${esc(p.notes)}</div>` : ''}
    <h2>Gantt</h2>${p.milestones.length || p.due ? gantt(rows, { head: 'Fasi', fit: 480 }) : '<p class="sub">Aggiungi date e milestone per vedere il Gantt.</p>'}
    <h2>Milestone e stato</h2>
    ${p.milestones.map((m) => `<div class="ms" data-m="${m.id}"><div class="ms-h"><button class="check ${m.done ? 'on' : ''}" data-toggle="${m.id}" aria-label="${m.done ? 'Segna come da fare' : 'Segna come completata'}" aria-pressed="${m.done}">✓</button>
      <div class="t ${m.done ? 'done' : ''}">${esc(m.title)}</div><span class="pill ${!m.done && m.date && m.date < todayStr() ? 'late' : ''}">${fmt(m.date)}</span></div>
      ${m.comments.map((c) => `<div class="cm">${esc(c.text)}<small>${esc(c.author || 'Anonimo')} · ${new Date(c.at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · <a href="#" data-delc="${m.id}:${c.id}" style="color:var(--muted)">elimina</a></small></div>`).join('')}
      <form class="cmform" data-cf="${m.id}"><input type="text" placeholder="Aggiorna lo stato…" aria-label="Commento su ${esc(m.title)}" maxlength="2000" required><button class="btn pri sm">Invia</button>
      <select aria-label="Autore">${S.people.map((x) => `<option ${x.name === me ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="" ${!me ? '' : ''}>Altro</option></select></form></div>`).join('') || '<p class="sub">Nessuna milestone. Aggiungile da “Modifica progetto”.</p>'}`);
  $('#edit').onclick = () => projectForm(p);
  sheet.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = () => { const m = p.milestones.find((x) => x.id === b.dataset.toggle); run(() => api('PATCH', `/projects/${id}/milestones/${m.id}`, { done: !m.done })); }));
  sheet.querySelectorAll('[data-cf]').forEach((f) => (f.onsubmit = (e) => {
    e.preventDefault(); const author = f.querySelector('select').value; localStorage.setItem('mindin-author', author);
    run(() => api('POST', `/projects/${id}/milestones/${f.dataset.cf}/comments`, { text: f.querySelector('input').value, author }), 'Commento aggiunto');
  }));
  sheet.querySelectorAll('[data-delc]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); const [m, c] = a.dataset.delc.split(':'); if (confirm('Eliminare il commento?')) run(() => api('DELETE', `/projects/${id}/milestones/${m}/comments/${c}`)); }));
}

/* ---------- avvio ---------- */
function render() {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === current));
  ({ week: renderWeek, projects: renderProjects, timeline: renderTimeline, team: renderTeam })[current]();
  if (openProject && sheet.open && !sheet.querySelector('#form,#pform')) { const y = sheet.querySelector('.sh')?.scrollTop || 0; projectDetail(openProject); sheet.querySelector('.sh').scrollTop = y; }
}
document.addEventListener('click', (e) => { const o = e.target.closest('[data-open]'); if (o) projectDetail(o.dataset.open); const ep = e.target.closest('[data-editp]'); if (ep) personForm(person(ep.dataset.editp)); });
$('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { current = b.dataset.view; render(); } };
$('#fab').onclick = () => projectForm();

load().then(render).catch(() => { view.innerHTML = '<div class="empty"><b>Server non raggiungibile</b>Riprova tra un momento.</div>'; });
setInterval(() => { if (!document.hidden && !(sheet.open && sheet.querySelector('#form,#pform,.cmform input:focus'))) load().then(render).catch(() => {}); }, 20000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
