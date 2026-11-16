const express = require('express');
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 8080);
const APP_VERSION = process.env.APP_VERSION || 'v1';
const FIELDS = ['name', 'address', 'city', 'state', 'country', 'email', 'phone'];
const FIELD_LIMITS = { name: 100, address: 200, city: 60, state: 60, country: 60, email: 100, phone: 40 };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const pick = (body) => Object.fromEntries(FIELDS.map((field) => [field, body[field] ?? '']));
const validate = (supplier) => {
  const errors = {};
  if (typeof supplier.name !== 'string' || !supplier.name.trim()) errors.name = 'Name is required.';
  if (typeof supplier.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
    if (typeof supplier[field] !== 'string') {
      errors[field] = 'Must be text.';
    } else if (supplier[field].length > limit) {
      errors[field] = `Must be ${limit} characters or fewer.`;
    }
  }
  return errors;
};

app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(express.json({ limit: '16kb' }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => console.log(JSON.stringify({
    level: 'info',
    service: 'employee',
    method: req.method,
    path: req.path,
    status: res.statusCode,
    durationMs: Date.now() - startedAt,
  })));
  next();
});

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/admin/api/suppliers', async (req, res, next) => {
  try {
    res.json(await db.list());
  } catch (error) {
    next(error);
  }
});

app.get('/admin/api/suppliers/:id', async (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid supplier ID' });
  try {
    const supplier = await db.get(req.params.id);
    supplier ? res.json(supplier) : res.status(404).json({ error: 'Not found' });
  } catch (error) {
    next(error);
  }
});

app.post('/admin/api/suppliers', async (req, res, next) => {
  const supplier = pick(req.body || {});
  const errors = validate(supplier);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', fields: errors });
  try {
    res.status(201).json(await db.add({ ...supplier, name: supplier.name.trim(), email: supplier.email.trim() }));
  } catch (error) {
    next(error);
  }
});

app.put('/admin/api/suppliers/:id', async (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid supplier ID' });
  const supplier = pick(req.body || {});
  const errors = validate(supplier);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', fields: errors });
  try {
    const updated = await db.update(req.params.id, { ...supplier, name: supplier.name.trim(), email: supplier.email.trim() });
    updated ? res.json(updated) : res.status(404).json({ error: 'Not found' });
  } catch (error) {
    next(error);
  }
});

app.delete('/admin/api/suppliers/:id', async (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid supplier ID' });
  try {
    const removed = await db.remove(req.params.id);
    removed ? res.status(204).end() : res.status(404).json({ error: 'Not found' });
  } catch (error) {
    next(error);
  }
});

