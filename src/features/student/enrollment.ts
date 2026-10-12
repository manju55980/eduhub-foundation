export function enrollmentInsert(studentId: string, courseId: string) {
  return {
    student_id: studentId,
    course_id: courseId,
    progress: 0,
    status: "active" as const,
  };
}
