import { type ReactNode } from "react";

import { ErrorState } from "@/components/app-shell/page-state";
import type { AppRole } from "@/lib/roles";

import { LogoutButton } from "./logout-button";

export function SignedInScreen({
  email,
  role,
  children,
}: {
  email: string;
  role: AppRole;
  children?: ReactNode;
}) {
  return (
    <SessionFrame title="Signed in">
      <p className="text-sm text-muted-foreground">
        {email || "No email on this profile"} · {role}
      </p>
      {children}
      <LogoutButton />
    </SessionFrame>
  );
}

export function ProfileError({ message }: { message: string }) {
  return (
    <SessionFrame title="Profile unavailable">
      <ErrorState message={message} />
      <LogoutButton />
    </SessionFrame>
  );
}

function SessionFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md space-y-4 rounded-sm border bg-card p-4 text-card-foreground shadow-none">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {children}
      </section>
    </main>
  );
}
