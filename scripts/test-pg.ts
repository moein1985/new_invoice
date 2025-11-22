import { Pool } from 'pg';
import 'dotenv/config';

async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    const result = await pool.query('SELECT COUNT(*) FROM customers');
    console.log('✅ Connection successful!');
    console.log('   Customers count:', result.rows[0].count);
  } catch (error) {
    console.error('❌ Connection failed:');
    console.error(error);
  } finally {
    await pool.end();
  }
}

testConnection();
