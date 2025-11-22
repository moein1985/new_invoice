/**
 * Debug tRPC input handling
 */

import { appRouter } from '../server/api/root.js';
import { prisma } from '../lib/prisma.js';

// Simulate what fetchRequestHandler should do
async function simulateHTTPRequest() {
  console.log('🔍 Simulating HTTP request handling...\n');

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

  // Test with the exact same data that frontend sends
  console.log('Test: Calling customer.list with {page: 1, limit: 50}');
  try {
    const result = await caller.customer.list({ page: 1, limit: 50 });
    console.log('✅ SUCCESS!');
    console.log('Data:', result.data.length, 'customers');
    console.log('');
  } catch (error: any) {
    console.log('❌ FAILED:', error.message);
    console.log('');
  }

  // Test customer.create
  const testData = {
    code: '111111',
    name: 'خالی',
    phone: '09151236547',
    email: 'moein.mohseny@gmail.com',
    address: 'احمدآباد ، مصطفی ۲ ، شرکت فروتست سراخر',
  };

  console.log('Test: Calling customer.create with:', testData);
  try {
    const result = await caller.customer.create(testData);
    console.log('✅ SUCCESS!');
    console.log('Created customer:', result.name);
    console.log('');

    // Cleanup
    await prisma.customer.delete({ where: { id: result.id } });
  } catch (error: any) {
    console.log('❌ FAILED:', error.message);
    console.log('');
  }

  await prisma.$disconnect();
}

simulateHTTPRequest();
