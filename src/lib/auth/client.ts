"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./server";

// Talks to /api/auth on this site.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
