// Sentinel passed in form data to represent the legacy "Unassigned" bucket
// (ad accounts imported before businessId tracking landed). Lives in its own
// file so the "use server" rule on actions.ts (no non-async exports) holds.
export const UNASSIGNED_BM = "__unassigned__" as const;
