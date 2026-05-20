import type { CookieOptions } from "@supabase/ssr";

/** Cookie payload passed to Supabase SSR `setAll` */
export type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};
