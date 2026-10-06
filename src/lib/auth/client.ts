"use client";

import { createAuthClient } from "better-auth/react";

// Talks to /api/auth on this site.
export const authClient = createAuthClient();
