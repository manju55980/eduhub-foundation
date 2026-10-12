import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCategories } from "@/features/categories/categories-api";

import { createCategory, deleteCategory, renameCategory } from "./categories-api";
import { CategoriesScreen } from "./categories-screen";

vi.mock("@/features/categories/categories-api", () => ({
  listCategories: vi.fn(),
}));

vi.mock("./categories-api", () => ({
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

const list = vi.mocked(listCategories);
const create = vi.mocked(createCategory);
const rename = vi.mocked(renameCategory);
const remove = vi.mocked(deleteCategory);

const science = {
  id: "category-1",
  name: "Science",
  createdAt: "2026-10-10T00:00:00.000Z",
};

describe("CategoriesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the create form and no sample categories when the list is empty", async () => {
    list.mockResolvedValue({ ok: true, categories: [] });

    render(<CategoriesScreen />);

    expect(await screen.findByText("There are no categories yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
  });

  it("creates a trimmed category and clears the form", async () => {
    list.mockResolvedValue({ ok: true, categories: [] });
    create.mockResolvedValue({
      ok: true,
      category: { ...science, name: "Science" },
    });

    render(<CategoriesScreen />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Name *" }), {
      target: { value: "  Science  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith("Science"));
    expect(await screen.findByRole("status")).toHaveTextContent("This category was created.");
    expect(screen.getByRole("heading", { name: "Science" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name *" })).toHaveValue("");
  });

  it("rejects a blank name before creating", async () => {
    list.mockResolvedValue({ ok: true, categories: [] });

    render(<CategoriesScreen />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Name *" }), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a category name.");
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Name *" })).toHaveValue("   ");
  });

  it("leaves the entered name in place when the unique name is rejected", async () => {
    list.mockResolvedValue({ ok: true, categories: [science] });
    create.mockResolvedValue({
      ok: false,
      message: 'duplicate key value violates unique constraint "categories_name_uidx"',
    });

    render(<CategoriesScreen />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Name *" }), {
      target: { value: "Science" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("categories_name_uidx");
    expect(screen.getByRole("heading", { name: "Science" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name *" })).toHaveValue("Science");
  });

  it("renames a category and keeps it listed", async () => {
    list.mockResolvedValue({ ok: true, categories: [science] });
    rename.mockResolvedValue({ ok: true, name: "Biology" });

    render(<CategoriesScreen />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "  Biology  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => expect(rename).toHaveBeenCalledWith("category-1", "Biology"));
    expect(await screen.findByRole("status")).toHaveTextContent("This category was renamed.");
    expect(screen.getByRole("heading", { name: "Biology" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Biology");
  });

  it("deletes an unused category", async () => {
    list.mockResolvedValue({ ok: true, categories: [science] });
    remove.mockResolvedValue({ ok: true });

    render(<CategoriesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("category-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("This category was deleted.");
    expect(screen.queryByRole("heading", { name: "Science" })).not.toBeInTheDocument();
    expect(screen.getByText("There are no categories yet.")).toBeInTheDocument();
  });

  it("leaves a referenced category listed when delete is rejected", async () => {
    list.mockResolvedValue({ ok: true, categories: [science] });
    remove.mockResolvedValue({
      ok: false,
      message: 'update or delete on table "categories" violates foreign key constraint',
    });

    render(<CategoriesScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("foreign key constraint");
    expect(screen.getByRole("heading", { name: "Science" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("does not offer create, rename, or delete when the list fails to load", async () => {
    list.mockResolvedValue({ ok: false, message: "Could not load categories." });

    render(<CategoriesScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load categories.");
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
