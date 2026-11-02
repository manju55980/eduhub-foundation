import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LessonProgressSummary } from "./lesson-progress";

describe("LessonProgressSummary", () => {
  it("labels zero, partial, and complete progress without animating the fill", () => {
    const { rerender } = render(<LessonProgressSummary completed={0} total={2} progress={0} />);

    const empty = screen.getByRole("progressbar", { name: "0 of 2 lessons complete" });
    expect(empty).toHaveAttribute("aria-valuemin", "0");
    expect(empty).toHaveAttribute("aria-valuemax", "100");
    expect(empty).toHaveAttribute("aria-valuenow", "0");
    expect(empty).toHaveAttribute("aria-valuetext", "0 of 2 lessons complete, 0%");
    expect(empty).toHaveClass("bg-muted", "h-2", "rounded-md");
    expect(empty.firstElementChild).toHaveStyle({ width: "0%" });
    expect(empty.firstElementChild).toHaveClass("bg-positive");
    expect(empty.firstElementChild?.className).not.toContain("transition");
    expect(screen.getByText("0%").parentElement).toHaveClass("text-sm", "text-foreground");

    rerender(<LessonProgressSummary completed={1} total={3} progress={33} />);
    expect(screen.getByRole("progressbar", { name: "1 of 3 lessons complete" })).toHaveAttribute(
      "aria-valuenow",
      "33",
    );
    expect(screen.getByText("33%")).toHaveClass("font-semibold", "tabular-nums");

    rerender(<LessonProgressSummary completed={3} total={3} progress={100} />);
    const done = screen.getByRole("progressbar", { name: "3 of 3 lessons complete" });
    expect(done).toHaveAttribute("aria-valuenow", "100");
    expect(done.firstElementChild).toHaveStyle({ width: "100%" });
  });

  it("shows a zero-lesson course at the stored percentage", () => {
    render(<LessonProgressSummary completed={0} total={0} progress={0} />);

    const meter = screen.getByRole("progressbar", { name: "0 of 0 lessons complete" });
    expect(meter).toHaveAttribute("aria-valuenow", "0");
    expect(meter).toHaveAttribute("aria-valuetext", "0 of 0 lessons complete, 0%");
    expect(screen.getByText("0 of 0 lessons complete").parentElement).toHaveClass(
      "text-sm",
      "text-foreground",
    );
  });
});
