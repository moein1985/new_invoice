const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
    return;
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      fullName: 'مدیر سیستم',
      role: 'ADMIN',
      email: 'admin@system.local',
      phone: '09123456789',
    },
  });

  console.log('✅ Admin user created successfully');
  console.log('📋 Login credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
