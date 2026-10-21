import { useEffect, useState, type FormEvent } from "react";

import { FilterToolbar, matchesQuery } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { RecordList, pageFrameClass, recordGridClass } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listCategories } from "@/features/categories/categories-api";
import { categoryName, type CourseCategory } from "@/features/categories/category-name";
import { compareCoursesNewestFirst } from "@/features/instructor/course-update";
import { SaveNotice } from "@/features/instructor/save-notice";

import { createCategory, deleteCategory, renameCategory } from "./categories-api";

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

type Pending = { id: string; action: "create" | "rename" | "delete" } | null;

export function CategoriesScreen() {
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<Notice>(emptyNotice);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    listCategories().then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCategories(result.categories);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const draft = categoryName(name);
    if (!draft.ok) {
      setNotice({ saved: false, message: draft.message });
      return;
    }

    setPending({ id: "create", action: "create" });
    const result = await createCategory(draft.name);
    setPending(null);
    if (!result.ok) {
      setNotice({ saved: false, message: result.message });
      return;
    }

    setCategories((current) => [result.category, ...current].sort(compareCoursesNewestFirst));
    setName("");
    setNotice({ saved: true, message: "This category was created." });
  }

  async function handleRename(categoryId: string, value: string) {
    if (pending) return false;

    const draft = categoryName(value);
    if (!draft.ok) {
      setNotice({ saved: false, message: draft.message });
      return false;
    }

    setPending({ id: categoryId, action: "rename" });
    const result = await renameCategory(categoryId, draft.name);
    setPending(null);
    if (!result.ok) {
      setNotice({ saved: false, message: result.message });
      return false;
    }

    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, name: result.name } : category,
      ),
    );
    setNotice({ saved: true, message: "This category was renamed." });
    return true;
  }

  async function handleDelete(categoryId: string) {
    if (pending) return;

    setPending({ id: categoryId, action: "delete" });
    const result = await deleteCategory(categoryId);
    setPending(null);
    if (!result.ok) {
      setNotice({ saved: false, message: result.message });
      return;
    }

    setCategories((current) => current.filter((category) => category.id !== categoryId));
    setNotice({ saved: true, message: "This category was deleted." });
  }

  const busy = pending !== null;
  const visible = categories.filter((category) => matchesQuery(query, [category.name]));

  return (
    <section className={pageFrameClass}>
      <PageHeader title="Manage Categories" />
      <SaveNotice
        tone="admin"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading categories…" /> : null}
      {!loading && !loadError ? (
        <form
          className="space-y-3 rounded-sm border border-border bg-card p-4 shadow-none"
          onSubmit={handleCreate}
        >
          <div className="space-y-2">
            <Label htmlFor="category-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {pending?.action === "create" ? "Creating…" : "Create"}
          </Button>
        </form>
      ) : null}
      {!loading && !loadError && categories.length > 0 ? (
        <FilterToolbar
          id="category-search"
          value={query}
          placeholder="Search categories by name..."
          onChange={setQuery}
        />
      ) : null}
      {!loading && !loadError && categories.length === 0 ? (
        <EmptyState message="There are no categories yet." />
      ) : null}
      {!loading && !loadError && categories.length > 0 && visible.length === 0 ? (
        <EmptyState message="No categories match this search." />
      ) : null}
      {!loading && !loadError && visible.length > 0 ? (
        <RecordList className={recordGridClass}>
          {visible.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              pending={
                pending?.id === category.id && pending.action !== "create" ? pending.action : ""
              }
              disabled={busy}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </RecordList>
      ) : null}
    </section>
  );
}

function CategoryCard({
  category,
  pending,
  disabled,
  onRename,
  onDelete,
}: {
  category: CourseCategory;
  pending: "" | "rename" | "delete";
  disabled: boolean;
  onRename: (categoryId: string, name: string) => Promise<boolean>;
  onDelete: (categoryId: string) => void;
}) {
  const [name, setName] = useState(category.name);

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onRename(category.id, name);
    if (saved) setName(name.trim());
  }

  return (
    <article className="flex h-full flex-col space-y-3 rounded-sm border border-border bg-card p-4 shadow-none">
      <h2 className="text-base font-medium text-foreground">{category.name}</h2>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">Created</dt>
          <dd className="text-foreground">{formatCreatedAt(category.createdAt)}</dd>
        </div>
      </dl>
      <form className="mt-auto space-y-4" onSubmit={handleRename}>
        <div className="space-y-2">
          <Label htmlFor={`category-name-${category.id}`}>Name</Label>
          <Input
            id={`category-name-${category.id}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={disabled}>
            {pending === "rename" ? "Renaming…" : "Rename"}
          </Button>
          <Button type="button" disabled={disabled} onClick={() => onDelete(category.id)}>
            {pending === "delete" ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </form>
    </article>
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
