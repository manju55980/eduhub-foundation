import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  description,
  backTo,
  backLabel,
}: {
  title: string;
  description?: string;
  backTo?: LinkProps["to"];
  backLabel?: string;
}) {
  return (
    <header className="space-y-2">
      {backTo && backLabel ? (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        ) : null}
      </div>
    </header>
  );
}
