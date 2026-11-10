import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SaveNotice } from "@/features/instructor/save-notice";
import { NotificationList } from "@/features/notifications/notification-list";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { DataCell, DataRow, DataTable } from "./data-table";
import { ChoiceButton, FilterToolbar, SummaryCounts } from "./management";
import { EmptyState, ErrorState, LoadingState } from "./page-state";
import { RecordCard } from "./record-card";
import { StatusBadge } from "./status-badge";

describe("shared controls", () => {
  it("keeps primary, outline, and small buttons on the control scale", () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="outline">Cancel</Button>
        <Button size="sm">Filter</Button>
        <Button disabled>Wait</Button>
      </>,
    );

    const save = screen.getByRole("button", { name: "Save" });
    expect(save.className).toContain("h-9");
    expect(save.className).toContain("bg-primary");
    expect(save.className).toContain("shadow-raised");
    expect(save.className).toContain("hover:bg-primary-hover");
    expect(save.className).toContain("focus-visible:ring-2");

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel.className).toContain("shadow-none");
    expect(cancel.className).toContain("hover:bg-sage");

    expect(screen.getByRole("button", { name: "Filter" }).className).toContain("h-8");
    expect(screen.getByRole("button", { name: "Wait" })).toBeDisabled();
  });

  it("keeps fields at 14px with no raised shadow", () => {
    render(
      <>
        <Input aria-label="Title" />
        <Textarea aria-label="Notes" />
      </>,
    );

    const title = screen.getByRole("textbox", { name: "Title" });
    expect(title.className).toContain("h-9");
    expect(title.className).toContain("text-sm");
    expect(title.className).toContain("shadow-none");
    expect(title.className).not.toContain("text-base");

    const notes = screen.getByRole("textbox", { name: "Notes" });
    expect(notes.className).toContain("min-h-[60px]");
    expect(notes.className).toContain("text-sm");
    expect(notes.className).toContain("shadow-none");
  });

  it("maps status and role labels to the approved tones", () => {
    render(
      <>
        <StatusBadge value="published" />
        <StatusBadge value="pending" />
        <StatusBadge value="submitted" />
        <StatusBadge value="archived" />
        <StatusBadge value="mystery" />
      </>,
    );

    const published = screen.getByText("Published");
    expect(published.className).toContain("rounded-full");
    expect(published.className).toContain("font-semibold");
    expect(published.className).toContain("bg-positive-soft");
    expect(published.className).toContain("shadow-none");

    expect(screen.getByText("Pending").className).toContain("border-active");
    expect(screen.getByText("Submitted").className).toContain("bg-progress-soft");
    expect(screen.getByText("Archived").className).toContain("bg-muted");
    expect(screen.getByText("mystery").className).toContain("bg-muted");
  });

  it("dismisses a success banner and replaces it when the message is an error", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <SaveNotice saved message="Course saved." tone="student" onDismiss={onDismiss} />,
    );

    const banner = screen.getByRole("status");
    expect(banner.className).toContain("rounded-xl");
    expect(banner.className).toContain("bg-student-soft");
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    expect(dismiss.className).toContain("focus-visible:ring-2");
    dismiss.focus();
    expect(dismiss).toHaveFocus();
    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledOnce();

    rerender(<SaveNotice saved={false} message="Could not save." onDismiss={onDismiss} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("presses a choice without dropping the grading tab state", () => {
    render(
      <ChoiceButton pressed role="tab" data-state="active" onClick={() => {}}>
        To Grade
      </ChoiceButton>,
    );

    const choice = screen.getByRole("tab", { name: "To Grade" });
    expect(choice).toHaveAttribute("aria-pressed", "true");
    expect(choice).toHaveAttribute("data-state", "active");
    expect(choice.className).toContain("bg-primary");
  });

  it("selects a summary count with the sage hover and a focus ring", () => {
    const onChange = vi.fn();
    render(
      <SummaryCounts
        value="published"
        onChange={onChange}
        items={[
          { value: "published", label: "Published", action: "Show", count: 2 },
          { value: "draft", label: "Draft", action: "Show", count: 1 },
        ]}
      />,
    );

    const selected = screen.getByRole("button", { name: /Published/ });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected.className).toContain("border-primary");
    expect(selected.className).toContain("hover:bg-sage");
    expect(selected.className).toContain("hover:text-foreground");
    expect(selected.className).toContain("focus-visible:ring-2");
    expect(selected.className).not.toContain("bg-student-soft");

    fireEvent.click(screen.getByRole("button", { name: /Draft/ }));
    expect(onChange).toHaveBeenCalledWith("draft");
  });

  it("stacks a table row under a named label and hovers with sage", () => {
    render(
      <DataTable columns={["Name", "Role"]}>
        <DataRow>
          <DataCell heading label="Name">
            Ada Lovelace
          </DataCell>
          <DataCell label="Role">Instructor</DataCell>
        </DataRow>
      </DataTable>,
    );

    const table = screen.getByRole("table");
    expect(table.parentElement?.className).toContain("rounded-xl");
    expect(table.parentElement?.className).toContain("shadow-raised");
    expect(table.className).toContain("md:min-w-[40rem]");

    const row = screen.getByRole("row", { name: /Ada Lovelace/ });
    expect(row.className).toContain("hover:bg-sage");
    expect(row.className).toContain("hover:text-foreground");
    expect(screen.getByText("Name", { selector: "span" }).className).toContain("md:hidden");
  });

  it("stretches a record card and keeps the title at 16px medium", () => {
    render(<RecordCard title="Algebra" badge={<StatusBadge value="published" />} />);

    const card = screen.getByRole("article");
    expect(card.className).toContain("h-full");
    expect(card.className).toContain("flex-col");
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("shadow-raised");
    expect(screen.getByRole("heading", { name: "Algebra" }).className).toContain("font-medium");
  });

  it("gives feedback states their surfaces without inventing copy", () => {
    render(
      <>
        <LoadingState message="Loading courses…" />
        <EmptyState message="You have no courses yet." />
        <ErrorState message="Could not load courses." />
      </>,
    );

    expect(screen.getByText("Loading courses…").parentElement?.className).toContain(
      "shadow-raised",
    );
    expect(
      screen.getByText("You have no courses yet.").closest(".rounded-xl")?.className,
    ).toContain("shadow-raised");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Could not load courses.");
    expect(alert.className).toContain("border-destructive/30");
    expect(alert.className).not.toContain("shadow-raised");
  });

  it("keeps the dialog close control visible inside a scrolling panel", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit profile" });
    expect(dialog.className).toContain("max-h-[calc(100vh-2rem)]");
    expect(dialog.className).toContain("overflow-y-auto");
    expect(dialog.className).toContain("max-w-lg");
    expect(dialog.className).toContain("rounded-xl");
    expect(dialog.className).toContain("shadow-raised");

    const close = screen.getByRole("button", { name: "Close" });
    expect(close.className).toContain("opacity-100");
    expect(close.className).toContain("focus-visible:ring-2");
    close.focus();
    expect(close).toHaveFocus();
  });

  it("filters with the existing search field and an outline mark-read action", () => {
    render(
      <>
        <FilterToolbar
          id="course-search"
          value=""
          placeholder="Search courses"
          onChange={() => {}}
        />
        <NotificationList
          notifications={[
            {
              id: "note-1",
              title: "Assignment due soon",
              body: "Essay is due soon in Algebra.",
              createdAt: "2026-10-18T12:00:00.000Z",
              readAt: null,
            },
          ]}
          error=""
          pendingId=""
          onMarkRead={() => {}}
        />
      </>,
    );

    expect(screen.getByLabelText("Search")).toHaveAttribute("id", "course-search");
    const markRead = screen.getByRole("button", { name: "Mark read" });
    expect(markRead.className).toContain("border-input");
    expect(markRead.className).not.toContain("bg-primary");
    expect(
      screen.getByText("Essay is due soon in Algebra.").nextElementSibling?.className,
    ).toContain("text-xs");
  });
});
