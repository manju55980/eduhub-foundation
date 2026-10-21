import type { MouseEvent, ReactNode } from "react";

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
    <div className="min-w-0 rounded-sm border border-border bg-card md:overflow-x-auto">
      <table className="block w-full border-collapse text-left text-sm md:table md:min-w-[40rem]">
        <thead className="hidden bg-muted/80 md:table-header-group">
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
        <tbody className="block md:table-row-group">{children}</tbody>
      </table>
    </div>
  );
}

export function DataRow({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLTableRowElement>) => void;
}) {
  return (
    <tr
      className={
        onClick
          ? "block cursor-pointer border-b border-border last:border-b-0 md:table-row"
          : "block border-b border-border last:border-b-0 md:table-row"
      }
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function DataCell({
  children,
  heading = false,
  label,
}: {
  children: ReactNode;
  heading?: boolean;
  label?: string;
}) {
  return (
    <td className="block min-w-0 px-3 py-2 align-middle text-foreground [overflow-wrap:anywhere] md:table-cell">
      {label && children != null && children !== false ? (
        <span className="mb-0.5 block text-xs font-semibold text-muted-foreground md:hidden">
          {label}
        </span>
      ) : null}
      {heading ? <h3 className="text-sm font-medium leading-snug">{children}</h3> : children}
    </td>
  );
}
