export function coursesInCategory<T extends { categoryId: string | null }>(
  courses: T[],
  categoryId: string,
) {
  if (!categoryId) return courses;
  return courses.filter((course) => course.categoryId === categoryId);
}
