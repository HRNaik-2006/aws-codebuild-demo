// Data layer: MySQL (RDS) when DB_HOST is set, otherwise in-memory sample data for local tests.
const useDb = !!process.env.DB_HOST;
let pool;
let mem = [
  { id: 1, name: 'Acme Components', address: '12 Industrial Rd', city: 'Bengaluru', state: 'Karnataka', country: 'India', email: 'sales@acme.example', phone: '080-1111111' },
  { id: 2, name: 'Globex Supplies', address: '5 Harbour St', city: 'Sydney', state: 'NSW', country: 'Australia', email: 'hello@globex.example', phone: '02-2222222' },
];
let nextId = 3;

async function init() {
  if (!useDb) return;
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'suppliers',
    waitForConnections: true,
    connectionLimit: 5,
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), address VARCHAR(200),
    city VARCHAR(60), state VARCHAR(60), country VARCHAR(60), email VARCHAR(100), phone VARCHAR(40))`);
}

async function list() {
  if (!useDb) return mem;
  const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY id');
  return rows;
}
async function get(id) {
  if (!useDb) return mem.find((s) => s.id === Number(id));
  const [rows] = await pool.query('SELECT * FROM suppliers WHERE id=?', [id]);
  return rows[0];
}
async function add(s) {
  if (!useDb) { const r = { id: nextId++, ...s }; mem.push(r); return r; }
  const [res] = await pool.query(
    'INSERT INTO suppliers (name,address,city,state,country,email,phone) VALUES (?,?,?,?,?,?,?)',
    [s.name, s.address, s.city, s.state, s.country, s.email, s.phone]);
  return { id: res.insertId, ...s };
}
async function update(id, s) {
  if (!useDb) { const i = mem.findIndex((x) => x.id === Number(id)); if (i < 0) return null; mem[i] = { ...mem[i], ...s }; return mem[i]; }
  await pool.query('UPDATE suppliers SET name=?,address=?,city=?,state=?,country=?,email=?,phone=? WHERE id=?',
    [s.name, s.address, s.city, s.state, s.country, s.email, s.phone, id]);
  return get(id);
}
async function remove(id) {
  if (!useDb) { mem = mem.filter((x) => x.id !== Number(id)); return; }
  await pool.query('DELETE FROM suppliers WHERE id=?', [id]);
}

module.exports = { init, list, get, add, update, remove, useDb };
