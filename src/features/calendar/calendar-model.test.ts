import { describe, expect, it } from "vitest";

import {
  calendarEvents,
  daysInRange,
  eventsOnDay,
  periodLabel,
  shiftAnchor,
  visibleRange,
} from "./calendar-model";

const wednesday = new Date(2026, 10, 11, 15, 0, 0);

describe("visibleRange", () => {
  it("covers the Monday-start month grid, the week, and one day", () => {
    const month = visibleRange(wednesday, "month");
    expect(month.start).toEqual(new Date(2026, 9, 26));
    expect(month.end).toEqual(new Date(2026, 11, 7));
    expect(daysInRange(month)).toHaveLength(42);

    const week = visibleRange(wednesday, "week");
    expect(week.start).toEqual(new Date(2026, 10, 9));
    expect(week.end).toEqual(new Date(2026, 10, 16));

    const day = visibleRange(wednesday, "day");
    expect(day.start).toEqual(new Date(2026, 10, 11));
    expect(day.end).toEqual(new Date(2026, 10, 12));
  });

  it("labels the period and steps by the current view", () => {
    expect(periodLabel(wednesday, "month")).toBe("November 2026");
    expect(periodLabel(wednesday, "week")).toBe("9–15 Nov 2026");
    expect(periodLabel(wednesday, "day")).toBe("Wednesday 11 Nov 2026");
    expect(periodLabel(new Date(2026, 10, 30), "week")).toBe("30 Nov – 6 Dec 2026");
    expect(shiftAnchor(wednesday, "month", 1).getMonth()).toBe(11);
    expect(shiftAnchor(wednesday, "week", -1)).toEqual(new Date(2026, 10, 4, 15, 0, 0));
    expect(shiftAnchor(wednesday, "day", 1)).toEqual(new Date(2026, 10, 12, 15, 0, 0));
  });
});

describe("calendarEvents", () => {
  const courses = [{ id: "course-1", title: " Algebra " }];

  it("keeps a class and a deadline in order and drops a blank due date", () => {
    const events = calendarEvents({
      sessions: [
        {
          id: "session-1",
          courseId: "course-1",
          title: " Seminar ",
          startsAt: "2026-11-11T04:00:00.000Z",
          endsAt: "2026-11-11T05:00:00.000Z",
          location: "  ",
        },
      ],
      assignments: [
        {
          id: "assignment-1",
          courseId: "course-missing",
          title: null,
          dueDate: "2026-11-11T12:00:00.000Z",
        },
        {
          id: "assignment-2",
          courseId: "course-2",
          title: "Draft",
          dueDate: null,
        },
      ],
      courses,
    });

    expect(events).toEqual([
      expect.objectContaining({
        id: "session-1",
        kind: "class",
        title: "Seminar",
        courseTitle: "Algebra",
        location: null,
      }),
      expect.objectContaining({
        id: "assignment-1",
        kind: "deadline",
        title: "Assignment",
        courseTitle: "Course",
      }),
    ]);
  });

  it("shows a class on each local day it overlaps and a deadline on its due day", () => {
    const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();
    const events = calendarEvents({
      sessions: [
        {
          id: "overnight",
          courseId: "course-1",
          title: "Lab",
          startsAt: at(11, 22),
          endsAt: at(12, 1),
          location: "Room 2",
        },
        {
          id: "ends-at-midnight",
          courseId: "course-1",
          title: "Review",
          startsAt: at(10, 21),
          endsAt: at(11, 0),
          location: null,
        },
      ],
      assignments: [
        {
          id: "due-midnight",
          courseId: "course-1",
          title: "Quiz",
          dueDate: at(12, 0),
        },
      ],
      courses,
    });

    expect(eventsOnDay(events, new Date(2026, 10, 10)).map((event) => event.id)).toEqual([
      "ends-at-midnight",
    ]);
    expect(eventsOnDay(events, new Date(2026, 10, 11)).map((event) => event.id)).toEqual([
      "overnight",
    ]);
    expect(eventsOnDay(events, new Date(2026, 10, 12)).map((event) => event.id)).toEqual([
      "overnight",
      "due-midnight",
    ]);
  });
});
