// Gives an existing user the admin role: `pnpm auth:make-admin you@example.com`.
// The only way to change a role; sign-up and update-user can't set it.
import "./load-env";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { user } from "./schema";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: pnpm auth:make-admin <email>");
  process.exit(1);
}

db.update(user)
  .set({ role: "admin" })
  .where(eq(sql`lower(${user.email})`, email))
  .returning({ id: user.id })
  .then((rows) => {
    if (rows.length === 0) {
      console.error(`No user with email ${email}. Sign up first.`);
      process.exit(1);
    }
    console.log(`${email} is now an admin.`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
