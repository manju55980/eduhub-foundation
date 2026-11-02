import { selectFieldClass } from "@/components/app-shell/record-card";

import { categoriesByName, type CourseCategory } from "./category-name";

export const noCategoryValue = "none";

const selectClassName = `flex w-full max-w-full ${selectFieldClass}`;

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
