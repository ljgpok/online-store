// Loads DATABASE_URL for scripts that run outside Next.js (drizzle-kit, the seed).
// Next.js reads these files itself. Earlier paths win, matching Next's precedence.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
