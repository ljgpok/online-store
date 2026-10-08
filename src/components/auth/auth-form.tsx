"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth/client";

type Mode = "sign-in" | "sign-up";
type FieldName = "name" | "email" | "password";
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const MAX_NAME = 100;
// Deliberately loose: the server has the final say on what an email is.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(mode: Mode, field: FieldName, value: string): string | undefined {
  switch (field) {
    case "name":
      if (!value.trim()) return "Enter your name.";
      if (value.trim().length > MAX_NAME) return `Use ${MAX_NAME} characters or fewer.`;
      return;
    case "email":
      if (!value.trim()) return "Enter your email address.";
      if (!EMAIL_PATTERN.test(value.trim()))
        return "Enter an email address like name@example.com.";
      return;
    case "password":
      if (!value) return mode === "sign-up" ? "Create a password." : "Enter your password.";
      // Sign-in doesn't check length, so older passwords still work.
      if (mode === "sign-up" && value.length < MIN_PASSWORD)
        return `Use at least ${MIN_PASSWORD} characters.`;
      if (value.length > MAX_PASSWORD) return `Use ${MAX_PASSWORD} characters or fewer.`;
      return;
  }
}

type ServerError = { field?: FieldName; message: ReactNode };

/**
 * Turns a Better Auth error into copy. Sign-in failures stay vague on
 * purpose, so the form never says whether an email has an account.
 */
function describeError(
  mode: Mode,
  error: { status: number; code?: string },
  signInHref: string,
): ServerError {
  if (error.status === 429) {
    return { message: "Too many attempts. Wait a minute, then try again." };
  }
  switch (error.code) {
    case "INVALID_EMAIL":
      return { field: "email", message: "Enter an email address like name@example.com." };
    case "PASSWORD_TOO_SHORT":
      return { field: "password", message: `Use at least ${MIN_PASSWORD} characters.` };
    case "PASSWORD_TOO_LONG":
      return { field: "password", message: `Use ${MAX_PASSWORD} characters or fewer.` };
    case "INVALID_EMAIL_OR_PASSWORD":
      return { message: "Email or password is incorrect." };
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return {
        message: (
          <>
            We couldn’t create an account with that email. If it’s yours,{" "}
            <Link href={signInHref} className="link">
              sign in instead
            </Link>
            .
          </>
        ),
      };
  }
  if (mode === "sign-in" && error.status === 401) {
    return { message: "Email or password is incorrect." };
  }
  return { message: "Something went wrong on our side. Please try again." };
}

const copy = {
  "sign-in": { submit: "Sign in", pending: "Signing in…", done: "Signed in. Taking you there…" },
  "sign-up": {
    submit: "Create account",
    pending: "Creating account…",
    done: "Account created. Taking you there…",
  },
};

type Props = {
  mode: Mode;
  /** Where to go afterwards. Must already be checked with `safeNext` on the server. */
  next: string;
  /** Sign-in page, keeping `next`, for the "account exists" message on sign-up. */
  signInHref?: string;
};

