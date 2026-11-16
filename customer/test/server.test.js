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

test('supplier APIs and directory page return the sample suppliers safely', async () => {
  const response = await fetch(`${baseUrl}/api/suppliers`);
  assert.equal(response.status, 200);
  const suppliers = await response.json();
  assert.equal(suppliers.length, 8);
  assert.equal((await fetch(`${baseUrl}/api/suppliers/1`)).status, 200);
  const page = await fetch(`${baseUrl}/suppliers`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Customer microservice/);
  assert.match(html, /Total suppliers: <strong>8<\/strong>/);
  assert.match(html, /customer · v[0-9]+/);
});
