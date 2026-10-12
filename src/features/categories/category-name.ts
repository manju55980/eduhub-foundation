export type CourseCategory = {
  id: string;
  name: string;
  createdAt: string;
};

export function categoryName(value: string) {
  const name = value.trim();
  if (!name) return { ok: false as const, message: "Enter a category name." };
  return { ok: true as const, name };
}

export function categoryInsert(name: string) {
  return { name };
}

export function categoriesByName<T extends { name: string }>(categories: T[]) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

export function storedCategoryName(
  categories: { id: string; name: string }[],
  categoryId: string | null,
) {
  if (!categoryId) return "";
  return categories.find((category) => category.id === categoryId)?.name ?? "";
}
