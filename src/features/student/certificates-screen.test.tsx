import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatCertificateDate } from "./certificates";
import { CertificatesScreen } from "./certificates-screen";
import { listStudentCertificates } from "./certificates-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children?: ReactNode;
    to?: string;
    params?: { certificateId?: string };
  }) => (
    <a href={params?.certificateId ? `/student/certificates/${params.certificateId}` : (to ?? "#")}>
      {children}
    </a>
  ),
}));

vi.mock("./certificates-api", () => ({
  listStudentCertificates: vi.fn(),
}));

const listCertificates = vi.mocked(listStudentCertificates);

const certificate = {
  id: "cert-1",
  courseId: "course-1",
  courseTitle: "Algebra",
  issuedAt: "2026-10-18T15:00:00.000Z",
};

describe("CertificatesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty list that links to My Courses", async () => {
    listCertificates.mockResolvedValue({ ok: true, certificates: [] });

    render(<CertificatesScreen studentId="student-1" />);

    expect(screen.getByText("Loading certificates…")).toBeInTheDocument();
    expect(await screen.findByText("You have no certificates yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Courses" })).toHaveAttribute(
      "href",
      "/student/my-courses",
    );
    expect(screen.queryByRole("link", { name: "View Certificate" })).not.toBeInTheDocument();
  });

  it("shows the course, completion date, and a separate view action", async () => {
    listCertificates.mockResolvedValue({ ok: true, certificates: [certificate] });

    render(<CertificatesScreen studentId="student-1" />);

    expect(await screen.findByRole("heading", { name: "Algebra" })).toBeInTheDocument();
    expect(screen.getByText(formatCertificateDate(certificate.issuedAt))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Certificate" })).toHaveAttribute(
      "href",
      "/student/certificates/cert-1",
    );
  });

  it("shows a load error and does not invent a certificate", async () => {
    listCertificates.mockResolvedValue({ ok: false, message: "Could not load certificates." });

    render(<CertificatesScreen studentId="student-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load certificates.");
    expect(screen.queryByRole("link", { name: "View Certificate" })).not.toBeInTheDocument();
    expect(screen.queryByText("Algebra")).not.toBeInTheDocument();
  });
});
