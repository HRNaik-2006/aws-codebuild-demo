// Customer microservice: read-only supplier directory.
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Health check used by the ALB target group
app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/api/suppliers', async (req, res) => {
  try { res.json(await db.list()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/suppliers/:id', async (req, res) => {
  try {
    const s = await db.get(req.params.id);
    s ? res.json(s) : res.status(404).json({ error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Path-based routing sends /suppliers* to this service
app.get(['/', '/suppliers'], async (req, res) => {
  try {
    const rows = await db.list();
    const body = rows.map((s) => `<tr><td>${esc(s.id)}</td><td>${esc(s.name)}</td><td>${esc(s.city)}</td><td>${esc(s.country)}</td><td>${esc(s.email)}</td><td>${esc(s.phone)}</td></tr>`).join('');
    res.send(`<!doctype html><html><head><title>Suppliers (Customer)</title>
<style>body{font-family:sans-serif;margin:2rem}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}th{background:#232f3e;color:#fff}</style></head>
<body><h1>Supplier Directory</h1><p>Customer microservice &middot; version ${esc(process.env.APP_VERSION || 'v1')}</p>
<table><tr><th>ID</th><th>Name</th><th>City</th><th>Country</th><th>Email</th><th>Phone</th></tr>${body}</table></body></html>`);
  } catch (e) { res.status(500).send('Error: ' + esc(e.message)); }
});

db.init().then(() => app.listen(PORT, () => console.log(`customer service on ${PORT} (db=${db.useDb})`)))
  .catch((e) => { console.error(e); process.exit(1); });
