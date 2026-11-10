import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CampaignScreen } from "./campaign-screen";
import { confirmCampaign, listCampaigns, previewCampaign } from "./campaign-api";

vi.mock("./campaign-api", () => ({
  listCampaigns: vi.fn(),
  previewCampaign: vi.fn(),
  confirmCampaign: vi.fn(),
}));

const list = vi.mocked(listCampaigns);
const preview = vi.mocked(previewCampaign);
const confirm = vi.mocked(confirmCampaign);

describe("campaign screen", () => {
  beforeEach(() => {
    list.mockReset();
    preview.mockReset();
    confirm.mockReset();
    list.mockResolvedValue({
      ok: true,
      campaigns: [
        {
          id: "campaign-1",
          segment: "inactive",
          subject: "Come back to class",
          status: "sent",
          createdAt: "2026-11-01T00:00:00.000Z",
          sent: 2,
          opened: 1,
          bounced: 1,
          reenrolled: 1,
        },
      ],
    });
  });

  it("previews the audience and sends only after that preview", async () => {
    preview.mockResolvedValue({
      ok: true,
      preview: {
        segment: "inactive",
        count: 1,
        sample: [{ fullName: "Ada Lovelace", email: "ada@example.com" }],
      },
    });
    confirm.mockResolvedValue({
      ok: true,
      send: { campaignId: "campaign-2", sent: 1, failed: 0, pending: 0 },
    });

    render(<CampaignScreen />);
    expect(await screen.findByText("Come back to class")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    const send = screen.getByRole("button", { name: "Send campaign" });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Come back" } });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Your course is open." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview audience" }));

    expect(await screen.findByText("Ada Lovelace · ada@example.com")).toBeInTheDocument();
    expect(preview).toHaveBeenCalledWith("inactive");
    expect(send).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "A different subject" },
    });
    expect(send).toBeDisabled();
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Come back" } });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith({
      segment: "inactive",
      subject: "Come back",
      body: "Your course is open.",
      idempotencyKey: expect.stringMatching(/^[A-Za-z0-9-]{16,80}$/),
    });
    expect(await screen.findByText("Sent 1. Failed 0. Still pending 0.")).toBeInTheDocument();
  });
});
