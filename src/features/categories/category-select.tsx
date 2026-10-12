import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { categoriesByName, type CourseCategory } from "./category-name";

export const noCategoryValue = "none";

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
    <Select
      key={categoryId || noCategoryValue}
      value={categoryId || noCategoryValue}
      onValueChange={(value) => onChange(value === noCategoryValue ? "" : value)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="No category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={noCategoryValue}>No category</SelectItem>
        {categoriesByName(categories).map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
