import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import {
  checkMaterialFile,
  materialBucket,
  sameMaterialFile,
  signedUrlSeconds,
  type CourseMaterial,
  type MaterialFileInput,
} from "./course-material";

type CourseMaterialRow = Database["public"]["Tables"]["course_materials"]["Row"];
type CourseMaterialInsert = Database["public"]["Tables"]["course_materials"]["Insert"];

const materialColumns =
  "id, course_id, file_name, mime_type, byte_size, storage_path, created_at" as const;

export type MaterialUploadResult =
  | { ok: true; material: CourseMaterial }
  | { ok: false; message: string; material: CourseMaterial | null };

export type MaterialIo = {
  insert: (input: {
    courseId: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
  }) => Promise<{ ok: true; material: CourseMaterial } | { ok: false; message: string }>;
  upload: (
    storagePath: string,
    file: Blob,
    mimeType: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
};

function toMaterial(row: CourseMaterialRow): CourseMaterial {
  return {
    id: row.id,
    courseId: row.course_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export async function listCourseMaterials(courseId: string) {
  const { data, error } = await supabase
    .from("course_materials")
    .select(materialColumns)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, materials: (data ?? []).map(toMaterial) };
}

export async function listMaterialsForCourses(courseIds: string[]) {
  if (courseIds.length === 0) return { ok: true as const, materials: [] as CourseMaterial[] };

  const { data, error } = await supabase
    .from("course_materials")
    .select(materialColumns)
    .in("course_id", courseIds)
    .order("created_at", { ascending: false });

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, materials: (data ?? []).map(toMaterial) };
}

export async function insertCourseMaterial(input: {
  courseId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}) {
  // The trigger sets storage_path. That column is not granted, so the insert omits it.
  const grantedInsert = {
    course_id: input.courseId,
    file_name: input.fileName,
    mime_type: input.mimeType,
    byte_size: input.byteSize,
  } satisfies Omit<CourseMaterialInsert, "storage_path">;
  const { data, error } = await supabase
    .from("course_materials")
    .insert(grantedInsert as CourseMaterialInsert)
    .select(materialColumns)
    .single();

  if (error || !data) {
    return { ok: false as const, message: error?.message ?? "The file could not be saved." };
  }
  return { ok: true as const, material: toMaterial(data) };
}

export async function uploadMaterialObject(storagePath: string, file: Blob, mimeType: string) {
  const { error } = await supabase.storage.from(materialBucket).upload(storagePath, file, {
    contentType: mimeType,
  });
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

export async function createMaterialDownloadUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(materialBucket)
    .createSignedUrl(storagePath, signedUrlSeconds);
  if (error || !data.signedUrl) {
    return { ok: false as const, message: error?.message ?? "The file could not be downloaded." };
  }
  return { ok: true as const, url: data.signedUrl };
}

const defaultIo: MaterialIo = {
  insert: insertCourseMaterial,
  upload: uploadMaterialObject,
};

export async function uploadCourseMaterial(
  courseId: string,
  file: MaterialFileInput & Blob,
  pending: CourseMaterial | null,
  io: MaterialIo = defaultIo,
): Promise<MaterialUploadResult> {
  const checked = checkMaterialFile(file);
  if (!checked.ok) return { ok: false, message: checked.message, material: null };

  const reused =
    pending && pending.courseId === courseId && sameMaterialFile(pending, checked.file)
      ? pending
      : null;
  const inserted = reused
    ? { ok: true as const, material: reused }
    : await io.insert({ courseId, ...checked.file });
  if (!inserted.ok) return { ok: false, message: inserted.message, material: null };

  const uploaded = await io.upload(inserted.material.storagePath, file, checked.file.mimeType);
  if (!uploaded.ok) {
    return { ok: false, message: uploaded.message, material: inserted.material };
  }
  return { ok: true, material: inserted.material };
}
