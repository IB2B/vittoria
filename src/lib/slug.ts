export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

import { prisma } from "@/lib/db";

export async function uniqueClientSlug(base: string): Promise<string> {
  const root = slugify(base) || "client";
  let candidate = root;
  let i = 2;
  while (await prisma.client.findUnique({ where: { slug: candidate } })) {
    candidate = `${root}-${i++}`;
    if (i > 999) throw new Error("Could not generate a unique slug");
  }
  return candidate;
}
