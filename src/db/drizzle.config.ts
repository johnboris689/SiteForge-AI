import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL?.trim();
const sqlHost = process.env.SQL_HOST?.trim();
const sqlPort = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432;
const sqlUser = process.env.SQL_USER?.trim();
const sqlPassword = process.env.SQL_PASSWORD?.trim();
const sqlDbName = process.env.SQL_DB_NAME?.trim();

if (!databaseUrl && !(sqlHost && sqlUser && sqlDbName)) {
  throw new Error(
    "DATABASE_URL is not configured. Configure the Render PostgreSQL connection before starting Site Forge AI."
  );
}

const requiresSsl =
  process.env.DB_SSL === "true" ||
  Boolean(databaseUrl && (databaseUrl.includes("sslmode=require") || databaseUrl.includes(".render.com")));

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: databaseUrl
    ? {
        url: databaseUrl,
        ssl: process.env.DB_SSL === "false" ? false : requiresSsl ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host: sqlHost!,
        port: sqlPort,
        user: sqlUser!,
        password: sqlPassword,
        database: sqlDbName!,
        ssl: false,
      },
  verbose: true,
});
