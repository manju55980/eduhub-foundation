import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BookOpen, GraduationCap, Save, Sprout } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { listCategories } from "@/features/categories/categories-api";
import { CategorySelect } from "@/features/categories/category-select";
import type { CourseCategory } from "@/features/categories/category-name";

import { courseLevels } from "./course-draft";
import { courseFieldUpdate } from "./course-update";
import { createDraftCourse } from "./create-course-api";

const descriptionLimit = 2000;

const levelLabels: Record<(typeof courseLevels)[number], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function CreateCourseScreen({ instructorId }: { instructorId: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    listCategories().then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setCategories(result.categories);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || loadError) return;

    const draft = courseFieldUpdate(title, description, level, categoryId);
    if (!draft.ok) {
      setSaved(false);
      setMessage(draft.message);
      return;
    }

    setPending(true);
    const result = await createDraftCourse({
      instructorId,
      title: draft.changes.title,
      description: draft.changes.description,
      level: draft.changes.level,
      categoryId: draft.changes.categoryId,
    });
    setPending(false);

    if (!result.ok) {
      setSaved(false);
      setMessage(result.message);
      return;
    }

    setTitle("");
    setDescription("");
    setLevel("");
    setCategoryId("");
    setSaved(true);
    setMessage("This course was saved as a draft.");
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,42rem)_16rem]">
      <div className="space-y-4">
        <PageHeader
          title="Create Course"
          description="Share your knowledge and help learners grow. Save your course as a draft and continue editing later."
          backTo="/instructor"
          backLabel="Instructor Dashboard"
        />

        {loadError ? <ErrorState message={loadError} /> : null}
        {loading ? <LoadingState message="Loading categories…" /> : null}
        {!loading && !loadError ? (
          <form
            className="space-y-4 rounded-sm border border-border bg-card p-4 shadow-none"
            onSubmit={handleSubmit}
          >
            <Field id="course-title" label="Title" hint="This will be the name of your course.">
              <Input
                id="course-title"
                value={title}
                placeholder="e.g. Introduction to React"
                onChange={(event) => setTitle(event.target.value)}
                disabled={pending}
              />
            </Field>
            <Field id="course-description" label="Description" hint="Keep it clear and concise.">
              <div className="relative">
                <Textarea
                  id="course-description"
                  value={description}
                  maxLength={descriptionLimit}
                  placeholder="Tell learners what this course is about, what they'll learn, and who it's for..."
                  className="min-h-28 pb-7"
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={pending}
                />
                <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground">
                  {description.length}/{descriptionLimit}
                </span>
              </div>
            </Field>
            <Field
              id="course-level"
              label="Level"
              hint="Select the appropriate level for your course."
            >
              <Select
                key={level || "none"}
                {...(level ? { value: level } : {})}
                onValueChange={setLevel}
                disabled={pending}
              >
                <SelectTrigger id="course-level" className="w-full">
                  <SelectValue placeholder="Choose a level" />
                </SelectTrigger>
                <SelectContent>
                  {courseLevels.map((item) => (
                    <SelectItem key={item} value={item}>
                      {levelLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="course-category" label="Category" hint="Optional." required={false}>
              <CategorySelect
                id="course-category"
                categories={categories}
                categoryId={categoryId}
                onChange={setCategoryId}
                disabled={pending}
              />
            </Field>
            <Button type="submit" disabled={pending}>
              <Save />
              {pending ? "Saving…" : "Save course"}
            </Button>
          </form>
        ) : null}

        <SaveNotice
          tone="instructor"
          saved={saved}
          message={message}
          onDismiss={() => {
            setSaved(false);
            setMessage("");
          }}
        />
      </div>

      <aside className="hidden lg:block">
        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="size-4" />
            <GraduationCap className="size-4" />
            <Sprout className="size-4" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Create engaging learning experiences
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your expertise can make a real difference. Create a course, share your knowledge, and
            help learners reach their goals.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  required = true,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
