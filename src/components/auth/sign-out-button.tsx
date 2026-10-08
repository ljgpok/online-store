import { signOut } from "@/lib/auth/actions";

// A plain form posting to a server action, so it works without JavaScript.
export function SignOutButton({ className = "btn btn-secondary" }: { className?: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
