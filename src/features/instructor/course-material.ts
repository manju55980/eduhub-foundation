export const materialBucket = "course-materials";
export const materialByteLimit = 20_971_520;
export const signedUrlSeconds = 60;

const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export type MaterialFileInput = {
  name: string;
  type: string;
  size: number;
};

export type CheckedMaterialFile = {
  fileName: string;
  mimeType: string;
  byteSize: number;
};

export type CourseMaterial = {
  id: string;
  courseId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storagePath: string;
  createdAt: string;
};

export function materialSizeLabel(byteSize: number) {
  return `${(byteSize / 1_048_576).toFixed(1)} MB`;
}

export function checkMaterialFile(
  file: MaterialFileInput,
): { ok: true; file: CheckedMaterialFile } | { ok: false; message: string } {
  const fileName = file.name.trim();
  if (
    !fileName ||
    fileName === "." ||
    fileName === ".." ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    return { ok: false, message: "This file name is not allowed." };
  }
  if (file.size < 1) return { ok: false, message: "This file is empty." };
  if (file.size > materialByteLimit) {
    return { ok: false, message: "This file must be 20 MB or smaller." };
  }

  const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  const expectedMime = mimeByExtension[extension];
  if (!expectedMime || fileName.lastIndexOf(".") <= 0) {
    return { ok: false, message: "This file type is not allowed." };
  }
  if (file.type !== expectedMime) {
    return { ok: false, message: "The file extension does not match its type." };
  }

  return {
    ok: true,
    file: { fileName, mimeType: file.type, byteSize: file.size },
  };
}

export function sameMaterialFile(material: CourseMaterial, file: CheckedMaterialFile) {
  return (
    material.fileName === file.fileName &&
    material.mimeType === file.mimeType &&
    material.byteSize === file.byteSize
  );
}

export function materialsForCourse(materials: CourseMaterial[], courseId: string) {
  return materials
    .filter((material) => material.courseId === courseId)
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
    );
}
