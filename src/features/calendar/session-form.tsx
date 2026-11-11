import { useEffect, useState, type FormEvent } from "react";

import { ErrorState } from "@/components/app-shell/page-state";
import { selectFieldClass } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toDateTimeLocal } from "@/features/instructor/assignment-draft";

import { listCalendarCourses, saveClassSession } from "./calendar-api";
import type { CalendarEvent } from "./calendar-model";
import { classSessionDraft, meetingWindow } from "./session-draft";

export type SessionForm = {
  id: string | null;
  courseId: string;
  courseTitle: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
};

type CourseOption = { id: string; title: string };

export function newSessionForm(day: Date): SessionForm {
  const times = meetingWindow(day);
  return {
    id: null,
    courseId: "",
    courseTitle: "",
    title: "",
    startsAt: times.startsAt,
    endsAt: times.endsAt,
    location: "",
  };
}

export function editSessionForm(event: CalendarEvent): SessionForm {
  return {
    id: event.id,
    courseId: event.courseId,
    courseTitle: event.courseTitle,
    title: event.title,
    startsAt: toDateTimeLocal(event.startsAt),
    endsAt: event.endsAt ? toDateTimeLocal(event.endsAt) : "",
    location: event.location ?? "",
  };
}

export function ClassSessionDialog({
  session,
  onClose,
  onSaved,
}: {
  session: SessionForm | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SessionForm | null>(session);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseError, setCourseError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    setForm(session);
    setFormError("");
    setCourseError("");
    setSaving(false);
    let active = true;
    setLoadingCourses(true);
    listCalendarCourses().then((result) => {
      if (!active) return;
      setLoadingCourses(false);
      if (!result.ok) {
        setCourses([]);
        setCourseError(result.message);
        return;
      }
      setCourses(result.courses);
    });
    return () => {
      active = false;
    };
  }, [session]);

  const editing = Boolean(form?.id);
  const options = courseOptions(courses, form);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || saving) return;
    const draft = classSessionDraft(form);
    if (!draft.ok) {
      setFormError(draft.message);
      return;
    }
    setSaving(true);
    setFormError("");
    const result = await saveClassSession(form.id, draft.session);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    onSaved();
  }

  return (
    <Dialog
      open={session !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit class" : "Add class"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "The course stays the same. Change the title, time, or location."
              : "Add a meeting to a course you teach."}
          </DialogDescription>
        </DialogHeader>
        {form ? (
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="class-course">Course</Label>
              <select
                id="class-course"
                className={selectFieldClass}
                value={form.courseId}
                disabled={editing || loadingCourses || Boolean(courseError)}
                onChange={(event) => setForm({ ...form, courseId: event.target.value })}
              >
                <option value="">{loadingCourses ? "Loading courses…" : "Choose a course"}</option>
                {options.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-title">Title</Label>
              <Input
                id="class-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="class-start">Start</Label>
                <Input
                  id="class-start"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="class-end">End</Label>
                <Input
                  id="class-end"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-location">Location</Label>
              <Input
                id="class-location"
                value={form.location}
                placeholder="Optional"
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
            </div>
            {courseError ? <ErrorState message={courseError} /> : null}
            {!loadingCourses && !courseError && courses.length === 0 && !editing ? (
              <p className="text-sm text-muted-foreground">
                Create a course before adding a class.
              </p>
            ) : null}
            {formError ? <ErrorState message={formError} /> : null}
            <Button type="submit" disabled={saving || loadingCourses || Boolean(courseError)}>
              {saving ? "Saving…" : "Save class"}
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function courseOptions(courses: CourseOption[], form: SessionForm | null) {
  if (!form?.courseId || courses.some((course) => course.id === form.courseId)) return courses;
  const title = form.courseTitle.trim() || "Untitled course";
  return [{ id: form.courseId, title }, ...courses];
}
