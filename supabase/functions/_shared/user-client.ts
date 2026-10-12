export type UserClientEnv = {
  supabaseUrl: string | undefined;
  publishableKey: string | undefined;
  authorization: string | null;
};

export type ResolvedUserClient = {
  url: string;
  key: string;
  authorization: string;
  token: string;
};

export function resolveUserClient(
  env: UserClientEnv,
): { ok: true; client: ResolvedUserClient } | { ok: false; status: 401 | 500; message: string } {
  const url = env.supabaseUrl?.trim() ?? "";
  const key = env.publishableKey?.trim() ?? "";
  if (!url || !key || isServiceRoleKey(key)) {
    return { ok: false, status: 500, message: "AI is not configured." };
  }

  const header = env.authorization?.trim() ?? "";
  if (!header.startsWith("Bearer ")) {
    return { ok: false, status: 401, message: "You need to be signed in." };
  }
  const token = header.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) {
    return { ok: false, status: 401, message: "You need to be signed in." };
  }

  return {
    ok: true,
    client: { url, key, authorization: `Bearer ${token}`, token },
  };
}

export function isServiceRoleKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  const payload = decodeJwtPayload(parts[1] ?? "");
  return payload === "service_role";
}

function decodeJwtPayload(segment: string) {
  try {
    const padded =
      segment.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (segment.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    if (!parsed || typeof parsed !== "object" || !("role" in parsed)) return null;
    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}
