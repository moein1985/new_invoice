const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ select: { username: true, role: true } })
  .then(users => {
    console.log(JSON.stringify(users));
    return p.$disconnect();
  })
  .catch(e => {
    console.error(e.message);
    p.$disconnect();
  });
