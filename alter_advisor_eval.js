const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    
    await pool.query(`
      ALTER TABLE advisor_evaluations 
        ADD COLUMN c12 INT NULL AFTER c11,
        ADD COLUMN c13 INT NULL AFTER c12,
        ADD COLUMN c14 INT NULL AFTER c13,
        ADD COLUMN c15 INT NULL AFTER c14,
        ADD COLUMN c16 INT NULL AFTER c15,
        ADD COLUMN c17 INT NULL AFTER c16,
        ADD COLUMN s11 INT NULL AFTER s10,
        ADD COLUMN s12 INT NULL AFTER s11,
        ADD COLUMN s13 INT NULL AFTER s12,
        ADD COLUMN s14 INT NULL AFTER s13,
        ADD COLUMN s15 INT NULL AFTER s14,
        ADD COLUMN s16 INT NULL AFTER s15,
        ADD COLUMN s17 INT NULL AFTER s16,
        ADD COLUMN s18 INT NULL AFTER s17,
        ADD COLUMN s19 INT NULL AFTER s18,
        ADD COLUMN s20 INT NULL AFTER s19;
    `);
    console.log('advisor_evaluations table altered.');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist.');
      process.exit(0);
    }
    console.error(error);
    process.exit(1);
  }
})();
