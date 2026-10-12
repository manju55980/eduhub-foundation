import type { ReactNode } from "react";

export function BoardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DataTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-sm border border-border bg-card">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead className="bg-muted/80">
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DataRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-border last:border-b-0">{children}</tr>;
}

export function DataCell({
  children,
  heading = false,
}: {
  children: ReactNode;
  heading?: boolean;
}) {
  return (
    <td className="px-3 py-2 align-middle text-foreground [overflow-wrap:anywhere]">
      {heading ? <h3 className="text-sm font-medium leading-snug">{children}</h3> : children}
    </td>
  );
}
