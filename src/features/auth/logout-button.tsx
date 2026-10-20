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
    <div className="shrink-0 space-y-2">
      <Button
        type="button"
        variant="outline"
        className="px-2.5 sm:px-4"
        onClick={handleLogout}
        disabled={pending}
      >
        {pending ? "Signing out…" : "Log out"}
      </Button>
      {message ? <ErrorState message={message} /> : null}
    </div>
  );
}
