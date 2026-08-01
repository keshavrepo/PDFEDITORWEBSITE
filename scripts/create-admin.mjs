import "dotenv/config";
import pg from "pg";
import { hash } from "bcryptjs";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Keshav";

if (!email || !email.includes("@")) {
  console.error("Set ADMIN_EMAIL to a valid email address.");
  process.exit(1);
}
if (!password || password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
  console.error("Set ADMIN_PASSWORD to at least 12 characters including a letter and number.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const passwordHash = await hash(password, 12);
  await pool.query(
    `insert into users (email, password_hash, name, role)
     values ($1, $2, $3, 'admin')
     on conflict (email) do update
     set password_hash = excluded.password_hash,
         name = excluded.name,
         role = 'admin',
         updated_at = now()`,
    [email, passwordHash, name]
  );
  console.log(`Administrator ready: ${email}`);
  console.log("Sign in at /login, then open /admin/posts.");
} catch (error) {
  console.error("Unable to create administrator:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
