/**
 * Test tRPC through HTTP (simulating browser request)
 */

async function testHTTP() {
  console.log('🧪 Testing tRPC via HTTP...\n');

  try {
    // Test without auth (should fail)
    console.log('Test 1: GET /api/trpc/customer.list (no auth)');
    const response1 = await fetch(
      'http://localhost:3000/api/trpc/customer.list?batch=1&input=%7B%220%22%3A%7B%22page%22%3A1%2C%22limit%22%3A50%7D%7D'
    );
    console.log('Status:', response1.status);
    const data1 = await response1.json();
    console.log('Response:', JSON.stringify(data1, null, 2));
    console.log('');

    // Now test with session (simulate logged in user)
    // In reality, we'd need to login first and get a session cookie
    console.log('ℹ️  To test with auth, user needs to login via browser first');
    
  } catch (error) {
    console.error('❌ Test failed:');
    console.error(error);
  }
}

testHTTP();
