import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ErrorState } from "@/components/app-shell/page-state";
import { Button } from "@/components/ui/button";

import { signOut } from "./auth-api";

export function LogoutButton() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogout() {
    setPending(true);
    setMessage("");
    const result = await signOut();
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-w-0 max-w-full shrink flex-col items-stretch gap-2">
      <Button
        type="button"
        variant="outline"
        className="shrink-0 px-2.5 sm:px-4"
        onClick={handleLogout}
        disabled={pending}
      >
        {pending ? "Signing out…" : "Log out"}
      </Button>
      {message ? <ErrorState message={message} /> : null}
    </div>
  );
}
