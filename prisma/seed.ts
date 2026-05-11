import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_MANAGER_EMAIL;
  const password = process.env.SEED_MANAGER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_MANAGER_EMAIL and SEED_MANAGER_PASSWORD must be set in .env before seeding."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.ADMIN },
    create: {
      email,
      passwordHash,
      name: "Admin",
      role: Role.ADMIN,
    },
  });

  console.log(`[seed] Admin user ready: ${user.email}`);
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
