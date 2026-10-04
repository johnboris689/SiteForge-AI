import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL?.trim();
const sqlHost = process.env.SQL_HOST?.trim();
const sqlDbName = process.env.SQL_DB_NAME?.trim();
const user = (process.env.SQL_ADMIN_USER || process.env.SQL_USER)?.trim();
const password = (process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD)?.trim();

if (!databaseUrl && !sqlHost) {
  throw new Error(
    "DATABASE_URL is not configured. Configure the Render PostgreSQL connection before running Drizzle."
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: databaseUrl
    ? {
        url: databaseUrl,
      }
    : {
        host: sqlHost!,
        user: user!,
        password: password!,
        database: sqlDbName!,
        ssl: false,
      },
  verbose: true,
});