export function AuthForm({ mode, next, signInHref = "/sign-in" }: Props) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const fields: FieldName[] = isSignUp ? ["name", "email", "password"] : ["email", "password"];

  const [values, setValues] = useState<Values>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  // A field shows its error after it's been left once, or after a submit.
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [formError, setFormError] = useState<ReactNode>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "done">("idle");
  const [showPassword, setShowPassword] = useState(false);

  const inputs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});
  const formErrorRef = useRef<HTMLDivElement>(null);
  const busy = status !== "idle";

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target.name as FieldName;
    const value = event.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    if (touched[field]) setErrors((e) => ({ ...e, [field]: validate(mode, field, value) }));
  }

  function onBlur(event: FocusEvent<HTMLInputElement>) {
    const field = event.target.name as FieldName;
    // Leaving an empty field untouched shouldn't shout at the customer.
    if (!event.target.value && !touched[field]) return;
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validate(mode, field, event.target.value) }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const found: Errors = {};
    for (const field of fields) found[field] = validate(mode, field, values[field]);
    setErrors(found);
    setTouched(Object.fromEntries(fields.map((f) => [f, true])));
    setFormError(null);

    const firstInvalid = fields.find((f) => found[f]);
    if (firstInvalid) {
      inputs.current[firstInvalid]?.focus();
      return;
    }

    setStatus("pending");
    const name = values.name.trim();
    const email = values.email.trim().toLowerCase();
    const { password } = values;

    let result: { error: { status: number; code?: string } | null };
    try {
      result = isSignUp
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
    } catch {
      setStatus("idle");
      setFormError("We couldn’t reach Claude Shop. Check your connection and try again.");
      requestAnimationFrame(() => formErrorRef.current?.focus());
      return;
    }

    if (result.error) {
      setStatus("idle");
      const described = describeError(mode, result.error, signInHref);
      if (described.field) {
        const field = described.field;
        setErrors((e) => ({ ...e, [field]: described.message as string }));
        requestAnimationFrame(() => inputs.current[field]?.focus());
        return;
      }
      setFormError(described.message);
      if (mode === "sign-in") {
        // Keep the email, clear the password so it's quick to retype.
        setValues((v) => ({ ...v, password: "" }));
        setTouched((t) => ({ ...t, password: false }));
        requestAnimationFrame(() => inputs.current.password?.focus());
      } else {
        requestAnimationFrame(() => formErrorRef.current?.focus());
      }
      return;
    }

    // Stay busy while the account page loads, so nothing can be resubmitted.
    setStatus("done");
    router.replace(next);
    router.refresh();
  }

  function describedBy(field: FieldName, ...extra: (string | false)[]) {
    return [errors[field] && `${field}-error`, ...extra].filter(Boolean).join(" ") || undefined;
  }

  return (
    // POST so that, if JavaScript hasn't loaded, a native submit can't put the
    // password in the URL (and so in history and server logs).
    <form
      method="post"
      onSubmit={onSubmit}
      className="stack"
      noValidate
      aria-busy={status === "pending"}
    >
      <div
        ref={formErrorRef}
        tabIndex={-1}
        role="alert"
        className="text-ui text-alert border-l-2 border-alert pl-4 outline-none empty:hidden"
      >
        {formError}
      </div>

      {/* Disabling the fieldset locks every input while the request runs. */}
      <fieldset disabled={busy} className="stack">
        {isSignUp && (
          <Field label="Name" field="name" error={errors.name}>
            <input
              ref={(el) => {
                inputs.current.name = el;
              }}
              id="name"
              name="name"
              className="input"
              autoComplete="name"
              value={values.name}
              onChange={onChange}
              onBlur={onBlur}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("name")}
              aria-required
            />
          </Field>
        )}

        <Field label="Email" field="email" error={errors.email}>
          <input
            ref={(el) => {
              inputs.current.email = el;
            }}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            className="input"
            autoComplete={isSignUp ? "email" : "username"}
            autoCapitalize="none"
            spellCheck={false}
            value={values.email}
            onChange={onChange}
            onBlur={onBlur}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy("email")}
            aria-required
          />
        </Field>

        <Field
          label="Password"
          field="password"
          error={errors.password}
          hint={
            isSignUp && !errors.password ? `At least ${MIN_PASSWORD} characters.` : undefined
          }
        >
          <div className="relative">
            <input
              ref={(el) => {
                inputs.current.password = el;
              }}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              className="input pr-20"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              autoCapitalize="none"
              spellCheck={false}
              value={values.password}
              onChange={onChange}
              onBlur={onBlur}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={describedBy(
                "password",
                isSignUp && !errors.password && "password-hint",
              )}
              aria-required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-controls="password"
              aria-pressed={showPassword}
              className="link-quiet absolute inset-y-0 right-0 min-w-16 px-4 text-sm"
            >
              {showPassword ? "Hide" : "Show"}
              <span className="visually-hidden"> password</span>
            </button>
          </div>
        </Field>

        {/* Full strength while busy: the spinner and label carry the state. */}
        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block disabled:cursor-progress disabled:opacity-100"
        >
          {status === "idle" && copy[mode].submit}
          {status !== "idle" && (
            <>
              <Spinner />
              {copy[mode].pending}
            </>
          )}
        </button>
      </fieldset>

      <p role="status" className="visually-hidden">
        {status === "pending" ? copy[mode].pending : status === "done" ? copy[mode].done : ""}
      </p>
    </form>
  );
}

function Field({
  label,
  field,
  error,
  hint,
  children,
}: {
  label: string;
  field: FieldName;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={field} className="label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${field}-error`} className="mt-2 text-sm text-alert">
          {error}
        </p>
      )}
      {hint && (
        <p id={`${field}-hint`} className="text-meta mt-2">
          {hint}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}
