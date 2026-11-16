const express = require('express');
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 8080);
const APP_VERSION = process.env.APP_VERSION || 'v1';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => console.log(JSON.stringify({
    level: 'info',
    service: 'customer',
    method: req.method,
    path: req.path,
    status: res.statusCode,
    durationMs: Date.now() - startedAt,
  })));
  next();
});

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/api/suppliers', async (req, res, next) => {
  try {
    res.json(await db.list());
  } catch (error) {
    next(error);
  }
});

app.get('/api/suppliers/:id', async (req, res, next) => {
  try {
    const supplier = await db.get(req.params.id);
    supplier ? res.json(supplier) : res.status(404).json({ error: 'Not found' });
  } catch (error) {
    next(error);
  }
});

app.get(['/', '/suppliers'], async (req, res, next) => {
  try {
    const rows = await db.list();
    const body = rows.map((supplier) => `<tr><td>${esc(supplier.id)}</td><td>${esc(supplier.name)}</td><td>${esc(supplier.city)}</td><td>${esc(supplier.country)}</td><td>${esc(supplier.email)}</td><td>${esc(supplier.phone)}</td></tr>`).join('');
    res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Supplier Directory</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#172033;background:#f4f7fb}*{box-sizing:border-box}body{margin:0}.topbar{background:#172b4d;color:white;padding:1rem max(1.25rem,calc((100% - 1120px)/2));display:flex;align-items:center;justify-content:space-between;gap:1rem}.brand{font-weight:700;letter-spacing:.02em}.badge{border:1px solid #7185a5;border-radius:999px;padding:.4rem .8rem;font-size:.85rem}.wrap{max-width:1120px;margin:2.5rem auto;padding:0 1.25rem}h1{margin:.25rem 0;color:#172b4d;font-size:2rem}.muted{color:#64748b}.card{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem;box-shadow:0 8px 24px #172b4d0b}.stats{display:inline-flex;gap:.45rem;margin:1rem 0;color:#334155}.stats strong{color:#172b4d}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:.8rem .7rem;border-bottom:1px solid #e8edf4}th{font-size:.82rem;text-transform:uppercase;letter-spacing:.04em;color:#52627a;background:#f8fafc}tbody tr:hover{background:#f8fafc}footer{margin-top:1.5rem;font-size:.85rem;color:#64748b}@media(max-width:600px){.topbar{align-items:flex-start;flex-direction:column}.wrap{margin:1.5rem auto}h1{font-size:1.6rem}}
</style></head>
<body><header class="topbar"><div class="brand">Supplier Portal <span class="muted" style="color:#cbd5e1">/ Customer</span></div><div class="badge">customer · ${esc(APP_VERSION)}</div></header>
<main class="wrap"><h1>Supplier directory</h1><p class="muted">Browse approved suppliers and their contact details.</p>
<div class="stats">Total suppliers: <strong>${rows.length}</strong></div>
<section class="card"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>City</th><th>Country</th><th>Email</th><th>Phone</th></tr></thead><tbody>${body}</tbody></table></div></section>
<footer>Customer microservice · ${esc(APP_VERSION)}</footer></main></body></html>`);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(JSON.stringify({
    level: 'error',
    service: 'customer',
    method: req.method,
    path: req.path,
    message: error.message,
  }));
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await db.init();
  const server = app.listen(PORT, () => console.log(JSON.stringify({
    level: 'info',
    event: 'started',
    service: 'customer',
    port: PORT,
    version: APP_VERSION,
    database: db.useDb ? 'mysql' : 'memory',
  })));
  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ level: 'info', event: 'shutdown', service: 'customer', signal }));
    server.close(async (error) => {
      try {
        await db.close();
        if (error) throw error;
        console.log(JSON.stringify({ level: 'info', event: 'stopped', service: 'customer' }));
        process.exit(0);
      } catch (shutdownError) {
        console.error(JSON.stringify({ level: 'error', event: 'shutdown_failed', service: 'customer', message: shutdownError.message }));
        process.exit(1);
      }
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'startup_failed', service: 'customer', message: error.message }));
    process.exitCode = 1;
  });
}

module.exports = { app, start };
