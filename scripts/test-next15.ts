/**
 * Test tRPC via HTTP with Next.js 15
 */

async function testHTTPWithNextJS15() {
  console.log('🧪 Testing tRPC with Next.js 15...\n');

  try {
    // Test customer.list (GET request)
    console.log('Test 1: GET /api/trpc/customer.list');
    const listUrl = 'http://localhost:3000/api/trpc/customer.list?input=' + 
      encodeURIComponent(JSON.stringify({ page: 1, limit: 50 }));
    
    const listResponse = await fetch(listUrl, {
      headers: {
        'Cookie': 'next-auth.session-token=test', // In real scenario, need valid session
      },
    });
    
    console.log('Status:', listResponse.status);
    const listData = await listResponse.text();
    console.log('Response:', listData.substring(0, 200));
    console.log('');

    // Test customer.create (POST request)
    console.log('Test 2: POST /api/trpc/customer.create');
    const createData = {
      code: `TEST-${Date.now()}`,
      name: 'Test Customer HTTP',
      phone: '09123456789',
      email: 'test@example.com',
    };

    const createResponse = await fetch('http://localhost:3000/api/trpc/customer.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'next-auth.session-token=test',
      },
      body: JSON.stringify(createData),
    });

    console.log('Status:', createResponse.status);
    const createResponseData = await createResponse.text();
    console.log('Response:', createResponseData.substring(0, 200));
    console.log('');

    console.log('✅ Tests completed!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

testHTTPWithNextJS15();
