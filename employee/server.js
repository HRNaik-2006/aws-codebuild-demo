// Employee microservice: add / edit / delete suppliers.
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FIELDS = ['name', 'address', 'city', 'state', 'country', 'email', 'phone'];
const pick = (b) => Object.fromEntries(FIELDS.map((f) => [f, b[f] ?? '']));

app.get('/health', (req, res) => res.status(200).send('OK'));

// JSON API
app.get('/admin/api/suppliers', async (req, res) => res.json(await db.list()));
app.post('/admin/api/suppliers', async (req, res) => res.status(201).json(await db.add(pick(req.body))));
app.put('/admin/api/suppliers/:id', async (req, res) => {
  const r = await db.update(req.params.id, pick(req.body));
  r ? res.json(r) : res.status(404).json({ error: 'Not found' });
});
app.delete('/admin/api/suppliers/:id', async (req, res) => { await db.remove(req.params.id); res.status(204).end(); });

// HTML UI (path-based routing sends /admin* to this service)
const page = (inner) => `<!doctype html><html><head><title>Supplier Admin (Employee)</title>
<style>body{font-family:sans-serif;margin:2rem}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}th{background:#8c4fff;color:#fff}input{margin:2px}</style></head>
<body><h1>Supplier Admin</h1><p>Employee microservice &middot; version ${esc(process.env.APP_VERSION || 'v1')}</p>${inner}</body></html>`;

app.get(['/admin', '/admin/'], async (req, res) => {
  const rows = await db.list();
  const body = rows.map((s) => `<tr><td>${esc(s.id)}</td><td>${esc(s.name)}</td><td>${esc(s.city)}</td><td>${esc(s.country)}</td>
<td><a href="/admin/edit/${esc(s.id)}">Edit</a>
<form method="post" action="/admin/delete/${esc(s.id)}" style="display:inline"><button>Delete</button></form></td></tr>`).join('');
  res.send(page(`<h2>Add supplier</h2><form method="post" action="/admin/add">
${FIELDS.map((f) => `<input name="${f}" placeholder="${f}" required>`).join('')}<button>Add</button></form>
<h2>All suppliers</h2><table><tr><th>ID</th><th>Name</th><th>City</th><th>Country</th><th>Actions</th></tr>${body}</table>`));
});

app.post('/admin/add', async (req, res) => { await db.add(pick(req.body)); res.redirect('/admin'); });

app.get('/admin/edit/:id', async (req, res) => {
  const s = await db.get(req.params.id);
  if (!s) return res.status(404).send(page('<p>Not found</p>'));
  res.send(page(`<h2>Edit supplier ${esc(s.id)}</h2><form method="post" action="/admin/edit/${esc(s.id)}">
${FIELDS.map((f) => `<input name="${f}" value="${esc(s[f])}" required>`).join('')}<button>Save</button></form>`));
});
app.post('/admin/edit/:id', async (req, res) => { await db.update(req.params.id, pick(req.body)); res.redirect('/admin'); });
app.post('/admin/delete/:id', async (req, res) => { await db.remove(req.params.id); res.redirect('/admin'); });

db.init().then(() => app.listen(PORT, () => console.log(`employee service on ${PORT} (db=${db.useDb})`)))
  .catch((e) => { console.error(e); process.exit(1); });
