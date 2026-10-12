import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCategories } from "@/features/categories/categories-api";

import { CreateCourseScreen } from "./create-course-screen";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/features/categories/categories-api", () => ({
  listCategories: vi.fn(),
}));

const listCourseCategories = vi.mocked(listCategories);

describe("CreateCourseScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCourseCategories.mockResolvedValue({ ok: true, categories: [] });
  });

  it("does not offer a second action after the form", async () => {
    render(<CreateCourseScreen instructorId="instructor-1" />);

    expect(await screen.findByRole("heading", { name: "Create Course" })).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Category" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create another course" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title *" })).toBeInTheDocument();
  });

  it("does not offer save when categories fail to load", async () => {
    listCourseCategories.mockResolvedValue({ ok: false, message: "Could not load categories." });

    render(<CreateCourseScreen instructorId="instructor-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load categories.");
    expect(screen.queryByRole("button", { name: "Save course" })).not.toBeInTheDocument();
  });
});
