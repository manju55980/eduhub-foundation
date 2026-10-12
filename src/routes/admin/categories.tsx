import { createFileRoute } from "@tanstack/react-router";

import { CategoriesScreen } from "@/features/admin/categories-screen";

export const Route = createFileRoute("/admin/categories")({
  component: ManageCategoriesPage,
});

function ManageCategoriesPage() {
  return <CategoriesScreen />;
}
