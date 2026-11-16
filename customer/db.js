// Use MySQL only when the complete connection configuration is present.
const useDb = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].every((name) => Boolean(process.env[name]));
let pool;
const sampleData = [
  { name: 'Acme Components', address: '12 Industrial Road', city: 'Sydney', state: 'NSW', country: 'Australia', email: 'sales@acme.example', phone: '+61 2 5550 0101' },
  { name: 'Southern Cross Logistics', address: '84 Harbour Street', city: 'Melbourne', state: 'VIC', country: 'Australia', email: 'contact@southerncross.example', phone: '+61 3 5550 0102' },
  { name: 'Pacific Office Supplies', address: '7 Queen Street', city: 'Brisbane', state: 'QLD', country: 'Australia', email: 'orders@pacificoffice.example', phone: '+61 7 5550 0103' },
  { name: 'Bluegum Industrial', address: '29 Port Road', city: 'Adelaide', state: 'SA', country: 'Australia', email: 'hello@bluegum.example', phone: '+61 8 5550 0104' },
  { name: 'Harbour Technology Group', address: '115 Market Street', city: 'Perth', state: 'WA', country: 'Australia', email: 'sales@harbourtech.example', phone: '+61 8 5550 0105' },
  { name: 'Tasman Packaging', address: '3 Collins Street', city: 'Hobart', state: 'TAS', country: 'Australia', email: 'service@tasmanpack.example', phone: '+61 3 5550 0106' },
  { name: 'Coastal Safety Products', address: '42 Hunter Street', city: 'Newcastle', state: 'NSW', country: 'Australia', email: 'info@coastalsafety.example', phone: '+61 2 5550 0107' },
  { name: 'Red Centre Equipment', address: '16 Todd Mall', city: 'Alice Springs', state: 'NT', country: 'Australia', email: 'orders@redcentre.example', phone: '+61 8 5550 0108' },
];
let mem = sampleData.map((supplier, index) => ({ id: index + 1, ...supplier }));
let nextId = mem.length + 1;

async function init() {
  if (!useDb) return;
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(200) NOT NULL DEFAULT '',
    city VARCHAR(60) NOT NULL DEFAULT '',
    state VARCHAR(60) NOT NULL DEFAULT '',
    country VARCHAR(60) NOT NULL DEFAULT '',
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(40) NOT NULL DEFAULT ''
  )`);
  const values = sampleData.flatMap((supplier) => [
    supplier.name, supplier.address, supplier.city, supplier.state,
    supplier.country, supplier.email, supplier.phone,
  ]);
  const rowPlaceholders = sampleData.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const connection = await pool.getConnection();
  let hasSeedLock = false;
  try {
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 10) AS acquired', ['suppliers-seed']);
    hasSeedLock = Number(lockRows[0].acquired) === 1;
    if (!hasSeedLock) throw new Error('Timed out acquiring the supplier seed lock');
    const [countRows] = await connection.query('SELECT COUNT(*) AS rowCount FROM suppliers');
    if (Number(countRows[0].rowCount) === 0) {
      await connection.query(
        `INSERT INTO suppliers (name, address, city, state, country, email, phone) VALUES ${rowPlaceholders}`,
        values,
      );
      console.log(JSON.stringify({ level: 'info', event: 'database_seeded', service: 'suppliers', rows: sampleData.length }));
    }
  } finally {
    try {
      if (hasSeedLock) await connection.query('SELECT RELEASE_LOCK(?)', ['suppliers-seed']);
    } finally {
      connection.release();
    }
  }
}

async function list() {
  if (!useDb) return mem;
  const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY id');
  return rows;
}

async function get(id) {
  if (!useDb) return mem.find((supplier) => supplier.id === Number(id));
  const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
  return rows[0];
}

async function add(supplier) {
  if (!useDb) {
    const record = { id: nextId++, ...supplier };
    mem.push(record);
    return record;
  }
  const [result] = await pool.query(
    'INSERT INTO suppliers (name, address, city, state, country, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [supplier.name, supplier.address, supplier.city, supplier.state, supplier.country, supplier.email, supplier.phone],
  );
  return { id: result.insertId, ...supplier };
}

async function update(id, supplier) {
  if (!useDb) {
    const index = mem.findIndex((record) => record.id === Number(id));
    if (index < 0) return null;
    mem[index] = { ...mem[index], ...supplier };
    return mem[index];
  }
  await pool.query(
    'UPDATE suppliers SET name = ?, address = ?, city = ?, state = ?, country = ?, email = ?, phone = ? WHERE id = ?',
    [supplier.name, supplier.address, supplier.city, supplier.state, supplier.country, supplier.email, supplier.phone, id],
  );
  return get(id);
}

async function remove(id) {
  if (!useDb) {
    const before = mem.length;
    mem = mem.filter((supplier) => supplier.id !== Number(id));
    return mem.length < before;
  }
  const [result] = await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function close() {
  if (pool) await pool.end();
}

function reset() {
  mem = sampleData.map((supplier, index) => ({ id: index + 1, ...supplier }));
  nextId = mem.length + 1;
}

module.exports = { init, list, get, add, update, remove, close, reset, useDb };
