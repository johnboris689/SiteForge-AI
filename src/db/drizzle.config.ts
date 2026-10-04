import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not configured. Configure the Render PostgreSQL connection before starting Site Forge AI."
  );
}

const requiresSsl =
  process.env.DB_SSL === "true" ||
  databaseUrl.includes("sslmode=require") ||
  databaseUrl.includes(".render.com");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: databaseUrl,
    ssl: process.env.DB_SSL === "false" ? false : requiresSsl ? { rejectUnauthorized: false } : undefined,
  },
  verbose: true,
});
