// test.js
const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'pAssword1',
  server: 'localhost',           // no \SQLEXPRESS here
  port: 1433,                    // must be enabled in SQL config
  database: 'EZChildTrack_CustomerDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function testConnection() {
  try {
    let pool = await sql.connect(config);
    console.log('✅ Connected to MSSQL (tedious)!');

    const result = await pool.request().query('SELECT TOP 5 name FROM sys.databases');
    console.log('Databases:', result.recordset);

    pool.close();
  } catch (err) {
    console.error('❌ Connection failed:', err);
  }
}

testConnection();
