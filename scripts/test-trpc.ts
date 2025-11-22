/**
 * Simple Node.js script to test tRPC router directly
 * Run with: node --loader ts-node/esm scripts/test-trpc.ts
 */

import { appRouter } from '../server/api/root.js';
import { prisma } from '../lib/prisma.js';

async function testCustomerRouter() {
  console.log('🧪 Testing Customer Router...\n');

  // Create mock context
  const mockContext = {
    prisma,
    session: {
      user: {
        id: '1',
        username: 'admin',
        name: 'System Administrator',
        email: 'admin@example.com',
        role: 'ADMIN' as const,
      },
      expires: '2099-01-01',
    },
    headers: new Headers(),
  };

  // Create caller
  const caller = appRouter.createCaller(mockContext);

  try {
    // Test 1: List customers
    console.log('Test 1: customer.list with { page: 1, limit: 50 }');
    const result = await caller.customer.list({ page: 1, limit: 50 });
    console.log('✅ Success!');
    console.log('  - Data length:', result.data.length);
    console.log('  - Meta:', JSON.stringify(result.meta, null, 2));
    console.log('  - First customer:', result.data[0]?.name || 'No customers');
    console.log('');

    // Test 2: List with search
    console.log('Test 2: customer.list with search');
    const searchResult = await caller.customer.list({
      page: 1,
      limit: 50,
      search: 'Company',
    });
    console.log('✅ Success!');
    console.log('  - Found:', searchResult.data.length, 'customers');
    console.log('');

    // Test 3: Create customer
    console.log('Test 3: customer.create');
    const createResult = await caller.customer.create({
      name: 'Test Customer',
      phone: '09123456789',
      email: 'test@example.com',
    });
    console.log('✅ Success!');
    console.log('  - Created ID:', createResult.id);
    console.log('  - Name:', createResult.name);
    console.log('');

    // Test 4: Delete test customer
    console.log('Test 4: customer.delete');
    await caller.customer.delete({ id: createResult.id });
    console.log('✅ Success!');
    console.log('');

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testCustomerRouter();
