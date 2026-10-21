import { useEffect, useState } from "react";

import { DataCell, DataRow, DataTable } from "@/components/app-shell/data-table";
import { ChoiceButton, FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { pageFrameClass } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";

import { listUsers, promoteStudent } from "./users-api";
import { canPromote, type ManagedUser } from "./users";

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function UsersScreen({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(emptyNotice);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");

  useEffect(() => {
    let active = true;
    listUsers().then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setUsers(result.users);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handlePromote(userId: string) {
    if (pendingId) return;

    setPendingId(userId);
    const result = await promoteStudent(userId);
    setPendingId(null);
    if (!result.ok) {
      setNotice({ saved: false, message: result.message });
      return;
    }

    setUsers((current) =>
      current.map((user) => (user.id === userId ? { ...user, role: "instructor" } : user)),
    );
    setNotice({ saved: true, message: "This user was promoted to instructor." });
  }

  const roles = ["all", "student", "instructor", "admin"] as const;
  const visible = users.filter(
    (user) =>
      (role === "all" || user.role === role) && matchesQuery(query, [user.fullName, user.email]),
  );

  return (
    <section className={pageFrameClass}>
      <PageHeader
        title="Manage Users"
        description="Search accounts and promote a student to instructor."
      />
      <SaveNotice
        tone="admin"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading users…" /> : null}
      {!loading && !loadError && users.length > 0 ? (
        <FilterToolbar
          id="user-search"
          value={query}
          placeholder="Search users by name or email..."
          onChange={setQuery}
          controlsLabel="Role"
        >
          {roles.map((item) => (
            <ChoiceButton key={item} pressed={role === item} onClick={() => setRole(item)}>
              {item === "all" ? "All" : item[0]?.toUpperCase() + item.slice(1)}
            </ChoiceButton>
          ))}
        </FilterToolbar>
      ) : null}
      {!loading && !loadError && users.length === 0 ? (
        <EmptyState message="There are no users yet." />
      ) : null}
      {!loading && !loadError && users.length > 0 && visible.length === 0 ? (
        <EmptyState message="No users match this search." />
      ) : null}
      {!loading && !loadError && visible.length > 0 ? (
        <DataTable columns={["Name", "Email", "Role", "Created", "Action"]}>
          {visible.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              adminId={adminId}
              pending={pendingId === user.id}
              onPromote={handlePromote}
            />
          ))}
        </DataTable>
      ) : null}
    </section>
  );
}

function UserRow({
  user,
  adminId,
  pending,
  onPromote,
}: {
  user: ManagedUser;
  adminId: string;
  pending: boolean;
  onPromote: (userId: string) => void;
}) {
  return (
    <DataRow>
      <DataCell label="Name" heading>
        {user.fullName ?? ""}
      </DataCell>
      <DataCell label="Email">{user.email ?? ""}</DataCell>
      <DataCell label="Role">
        <StatusBadge value={user.role} />
      </DataCell>
      <DataCell label="Created">{formatCreatedAt(user.createdAt)}</DataCell>
      <DataCell label="Action">
        {canPromote(adminId, user) ? (
          <Button type="button" size="sm" disabled={pending} onClick={() => onPromote(user.id)}>
            {pending ? "Promoting…" : "Promote"}
          </Button>
        ) : null}
      </DataCell>
    </DataRow>
  );
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