const page = (inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Supplier Admin</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#172033;background:#f4f7fb}*{box-sizing:border-box}body{margin:0}.topbar{background:#172b4d;color:white;padding:1rem max(1.25rem,calc((100% - 1120px)/2));display:flex;align-items:center;justify-content:space-between;gap:1rem}.brand{font-weight:700;letter-spacing:.02em}.badge{border:1px solid #7185a5;border-radius:999px;padding:.4rem .8rem;font-size:.85rem}.wrap{max-width:1120px;margin:2.5rem auto;padding:0 1.25rem}h1{margin:.25rem 0;color:#172b4d;font-size:2rem}h2{font-size:1.15rem;color:#243b5a;margin:0 0 1rem}.muted{color:#64748b}.card{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem;margin:1.25rem 0;box-shadow:0 8px 24px #172b4d0b}.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}input{width:100%;padding:.68rem .75rem;border:1px solid #cbd5e1;border-radius:7px;font:inherit}input:focus{outline:2px solid #8bb5ff;border-color:#4278c9}button,.button{background:#245eb0;color:white;border:0;border-radius:7px;padding:.65rem .95rem;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}button:hover,.button:hover{background:#174a91}.danger{background:#b42336}.danger:hover{background:#8e1c2b}.actions{display:flex;gap:.45rem;align-items:center}.actions form{margin:0}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:.8rem .7rem;border-bottom:1px solid #e8edf4}th{font-size:.82rem;text-transform:uppercase;letter-spacing:.04em;color:#52627a;background:#f8fafc}footer{margin-top:1.5rem;font-size:.85rem;color:#64748b}.alert{background:#fff1f0;color:#9b1c1c;padding:.8rem 1rem;border-radius:7px;margin:1rem 0}.stats{display:inline-flex;gap:.45rem;color:#334155}.stats strong{color:#172b4d}@media(max-width:600px){.topbar{align-items:flex-start;flex-direction:column}.wrap{margin:1.5rem auto}h1{font-size:1.6rem}}
</style></head>
<body><header class="topbar"><div class="brand">Supplier Portal <span style="color:#cbd5e1">/ Employee Admin</span></div><div class="badge">employee · ${esc(APP_VERSION)}</div></header>
<main class="wrap"><h1>Supplier administration</h1><p class="muted">Manage supplier records and contact information.</p>${inner}
<footer>Employee microservice · ${esc(APP_VERSION)}</footer></main></body></html>`;

const formFields = (supplier = {}) => FIELDS.map((field) => `<label>${field[0].toUpperCase()}${field.slice(1)}<input name="${field}" value="${esc(supplier[field])}" maxlength="${FIELD_LIMITS[field]}" ${field === 'name' || field === 'email' ? 'required' : ''} ${field === 'email' ? 'type="email"' : ''}></label>`).join('');
const formError = 'Please provide a name and a valid email. Check that no field exceeds its character limit.';

app.get(['/admin', '/admin/'], async (req, res, next) => {
  try {
    const rows = await db.list();
    const body = rows.map((supplier) => `<tr><td>${esc(supplier.id)}</td><td>${esc(supplier.name)}</td><td>${esc(supplier.city)}</td><td>${esc(supplier.country)}</td>
<td><div class="actions"><a class="button" href="/admin/edit/${esc(supplier.id)}">Edit</a>
<form method="post" action="/admin/delete/${esc(supplier.id)}"><button class="danger" type="submit">Delete</button></form></div></td></tr>`).join('');
    res.send(page(`<div class="card"><h2>Add supplier</h2><form method="post" action="/admin/add"><div class="form-grid">${formFields()}</div><p><button type="submit">Add supplier</button></p></form></div>
<p class="stats">Total suppliers: <strong>${rows.length}</strong></p><section class="card"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>City</th><th>Country</th><th>Actions</th></tr></thead><tbody>${body}</tbody></table></div></section>`));
  } catch (error) {
    next(error);
  }
});

app.post('/admin/add', async (req, res, next) => {
  const supplier = pick(req.body || {});
  const errors = validate(supplier);
  if (Object.keys(errors).length) return res.status(400).send(page(`<div class="alert" role="alert">${formError}</div><div class="card"><h2>Add supplier</h2><form method="post" action="/admin/add"><div class="form-grid">${formFields(supplier)}</div><p><button type="submit">Add supplier</button></p></form></div>`));
  try {
    await db.add({ ...supplier, name: supplier.name.trim(), email: supplier.email.trim() });
    res.redirect('/admin');
  } catch (error) {
    next(error);
  }
});

app.get('/admin/edit/:id', async (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).send(page('<div class="alert">Invalid supplier ID.</div>'));
  try {
    const supplier = await db.get(req.params.id);
    if (!supplier) return res.status(404).send(page('<div class="alert">Supplier not found.</div>'));
    res.send(page(`<div class="card"><h2>Edit supplier ${esc(supplier.id)}</h2><form method="post" action="/admin/edit/${esc(supplier.id)}"><div class="form-grid">${formFields(supplier)}</div><p><button type="submit">Save changes</button> <a class="button" href="/admin">Cancel</a></p></form></div>`));
  } catch (error) {
    next(error);
  }
});

app.post('/admin/edit/:id', async (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).send(page('<div class="alert">Invalid supplier ID.</div>'));
  const supplier = pick(req.body || {});
  const errors = validate(supplier);
  if (Object.keys(errors).length) {
    return res.status(400).send(page(`<div class="alert" role="alert">${formError}</div><div class="card"><h2>Edit supplier</h2><form method="post" action="/admin/edit/${esc(req.params.id)}"><div class="form-grid">${formFields(supplier)}</div><p><button type="submit">Save changes</button></p></form></div>`));
  }
  try {
    const updated = await db.update(req.params.id, { ...supplier, name: supplier.name.trim(), email: supplier.email.trim() });
    if (!updated) return res.status(404).send(page('<div class="alert">Supplier not found.</div>'));
    res.redirect('/admin');
  } catch (error) {
    next(error);
  }
});

app.post('/admin/delete/:id', async (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).send(page('<div class="alert">Invalid supplier ID.</div>'));
  try {
    const removed = await db.remove(req.params.id);
    if (!removed) return res.status(404).send(page('<div class="alert">Supplier not found.</div>'));
    res.redirect('/admin');
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(JSON.stringify({
    level: 'error',
    service: 'employee',
    method: req.method,
    path: req.path,
    message: error.message,
  }));
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await db.init();
  const server = app.listen(PORT, () => console.log(JSON.stringify({
    level: 'info',
    event: 'started',
    service: 'employee',
    port: PORT,
    version: APP_VERSION,
    database: db.useDb ? 'mysql' : 'memory',
  })));
  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ level: 'info', event: 'shutdown', service: 'employee', signal }));
    server.close(async (error) => {
      try {
        await db.close();
        if (error) throw error;
        console.log(JSON.stringify({ level: 'info', event: 'stopped', service: 'employee' }));
        process.exit(0);
      } catch (shutdownError) {
        console.error(JSON.stringify({ level: 'error', event: 'shutdown_failed', service: 'employee', message: shutdownError.message }));
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
    console.error(JSON.stringify({ level: 'error', event: 'startup_failed', service: 'employee', message: error.message }));
    process.exitCode = 1;
  });
}

module.exports = { app, start };
