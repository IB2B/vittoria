"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager } from "@/lib/auth-helpers";
import { ALL_BMS, setActiveBm } from "@/lib/business-managers";

const schema = z.object({
  value: z.string().min(1).max(64),
});

export async function setActiveBmAction(formData: FormData) {
  await requireManager();
  const parsed = schema.safeParse({ value: formData.get("value") });
  const v = parsed.success ? parsed.data.value : ALL_BMS;
  await setActiveBm(v);
  revalidatePath("/", "layout");
}
