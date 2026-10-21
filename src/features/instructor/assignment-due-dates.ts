const weekMs = 7 * 24 * 60 * 60 * 1000;

export function progressiveDueDates(lessonCount: number, assignmentCount: number, now: Date) {
  const lessons = Math.max(1, Math.trunc(lessonCount));
  const count = Math.max(0, Math.trunc(assignmentCount));
  const dates: string[] = [];
  let previousWeek = 0;

  for (let index = 0; index < count; index += 1) {
    const spread = Math.ceil(((index + 1) * lessons) / count);
    const week = Math.max(spread, previousWeek + 1);
    previousWeek = week;
    dates.push(new Date(now.getTime() + week * weekMs).toISOString());
  }

  return dates;
}
