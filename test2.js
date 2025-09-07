// test1.js
const sql = require('mssql/msnodesqlv8');

const config = {
  server: 'localhost\\SQLEXPRESS',   // named instance works here
  database: 'EZChildTrack_CustomerDB',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: false,        // set true for Windows Auth
    trustServerCertificate: true
  },
  user: 'sa',
  password: 'pAssword1'
};

async function testConnection() {
  try {
    const pool = await sql.connect(config);
    console.log('✅ Connected to MSSQL using msnodesqlv8!');

    const result = await pool.request().query('SELECT TOP 5 name FROM sys.databases');
    console.log('Databases:', result.recordset);

    await pool.close();
  } catch (err) {
    console.error('❌ Connection failed:', err);
  }
}

testConnection();
