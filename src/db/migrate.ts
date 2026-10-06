// Applies the SQL migrations in drizzle/: `npm run db:migrate`.
// Uses the same Neon HTTP driver as the app; `drizzle-kit migrate` exits
// without an error message against this database.
import "./load-env";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./index";

migrate(db, { migrationsFolder: "drizzle" })
  .then(() => console.log("Migrations applied."))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
