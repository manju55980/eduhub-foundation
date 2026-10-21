import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UsersScreen } from "./users-screen";
import { listUsers, promoteStudent } from "./users-api";

vi.mock("./users-api", () => ({
  listUsers: vi.fn(),
  promoteStudent: vi.fn(),
}));

const list = vi.mocked(listUsers);
const promote = vi.mocked(promoteStudent);

const users = [
  {
    id: "admin-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    role: "admin",
    createdAt: "2026-10-10T00:00:00.000Z",
  },
  {
    id: "instructor-1",
    fullName: "Grace Hopper",
    email: "grace@example.com",
    role: "instructor",
    createdAt: "2026-10-09T00:00:00.000Z",
  },
  {
    id: "student-1",
    fullName: "Alan Turing",
    email: "alan@example.com",
    role: "student",
    createdAt: "2026-10-08T00:00:00.000Z",
  },
];

describe("UsersScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers promote only for another student", async () => {
    list.mockResolvedValue({ ok: true, users });

    render(<UsersScreen adminId="admin-1" />);

    expect(await screen.findByRole("heading", { name: "Alan Turing" })).toBeInTheDocument();
    expect(screen.getByText("alan@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Student").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Promote" })).toHaveLength(1);
    const emailCell = screen.getByText("alan@example.com").closest("td");
    expect(emailCell).toHaveTextContent("Email");
    const table = screen.getByRole("table");
    expect(table).toHaveClass("md:table");
    expect(table.className).not.toMatch(/(^|\s)min-w-\[40rem\]/);
    expect(screen.queryByText(/phone/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /demote|delete|invite|edit/i }),
    ).not.toBeInTheDocument();
  });

  it("promotes that student and removes the control", async () => {
    list.mockResolvedValue({ ok: true, users });
    promote.mockResolvedValue({ ok: true });

    render(<UsersScreen adminId="admin-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Promote" }));

    await waitFor(() => expect(promote).toHaveBeenCalledWith("student-1"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "This user was promoted to instructor.",
    );
    expect(screen.getByRole("heading", { name: "Alan Turing" })).toBeInTheDocument();
    expect(screen.getAllByText("Instructor").length).toBeGreaterThan(1);
    expect(screen.queryByRole("button", { name: "Promote" })).not.toBeInTheDocument();
  });

  it("leaves the student in place when promotion is rejected", async () => {
    list.mockResolvedValue({ ok: true, users });
    promote.mockResolvedValue({ ok: false, message: "only an admin can promote a student" });

    render(<UsersScreen adminId="admin-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Promote" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "only an admin can promote a student",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByText("Student").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Promote" })).toBeInTheDocument();
  });

  it("shows a repeated promotion error without changing the role", async () => {
    list.mockResolvedValue({ ok: true, users });
    promote.mockResolvedValue({ ok: false, message: "this user is already an instructor" });

    render(<UsersScreen adminId="admin-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Promote" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "this user is already an instructor",
    );
    expect(screen.getAllByText("Student").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Promote" })).toBeInTheDocument();
  });

  it("shows an empty list without a promote control", async () => {
    list.mockResolvedValue({ ok: true, users: [] });

    render(<UsersScreen adminId="admin-1" />);

    expect(await screen.findByText("There are no users yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Promote" })).not.toBeInTheDocument();
  });

  it("does not offer promote when the list fails to load", async () => {
    list.mockResolvedValue({ ok: false, message: "Could not load users." });

    render(<UsersScreen adminId="admin-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load users.");
    expect(screen.queryByRole("button", { name: "Promote" })).not.toBeInTheDocument();
  });
});
