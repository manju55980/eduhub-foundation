import { describe, expect, it } from "vitest";

import { buildCertificatePdf } from "./certificate-pdf";
import { visibleCertificates } from "./certificates";

const completed = { id: "enrollment-1", status: "completed" };
const certificate = {
  id: "cert-1",
  enrollmentId: "enrollment-1",
  courseId: "course-1",
  issuedAt: "2026-10-18T15:00:00.000Z",
};

describe("visibleCertificates", () => {
  it("keeps a completed enrollment and leaves a missing course title blank", () => {
    expect(visibleCertificates([certificate], [completed], [])).toEqual([
      {
        id: "cert-1",
        courseId: "course-1",
        courseTitle: "",
        issuedAt: "2026-10-18T15:00:00.000Z",
      },
    ]);
  });

  it("hides a certificate when the enrollment is no longer completed", () => {
    expect(
      visibleCertificates([certificate], [{ id: "enrollment-1", status: "active" }], [
        { id: "course-1", title: "Algebra" },
      ]),
    ).toEqual([]);
  });

  it("orders newer certificates first", () => {
    const older = { ...certificate, id: "cert-old", issuedAt: "2026-09-01T00:00:00.000Z" };
    const titles = [{ id: "course-1", title: "Algebra" }];
    expect(
      visibleCertificates([older, certificate], [completed], titles).map((row) => row.id),
    ).toEqual(["cert-1", "cert-old"]);
  });
});

describe("buildCertificatePdf", () => {
  it("builds a landscape PDF with the certificate text", () => {
    const bytes = buildCertificatePdf({
      studentName: "Ada Lovelace",
      courseTitle: "Algebra (foundations)",
      completedOn: "October 18, 2026",
      certificateId: "cert-1",
    });
    const text = new TextDecoder().decode(bytes);

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 792 612]");
    expect(text).toContain("(EduHub)");
    expect(text).toContain("(Ada Lovelace)");
    expect(text).toContain("(Algebra \\(foundations\\))");
    expect(text).toContain("(Certificate ID cert-1)");
    expect(text).toContain("(SEAL)");
  });
});
