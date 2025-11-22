import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting customers with invalid UUIDs...');
  
  const result = await prisma.$executeRawUnsafe(`
    DELETE FROM customers 
    WHERE id IN ('aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  `);
  
  console.log(`Deleted ${result} customers`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
