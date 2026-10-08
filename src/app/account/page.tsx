import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Account information",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

export default async function AccountInformationPage() {
  const { user, signedInAt } = await requireUser("/account");

  return (
    <div className="stack max-w-(--container-copy)">
      <h1 className="text-title">Account information</h1>

      <section aria-labelledby="details-heading" className="rule-t pt-(--space-block)">
        <h2 id="details-heading" className="text-subtitle mb-4">
          Your details
        </h2>
        <Details
          rows={[
            ["Name", user.name],
            ["Email", <span key="email" className="[overflow-wrap:anywhere]">{user.email}</span>],
          ]}
        />
        <p className="text-meta mt-4">
          To change your name or email, please{" "}
          <Link href="/contact" className="link">
            contact client services
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="membership-heading" className="rule-t pt-(--space-block)">
        <h2 id="membership-heading" className="text-subtitle mb-4">
          Membership
        </h2>
        <Details
          rows={[
            ["Member since", dateFormat.format(user.memberSince)],
            ["Signed in on this device", dateFormat.format(signedInAt)],
          ]}
        />
      </section>
    </div>
  );
}

function Details({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="flex flex-col gap-4">
      {rows.map(([term, value]) => (
        <div key={term} className="grid gap-x-8 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <dt className="text-meta">{term}</dt>
          <dd className="text-ui">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
