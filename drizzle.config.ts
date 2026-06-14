import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit (unlike Next.js) does not auto-load env files, so load
// .env.local explicitly before reading DATABASE_URL.
config({ path: ".env.local" });

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
