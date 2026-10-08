"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./server";

// Sign-in and sign-up go through the client (`authClient`), so they hit
// /api/auth and its rate limiter. `auth.api` calls skip the limiter, which is
// fine for signing out but not for checking passwords.
export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
