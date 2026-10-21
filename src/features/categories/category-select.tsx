import { categoriesByName, type CourseCategory } from "./category-name";

export const noCategoryValue = "none";

const selectClassName =
  "flex h-9 w-full min-w-0 max-w-full rounded-sm border border-input bg-transparent px-3 py-1 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function CategorySelect({
  id,
  categories,
  categoryId,
  onChange,
  disabled,
}: {
  id: string;
  categories: CourseCategory[];
  categoryId: string;
  onChange: (categoryId: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      id={id}
      className={selectClassName}
      value={categoryId || noCategoryValue}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.value === noCategoryValue ? "" : event.target.value)
      }
    >
      <option value={noCategoryValue}>No category</option>
      {categoriesByName(categories).map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}
