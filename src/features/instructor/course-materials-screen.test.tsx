import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseMaterialsScreen } from "./course-materials-screen";
import { getOwnedCourse } from "./lessons-api";
import type { CourseMaterial } from "./course-material";
import { listCourseMaterials, uploadCourseMaterial } from "./course-materials-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

vi.mock("./lessons-api", () => ({
  getOwnedCourse: vi.fn(),
}));

vi.mock("./course-materials-api", () => ({
  listCourseMaterials: vi.fn(),
  uploadCourseMaterial: vi.fn(),
  createMaterialDownloadUrl: vi.fn(),
}));

const getCourse = vi.mocked(getOwnedCourse);
const listMaterials = vi.mocked(listCourseMaterials);
const upload = vi.mocked(uploadCourseMaterial);

const stored: CourseMaterial = {
  id: "material-1",
  courseId: "course-1",
  fileName: "notes.pdf",
  mimeType: "application/pdf",
  byteSize: 5,
  storagePath: "course-1/material-1/notes.pdf",
  createdAt: "2026-11-02T00:00:00.000Z",
};

function pdf() {
  const file = new File(["hello"], "notes.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: 5 });
  return file;
}

describe("CourseMaterialsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show a form when the course is not returned", async () => {
    getCourse.mockResolvedValue({ ok: true, course: null });
    listMaterials.mockResolvedValue({ ok: true, materials: [] });

    render(<CourseMaterialsScreen courseId="missing" />);

    expect(await screen.findByText("This course is not available.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Courses" })).toBeInTheDocument();
    expect(screen.queryByLabelText("File")).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("uploads a draft file and retries the failed row", async () => {
    getCourse.mockResolvedValue({
      ok: true,
      course: { id: "course-1", title: "Algebra", status: "draft" },
    });
    listMaterials.mockResolvedValue({ ok: true, materials: [] });
    upload
      .mockResolvedValueOnce({ ok: false, message: "storage down", material: stored })
      .mockResolvedValueOnce({ ok: true, material: stored });

    render(<CourseMaterialsScreen courseId="course-1" />);

    expect(await screen.findByRole("heading", { name: "Algebra" })).toBeInTheDocument();
    const input = screen.getByLabelText("File");
    Object.defineProperty(input, "files", { value: [pdf()] });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("storage down");
    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
    expect(screen.getByText("0.0 MB")).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1);

    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByRole("status")).toHaveTextContent("This file was uploaded.");
    expect(upload).toHaveBeenNthCalledWith(2, "course-1", expect.any(File), stored);
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
  });

  it("lists a frozen course without the file input", async () => {
    getCourse.mockResolvedValue({
      ok: true,
      course: { id: "course-1", title: null, status: "pending" },
    });
    listMaterials.mockResolvedValue({ ok: true, materials: [stored] });

    render(<CourseMaterialsScreen courseId="course-1" />);

    expect(await screen.findByRole("heading", { name: "Materials" })).toBeInTheDocument();
    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
    expect(screen.queryByLabelText("File")).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });
});
