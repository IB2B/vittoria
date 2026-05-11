// Shared constants safe for both server and client modules.
// (Anything using `next/headers` must live in business-managers.ts instead.)

export const ALL_BMS = "__all__" as const;

export type BmOption = {
  id: string;
  name: string;
  clientCount: number;
};
