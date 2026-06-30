const { PrismaClient } = require("@prisma/client");
const c = new PrismaClient();
const models = Object.keys(c).filter(k => !k.startsWith("_") && !k.startsWith("$"));
console.log("Available models:", models.join(", "));
c.$disconnect();
