import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const metaValueClass =
  "whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]";

export const panelClass = "min-w-0 rounded-sm border border-border bg-card shadow-none";
export const pageFrameClass = "w-full min-w-0 space-y-5";
export const recordGridClass = "lg:grid-cols-2";
export const selectFieldClass =
  "h-9 min-w-0 rounded-sm border border-input bg-transparent px-2 text-sm text-foreground shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function PageSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn(pageFrameClass, className)}>{children}</section>;
}

export function RecordList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid min-w-0 gap-3", className)}>{children}</div>;
}

export function RecordCard({
  title,
  badge,
  description,
  children,
  className,
}: {
  title: string;
  badge?: ReactNode;
  description?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  const summary = description ?? "";

  return (
    <article className={cn(panelClass, "@container space-y-3 p-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        <h2 className="min-w-0 flex-1 text-base font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
          {title}
        </h2>
        {badge ? <div className="shrink-0 pt-0.5">{badge}</div> : null}
      </div>
      {summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {summary}
        </p>
      ) : null}
      {children}
    </article>
  );
}

export function MetaList({
  children,
  stacked = false,
}: {
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <dl
      className={cn(
        "grid min-w-0 items-start gap-x-4 gap-y-3",
        stacked ? "grid-cols-1" : "grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-3",
      )}
    >
      {children}
    </dl>
  );
}

export function MetaItem({
  label,
  value = "",
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <dt className="text-xs font-medium leading-snug text-muted-foreground">{label}</dt>
      <dd className={metaValueClass}>{children ?? value}</dd>
    </div>
  );
}
