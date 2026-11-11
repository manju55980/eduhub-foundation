import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { format, isSameDay, isSameMonth, startOfDay } from "date-fns";

import { ChoiceButton } from "@/components/app-shell/management";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { PageSection } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";
import { cn } from "@/lib/utils";

import { listCalendarEvents } from "./calendar-api";
import {
  dayButtonLabel,
  daysInRange,
  eventsOnDay,
  formatEventWhen,
  periodLabel,
  shiftAnchor,
  visibleRange,
  type CalendarEvent,
  type CalendarRole,
  type CalendarView,
} from "./calendar-model";
import {
  ClassSessionDialog,
  editSessionForm,
  newSessionForm,
  type SessionForm,
} from "./session-form";

const views = ["month", "week", "day"] as const;
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function AcademicCalendar({ role, now }: { role: CalendarRole; now?: Date }) {
  const initial = startOfDay(now ?? new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(initial);
  const [selected, setSelected] = useState(initial);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState({ saved: false, message: "" });
  const [session, setSession] = useState<SessionForm | null>(null);
  const range = visibleRange(anchor, view);
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    listCalendarEvents({ start: new Date(startMs), end: new Date(endMs) }).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setEvents([]);
        setLoadError(result.message);
        return;
      }
      setEvents(result.events);
    });
    return () => {
      active = false;
    };
  }, [startMs, endMs, reload]);

  function chooseView(next: CalendarView) {
    setView(next);
    setAnchor(selected);
  }

  function move(direction: -1 | 1) {
    const next = shiftAnchor(anchor, view, direction);
    setAnchor(next);
    setSelected(startOfDay(next));
  }

  function goToday() {
    const today = startOfDay(now ?? new Date());
    setAnchor(today);
    setSelected(today);
  }

  const days = daysInRange(range);
  const selectedEvents = eventsOnDay(events, selected);

  return (
    <PageSection>
      <PageHeader
        title="Calendar"
        description={
          role === "student"
            ? "Classes and deadlines for the courses you have joined."
            : "Classes and deadlines for the courses you teach."
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Calendar view">
          {views.map((item) => (
            <ChoiceButton key={item} pressed={view === item} onClick={() => chooseView(item)}>
              {viewLabel(item)}
            </ChoiceButton>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Previous ${view}`}
            onClick={() => move(-1)}
          >
            Previous
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={goToday}>
            Today
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Next ${view}`}
            onClick={() => move(1)}
          >
            Next
          </Button>
        </div>
      </div>
      {role === "instructor" ? (
        <div>
          <Button type="button" size="sm" onClick={() => setSession(newSessionForm(selected))}>
            Add class
          </Button>
        </div>
      ) : null}
      <SaveNotice
        tone="instructor"
        saved={notice.saved}
        message={notice.message}
        onDismiss={() => setNotice({ saved: false, message: "" })}
      />
      <p className="text-sm font-medium text-foreground" aria-live="polite">
        {periodLabel(anchor, view)}
      </p>
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading calendar…" /> : null}
      {!loading && !loadError && view === "month" ? (
        <MonthDays
          days={days}
          anchor={anchor}
          selected={selected}
          events={events}
          onSelect={setSelected}
        />
      ) : null}
      {!loading && !loadError && view === "week" ? (
        <WeekDays days={days} selected={selected} events={events} onSelect={setSelected} />
      ) : null}
      {!loading && !loadError && events.length === 0 ? (
        <EmptyState message="No classes or deadlines in this period." />
      ) : null}
      {!loading && !loadError && events.length > 0 ? (
        <SelectedDay
          role={role}
          day={selected}
          events={selectedEvents}
          onEdit={role === "instructor" ? (event) => setSession(editSessionForm(event)) : null}
        />
      ) : null}
      {role === "instructor" ? (
        <ClassSessionDialog
          session={session}
          onClose={() => setSession(null)}
          onSaved={() => {
            setSession(null);
            setNotice({ saved: true, message: "Class saved." });
            setReload((value) => value + 1);
          }}
        />
      ) : null}
    </PageSection>
  );
}

function MonthDays({
  days,
  anchor,
  selected,
  events,
  onSelect,
}: {
  days: Date[];
  anchor: Date;
  selected: Date;
  events: CalendarEvent[];
  onSelect: (day: Date) => void;
}) {
  return (
    <div role="group" aria-label="Month" className="grid grid-cols-7 gap-1">
      {weekdays.map((label) => (
        <div key={label} className="px-1 text-center text-xs font-medium text-muted-foreground">
          {label}
        </div>
      ))}
      {days.map((day) => {
        const dayEvents = eventsOnDay(events, day);
        const pressed = isSameDay(day, selected);
        return (
          <button
            key={day.toISOString()}
            type="button"
            aria-pressed={pressed}
            aria-label={dayButtonLabel(day)}
            onClick={() => onSelect(day)}
            className={cn(
              "min-h-11 min-w-0 rounded-md px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              pressed ? "bg-primary text-primary-foreground" : "hover:bg-sage text-foreground",
              !pressed && !isSameMonth(day, anchor) && "text-muted-foreground",
            )}
          >
            <span className="block text-xs font-medium">{format(day, "d")}</span>
            {dayEvents.length > 0 ? (
              <span className="mt-1 hidden space-y-0.5 md:block">
                {dayEvents.slice(0, 2).map((event) => (
                  <span
                    key={`${event.kind}-${event.id}`}
                    className={cn(
                      "block truncate text-[11px] leading-tight",
                      pressed
                        ? "text-primary-foreground"
                        : event.kind === "class"
                          ? "text-primary"
                          : "text-active",
                    )}
                  >
                    {event.title}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function WeekDays({
  days,
  selected,
  events,
  onSelect,
}: {
  days: Date[];
  selected: Date;
  events: CalendarEvent[];
  onSelect: (day: Date) => void;
}) {
  return (
    <>
      <div role="group" aria-label="Days" className="grid grid-cols-7 gap-1 md:hidden">
        {days.map((day) => (
          <DayChoice key={day.toISOString()} day={day} selected={selected} onSelect={onSelect} />
        ))}
      </div>
      <div role="group" aria-label="Week" className="hidden min-w-0 gap-2 md:grid md:grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsOnDay(events, day);
          return (
            <div key={day.toISOString()} className="min-w-0 space-y-2">
              <DayChoice day={day} selected={selected} onSelect={onSelect} />
              <ul className="space-y-1">
                {dayEvents.map((event) => (
                  <li
                    key={`${event.kind}-${event.id}`}
                    className={cn(
                      "truncate text-xs",
                      event.kind === "class" ? "text-primary" : "text-active",
                    )}
                  >
                    {event.title}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DayChoice({
  day,
  selected,
  onSelect,
}: {
  day: Date;
  selected: Date;
  onSelect: (day: Date) => void;
}) {
  const pressed = isSameDay(day, selected);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={dayButtonLabel(day)}
      onClick={() => onSelect(day)}
      className={cn(
        "min-h-11 w-full min-w-0 rounded-md px-1 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        pressed ? "bg-primary text-primary-foreground" : "hover:bg-sage text-foreground",
      )}
    >
      <span className="block">{format(day, "EEE")}</span>
      <span className="block">{format(day, "d")}</span>
    </button>
  );
}

function SelectedDay({
  role,
  day,
  events,
  onEdit,
}: {
  role: CalendarRole;
  day: Date;
  events: CalendarEvent[];
  onEdit: ((event: CalendarEvent) => void) | null;
}) {
  return (
    <section aria-label="Selected day" className="space-y-2">
      <h2 className="text-sm font-medium text-foreground">{format(day, "EEEE d MMMM")}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is scheduled on this day.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={`${event.kind}-${event.id}`}>
              <EventLink role={role} event={event} onEdit={onEdit} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventLink({
  role,
  event,
  onEdit,
}: {
  role: CalendarRole;
  event: CalendarEvent;
  onEdit: ((event: CalendarEvent) => void) | null;
}) {
  const className = cn(
    "block min-w-0 rounded-md border border-border border-l-4 bg-card px-3 py-2 shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    event.kind === "class"
      ? "border-l-primary bg-positive-soft"
      : "border-l-active bg-progress-soft",
  );
  const body = (
    <>
      <span
        className={cn(
          "text-xs font-semibold",
          event.kind === "class" ? "text-primary" : "text-active",
        )}
      >
        {event.kind === "class" ? "Class" : "Deadline"}
      </span>
      <span className="mt-1 block text-sm font-medium text-foreground [overflow-wrap:anywhere]">
        {event.title}
      </span>
      <span className="mt-1 block text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {event.courseTitle}
        {event.location ? ` · ${event.location}` : ""}
        {` · ${formatEventWhen(event)}`}
      </span>
    </>
  );

  if (role === "student" && event.kind === "class") {
    return (
      <Link
        to="/student/my-courses/$courseId"
        params={{ courseId: event.courseId }}
        search={{ from: "my-courses" }}
        className={className}
      >
        {body}
      </Link>
    );
  }
  if (role === "student") {
    return (
      <Link to="/student/assignments" className={className}>
        {body}
      </Link>
    );
  }
  if (event.kind === "class" && onEdit) {
    return (
      <div className={cn(className, "space-y-2")}>
        <Link
          to="/instructor/courses/$courseId"
          params={{ courseId: event.courseId }}
          search={{ from: "courses" }}
          className="block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {body}
        </Link>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Edit ${event.title}`}
          onClick={() => onEdit(event)}
        >
          Edit
        </Button>
      </div>
    );
  }
  return (
    <Link
      to="/instructor/courses/$courseId/assignments"
      params={{ courseId: event.courseId }}
      className={className}
    >
      {body}
    </Link>
  );
}

function viewLabel(view: CalendarView) {
  if (view === "month") return "Month";
  if (view === "week") return "Week";
  return "Day";
}
