import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOwnProfile, updateOwnProfile } from "./auth-api";
import { ProfileScreen } from "./profile-screen";

const invalidate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
  useRouter: () => ({ invalidate }),
}));

vi.mock("./auth-api", () => ({
  getOwnProfile: vi.fn(),
  updateOwnProfile: vi.fn(),
}));

const loadProfile = vi.mocked(getOwnProfile);
const saveProfile = vi.mocked(updateOwnProfile);

const loaded = {
  ok: true as const,
  profile: {
    id: "student-1",
    email: "",
    fullName: "Ada Lovelace",
    phone: "555",
    role: "student" as const,
  },
};

describe("ProfileScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the stored profile and a blank email", async () => {
    loadProfile.mockResolvedValue(loaded);

    render(<ProfileScreen userId="student-1" title="My Profile" role="student" />);

    expect(screen.getByText("Loading profile…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "My Profile" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Ada Lovelace");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveValue("555");
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("shows the instructor heading and role", async () => {
    loadProfile.mockResolvedValue({
      ...loaded,
      profile: { ...loaded.profile, id: "instructor-1", role: "instructor" },
    });

    render(<ProfileScreen userId="instructor-1" title="Profile" role="instructor" />);

    expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByText("Instructor")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("saves the trimmed fields and refreshes the session", async () => {
    loadProfile.mockResolvedValue(loaded);
    saveProfile.mockResolvedValue({ ok: true });

    render(<ProfileScreen userId="student-1" title="My Profile" role="student" />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "  Ada Lovelace  " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "  ada@example.com  " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone" }), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("status")).toHaveTextContent("This profile was saved.");
    expect(saveProfile).toHaveBeenCalledWith("student-1", {
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: null,
    });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Ada Lovelace");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("ada@example.com");
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveValue("");
  });

  it("keeps the entered values when the save fails", async () => {
    loadProfile.mockResolvedValue(loaded);
    saveProfile.mockResolvedValue({ ok: false, message: "update failed" });

    render(<ProfileScreen userId="student-1" title="My Profile" role="student" />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "Grace Hopper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("update failed");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Grace Hopper");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("does not offer save when the profile cannot be loaded", async () => {
    loadProfile.mockResolvedValue({
      ok: false,
      message: "Your profile is missing or has an unknown role.",
    });

    render(<ProfileScreen userId="instructor-1" title="Profile" role="instructor" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your profile is missing or has an unknown role.",
    );
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
    expect(screen.queryByText("Instructor")).not.toBeInTheDocument();
  });

  it("does not save an email that fails validation", async () => {
    loadProfile.mockResolvedValue(loaded);
    render(<ProfileScreen userId="student-1" title="My Profile" role="student" />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Email" }), {
      target: { value: "ada@example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid email.");
    expect(saveProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("ada@example");
  });
});
