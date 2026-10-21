import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LandingPage } from "./landing-page";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to ?? "#"}>{children}</a>
  ),
}));

describe("LandingPage", () => {
  it("links sign-in and the three role areas", () => {
    render(<LandingPage checking={false} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Courses, submissions and grades",
    );
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/auth", "/student", "/instructor", "/admin", "#roles"]),
    );
    expect(screen.queryByText(/next phase/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Study Companion" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Learning Assistant" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI Course Builder" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Instructor creates a course" })).toBeInTheDocument();
    expect(screen.getByText("My certificates")).toBeInTheDocument();
    expect(screen.getByText("Archive courses")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Certificate and Completed" })).toBeInTheDocument();
  });

  it("hides sign-in while the session is still loading", () => {
    render(<LandingPage checking />);

    expect(screen.getByText("Checking session…")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
