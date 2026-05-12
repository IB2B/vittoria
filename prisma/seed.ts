import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Idempotent seed: ONLY creates the first admin when none exists in the
// database. Subsequent runs are no-ops, even if SEED_MANAGER_PASSWORD has
// changed — so re-running seed in CI/CD doesn't reset a password the user
// updated via /settings/profile. To rotate the seeded password, change it
// in the dashboard (Settings → Profile) instead.
async function main() {
  // If any admin already exists, leave the DB alone.
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: { id: true, email: true },
  });
  if (existingAdmin) {
    console.log(
      `[seed] Admin already exists (${existingAdmin.email}). Skipping seed.`,
    );
    return;
  }

  const email = process.env.SEED_MANAGER_EMAIL;
  const password = process.env.SEED_MANAGER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "No admin in DB and SEED_MANAGER_EMAIL/SEED_MANAGER_PASSWORD aren't set. Provide them once to bootstrap, then you can remove them.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Admin",
      role: Role.ADMIN,
    },
  });
  console.log(`[seed] Bootstrap admin created: ${user.email}`);
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
