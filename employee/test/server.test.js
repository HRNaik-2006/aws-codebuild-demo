const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const db = require('../db');
const { app } = require('../server');

let server;
let baseUrl;

before(async () => {
  db.reset();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health endpoint returns 200 OK', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'OK');
});

test('supplier list and admin page are available', async () => {
  const response = await fetch(`${baseUrl}/admin/api/suppliers`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).length, 8);
  const page = await fetch(`${baseUrl}/admin`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /employee · v1/);
});

test('add, update and delete validate supplier input', async () => {
  const invalid = await fetch(`${baseUrl}/admin/api/suppliers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: ' ', email: 'not-an-email' }),
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(Object.keys((await invalid.json()).fields).sort(), ['email', 'name']);

  const tooLong = await fetch(`${baseUrl}/admin/api/suppliers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'x'.repeat(101), email: 'new@supplier.example' }),
  });
  assert.equal(tooLong.status, 400);

  const created = await fetch(`${baseUrl}/admin/api/suppliers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '<img src=x onerror=alert(1)>', email: 'new@supplier.example', city: 'Sydney' }),
  });
  assert.equal(created.status, 201);
  const supplier = await created.json();
  const adminPage = await fetch(`${baseUrl}/admin`);
  const adminHtml = await adminPage.text();
  assert.match(adminHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(adminHtml, /<img src=x onerror=alert\(1\)>/);

  const invalidUpdate = await fetch(`${baseUrl}/admin/api/suppliers/${supplier.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Updated Supplier', email: 'invalid' }),
  });
  assert.equal(invalidUpdate.status, 400);

  const updated = await fetch(`${baseUrl}/admin/api/suppliers/${supplier.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Updated Supplier', email: 'updated@supplier.example' }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).name, 'Updated Supplier');

  const deleted = await fetch(`${baseUrl}/admin/api/suppliers/${supplier.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  assert.equal((await fetch(`${baseUrl}/admin/api/suppliers/${supplier.id}`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/admin/api/suppliers/0`, { method: 'DELETE' })).status, 400);
  const invalidForm = await fetch(`${baseUrl}/admin/add`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'name=&email=invalid',
    redirect: 'manual',
  });
  assert.equal(invalidForm.status, 400);
  assert.match(await invalidForm.text(), /Please provide a name and a valid email/);
});
