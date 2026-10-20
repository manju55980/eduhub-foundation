import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CertificateScreen } from "./certificate-screen";
import { getStudentCertificate } from "./certificates-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={typeof to === "string" ? to : "#"}>{children}</a>
  ),
}));

vi.mock("./certificates-api", () => ({
  getStudentCertificate: vi.fn(),
}));

const getCertificate = vi.mocked(getStudentCertificate);

describe("CertificateScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the academic certificate and can print or download it", async () => {
    getCertificate.mockResolvedValue({
      ok: true,
      certificate: {
        id: "cert-1",
        courseId: "course-1",
        courseTitle: "Algebra",
        issuedAt: "2026-10-18T15:00:00.000Z",
      },
    });
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const createUrl = vi.fn(() => "blob:certificate");
    const revokeUrl = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: createUrl,
      revokeObjectURL: revokeUrl,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(
      <CertificateScreen studentId="student-1" certificateId="cert-1" studentName="Ada Lovelace" />,
    );

    expect(await screen.findByRole("heading", { name: "Certificate of Completion" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getAllByText("Algebra")).toHaveLength(2);
    expect(screen.getByText("cert-1")).toBeInTheDocument();
    expect(screen.getByLabelText("EduHub achievement seal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(createUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeUrl).toHaveBeenCalledWith("blob:certificate");

    print.mockRestore();
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it("shows an error when the certificate is not available", async () => {
    getCertificate.mockResolvedValue({ ok: false, message: "This certificate is not available." });

    render(
      <CertificateScreen studentId="student-1" certificateId="cert-missing" studentName="Ada" />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("This certificate is not available.");
    expect(screen.queryByRole("button", { name: "Print" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download PDF" })).not.toBeInTheDocument();
  });
});
