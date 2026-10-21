import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getOwnProfile, updateOwnProfile } from "./auth-api";
import { ProfileMenu } from "./profile-menu";

const invalidate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
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
    id: "user-1",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    phone: "555",
    role: "student" as const,
  },
};

describe("ProfileMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadProfile.mockResolvedValue(loaded);
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the signed-in name, email, and role, then edits in a modal", async () => {
    for (const role of ["student", "instructor", "admin"] as const) {
      const view = render(
        <ProfileMenu role={role} email="ada@example.com" fullName="Ada Lovelace" userId="user-1" />,
      );
      expect(screen.getByRole("button", { name: "Open profile" })).toHaveTextContent("AL");
      view.unmount();
    }

    render(
      <ProfileMenu role="student" email="ada@example.com" fullName="Ada Lovelace" userId="user-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open profile" }));

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("Student")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));

    expect(screen.getByText("Loading profile…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Edit profile" })).toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: "Name" })).toHaveValue("Ada Lovelace");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("ada@example.com");
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveValue("555");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(loadProfile).toHaveBeenCalledWith("user-1");
  });

  it("does not save an email that fails validation", async () => {
    render(
      <ProfileMenu role="instructor" email="ada@example.com" fullName="Ada Lovelace" userId="user-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));

    fireEvent.change(await screen.findByRole("textbox", { name: "Email" }), {
      target: { value: "ada@example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid email.");
    expect(saveProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("ada@example");
  });

  it("saves through the signed-in profile update and shows the success banner", async () => {
    saveProfile.mockResolvedValue({ ok: true });

    render(<ProfileMenu role="admin" email="ada@example.com" fullName="" userId="admin-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Open profile" }));
    expect(screen.getByText("Admin")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));

    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "  Grace Hopper  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("status")).toHaveTextContent("This profile was saved.");
    expect(saveProfile).toHaveBeenCalledWith("admin-1", {
      full_name: "Grace Hopper",
      email: "ada@example.com",
      phone: "555",
    });
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("keeps the entered values when the save fails", async () => {
    saveProfile.mockResolvedValue({ ok: false, message: "update failed" });

    render(
      <ProfileMenu role="student" email="ada@example.com" fullName="Ada Lovelace" userId="user-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Phone" }), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("update failed");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveValue("999");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("does not offer save when the profile cannot be loaded", async () => {
    loadProfile.mockResolvedValue({
      ok: false,
      message: "Your profile is missing or has an unknown role.",
    });

    render(
      <ProfileMenu role="student" email="ada@example.com" fullName="Ada Lovelace" userId="user-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your profile is missing or has an unknown role.",
    );
    expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
  });
});
