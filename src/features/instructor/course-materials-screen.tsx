import { useEffect, useRef, useState, type FormEvent } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { PageSection } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CourseMaterialList } from "@/features/courses/course-material-list";

import { getOwnedCourse, type OwnedCourse } from "./lessons-api";
import { SaveNotice } from "./save-notice";
import { type CourseMaterial } from "./course-material";
import { listCourseMaterials, uploadCourseMaterial } from "./course-materials-api";

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

const acceptedFiles = ".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg";

export function CourseMaterialsScreen({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<OwnedCourse | null>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [failed, setFailed] = useState<CourseMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(emptyNotice);
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMissing(false);
    setLoadError("");
    setCourse(null);
    setMaterials([]);
    setFailed(null);
    setNotice(emptyNotice);

    Promise.all([getOwnedCourse(courseId), listCourseMaterials(courseId)]).then(
      ([courseResult, materialsResult]) => {
        if (!active) return;
        setLoading(false);
        if (!courseResult.ok) {
          setLoadError(courseResult.message);
          return;
        }
        if (!courseResult.course) {
          setMissing(true);
          return;
        }
        setCourse(courseResult.course);
        if (!materialsResult.ok) {
          setLoadError(materialsResult.message);
          return;
        }
        setMaterials(materialsResult.materials);
      },
    );

    return () => {
      active = false;
    };
  }, [courseId]);

  const heading = course?.title ? course.title : "Materials";
  const canUpload = course?.status === "draft";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadingRef.current || !course) return;
    const selected = inputRef.current?.files?.[0];
    if (!selected) {
      setNotice({ saved: false, message: "Choose a file." });
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    const result = await uploadCourseMaterial(course.id, selected, failed);
    uploadingRef.current = false;
    setUploading(false);
    if (!result.ok) {
      if (result.material) {
        const material = result.material;
        setMaterials((current) => upsertMaterial(current, material));
        setFailed(material);
      }
      setNotice({ saved: false, message: result.message });
      return;
    }

    setMaterials((current) => upsertMaterial(current, result.material));
    setFailed(null);
    if (inputRef.current) inputRef.current.value = "";
    setNotice({ saved: true, message: "This file was uploaded." });
  }

  return (
    <PageSection>
      <PageHeader title={heading} backTo="/instructor/courses" backLabel="My Courses" />
      <SaveNotice
        tone="instructor"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading files…" /> : null}
      {missing ? <EmptyState message="This course is not available." /> : null}
      {course && !loadError && !loading ? (
        <>
          {canUpload ? (
            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <div className="space-y-2">
                <Label htmlFor="course-material-file">File</Label>
                <Input
                  id="course-material-file"
                  ref={inputRef}
                  type="file"
                  accept={acceptedFiles}
                  disabled={uploading}
                />
              </div>
              <Button type="submit" disabled={uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </form>
          ) : null}
          <CourseMaterialList materials={materials} />
        </>
      ) : null}
    </PageSection>
  );
}

function upsertMaterial(current: CourseMaterial[], material: CourseMaterial) {
  return [material, ...current.filter((item) => item.id !== material.id)];
}
