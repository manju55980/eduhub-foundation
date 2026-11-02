import { describe, expect, it, vi } from "vitest";

import {
  checkMaterialFile,
  materialByteLimit,
  materialSizeLabel,
  signedUrlSeconds,
  type CourseMaterial,
} from "./course-material";
import { uploadCourseMaterial, type MaterialIo } from "./course-materials-api";

const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const stored: CourseMaterial = {
  id: "material-1",
  courseId: "course-1",
  fileName: "notes.pdf",
  mimeType: "application/pdf",
  byteSize: 5,
  storagePath: "course-1/material-1/notes.pdf",
  createdAt: "2026-11-02T00:00:00.000Z",
};

function file(name: string, type: string, size: number) {
  return { name, type, size };
}

describe("checkMaterialFile", () => {
  it("accepts the allowed types at the size limit and rejects the rest", () => {
    expect(materialSizeLabel(materialByteLimit)).toBe("20.0 MB");
    expect(materialSizeLabel(1)).toBe("0.0 MB");
    expect(signedUrlSeconds).toBe(60);
    expect(checkMaterialFile(file(" Notes.PDF ", "application/pdf", materialByteLimit))).toEqual({
      ok: true,
      file: { fileName: "Notes.PDF", mimeType: "application/pdf", byteSize: materialByteLimit },
    });
    expect(checkMaterialFile(file("slides.pptx", docx, 12)).ok).toBe(false);
    expect(checkMaterialFile(file("notes.exe", "application/pdf", 12))).toMatchObject({
      ok: false,
      message: "This file type is not allowed.",
    });
    expect(checkMaterialFile(file("notes.pdf", "text/plain", 12))).toMatchObject({
      ok: false,
      message: "The file extension does not match its type.",
    });
    expect(checkMaterialFile(file("notes.pdf", "application/pdf", 0))).toMatchObject({
      ok: false,
      message: "This file is empty.",
    });
    expect(
      checkMaterialFile(file("notes.pdf", "application/pdf", materialByteLimit + 1)),
    ).toMatchObject({
      ok: false,
      message: "This file must be 20 MB or smaller.",
    });
    expect(checkMaterialFile(file("../notes.pdf", "application/pdf", 12))).toMatchObject({
      ok: false,
      message: "This file name is not allowed.",
    });
    expect(checkMaterialFile(file("photo.jpeg", "image/jpeg", 12)).ok).toBe(true);
  });

  it("uploads once and retries the same path without a second insert", async () => {
    const inserted = vi.fn(async () => ({ ok: true as const, material: stored }));
    const uploaded = vi
      .fn<MaterialIo["upload"]>()
      .mockResolvedValueOnce({ ok: false, message: "storage down" })
      .mockResolvedValueOnce({ ok: true });
    const io: MaterialIo = { insert: inserted, upload: uploaded };
    const selected = new File(["hello"], "notes.pdf", { type: "application/pdf" });
    Object.defineProperty(selected, "size", { value: 5 });

    const failed = await uploadCourseMaterial("course-1", selected, null, io);
    expect(failed).toEqual({ ok: false, message: "storage down", material: stored });
    expect(inserted).toHaveBeenCalledTimes(1);
    expect(inserted).toHaveBeenCalledWith({
      courseId: "course-1",
      fileName: "notes.pdf",
      mimeType: "application/pdf",
      byteSize: 5,
    });
    expect(uploaded).toHaveBeenCalledWith(stored.storagePath, selected, "application/pdf");

    const retried = await uploadCourseMaterial("course-1", selected, stored, io);
    expect(retried).toEqual({ ok: true, material: stored });
    expect(inserted).toHaveBeenCalledTimes(1);
    expect(uploaded).toHaveBeenCalledTimes(2);

    const empty = new File([""], "notes.pdf", { type: "application/pdf" });
    Object.defineProperty(empty, "size", { value: 0 });
    const rejected = await uploadCourseMaterial("course-1", empty, null, io);
    expect(rejected).toMatchObject({ ok: false, material: null });
    expect(inserted).toHaveBeenCalledTimes(1);
    expect(uploaded).toHaveBeenCalledTimes(2);
  });
});
