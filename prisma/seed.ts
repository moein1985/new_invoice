import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      fullName: 'مدیر سیستم',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.username);

  // Create manager user
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      username: 'manager',
      password: managerPassword,
      fullName: 'مدیر اجرایی',
      role: 'MANAGER',
      isActive: true,
    },
  });
  console.log('✅ Manager user created:', manager.username);

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { username: 'user' },
    update: {},
    create: {
      username: 'user',
      password: userPassword,
      fullName: 'کاربر عادی',
      role: 'USER',
      isActive: true,
    },
  });
  console.log('✅ Regular user created:', user.username);

  // Create sample customers
  const customer1 = await prisma.customer.create({
    data: {
      code: 'CUST001',
      name: 'شرکت تجارت الکترونیک پارس',
      phone: '02177665544',
      email: 'info@pars-trade.com',
      address: 'تهران، میدان ونک، برج سپهر',
    },
  });
  console.log('✅ Sample customer created:', customer1.name);

  const customer2 = await prisma.customer.create({
    data: {
      code: 'CUST002',
      name: 'فروشگاه زنجیره‌ای آپادانا',
      phone: '02188990011',
      email: 'contact@apadana.com',
      address: 'تهران، خیابان آزادی، نبش کوچه پانزده',
    },
  });
  console.log('✅ Sample customer created:', customer2.name);

  console.log('✨ Seeding completed!');
  console.log('\n📝 Login credentials:');
  console.log('Admin: admin / admin123');
  console.log('Manager: manager / manager123');
  console.log('User: user / user123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
