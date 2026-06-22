const mysql = require('mysql2/promise');
async function test() {
  try {
    const con = await mysql.createConnection({ host: 'localhost', user: 'root', password: '' });
    console.log('SUCCESS');
    await con.end();
  } catch(e) { 
    console.log('ERROR:', e.message); 
  }
}
test();
