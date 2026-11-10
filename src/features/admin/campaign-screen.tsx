import { useEffect, useState } from "react";

import { DataCell, DataRow, DataTable } from "@/components/app-shell/data-table";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { PageSection } from "@/components/app-shell/record-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SaveNotice } from "@/features/instructor/save-notice";

import {
  confirmCampaign,
  listCampaigns,
  previewCampaign,
  type CampaignPreview,
  type CampaignSegment,
  type CampaignSummary,
} from "./campaign-api";

const segments: Array<{ value: CampaignSegment; label: string }> = [
  { value: "new", label: "New" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const columns = ["Subject", "Segment", "Sent", "Opened", "Bounced", "Re-enrolled"];

export function CampaignScreen() {
  const [segment, setSegment] = useState<CampaignSegment>("inactive");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [previewDraft, setPreviewDraft] = useState("");
  const [pending, setPending] = useState<"preview" | "confirm" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const draft = campaignDraft(segment, subject, body);
  const previewMatches = preview !== null && previewDraft === draft && previewKey !== "";

  useEffect(() => {
    let active = true;
    listCampaigns().then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCampaigns(result.campaigns);
    });
    return () => {
      active = false;
    };
  }, []);

  async function refreshCampaigns() {
    const result = await listCampaigns();
    if (result.ok) setCampaigns(result.campaigns);
  }

  async function handlePreview() {
    if (pending) return;
    setPending("preview");
    setNotice("");
    const result = await previewCampaign(segment);
    setPending(null);
    if (!result.ok) {
      setPreview(null);
      setPreviewKey("");
      setError(result.message);
      return;
    }
    setError("");
    setPreview(result.preview);
    setPreviewDraft(draft);
    setPreviewKey(crypto.randomUUID());
  }

  async function handleConfirm() {
    if (pending || !previewMatches || !preview || preview.count === 0) return;
    setPending("confirm");
    setNotice("");
    const result = await confirmCampaign({
      segment,
      subject: subject.trim(),
      body: body.trim(),
      idempotencyKey: previewKey,
    });
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setPreview(null);
    setPreviewKey("");
    setNotice(sendNotice(result.send.sent, result.send.failed, result.send.pending));
    await refreshCampaigns();
  }

  return (
    <PageSection>
      <PageHeader
        title="Campaigns"
        description="New students registered within 7 days. Active students learned within 30 days. Everyone else is Inactive. Preview the audience, then send."
      />
      <SaveNotice tone="admin" saved message={notice} onDismiss={() => setNotice("")} />
      {error ? <ErrorState message={error} /> : null}
      <form
        className="max-w-2xl space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handlePreview();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="campaign-segment">Segment</Label>
          <select
            id="campaign-segment"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={segment}
            onChange={(event) => setSegment(event.target.value as CampaignSegment)}
          >
            {segments.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-subject">Subject</Label>
          <Input
            id="campaign-subject"
            value={subject}
            maxLength={180}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-body">Message</Label>
          <Textarea
            id="campaign-body"
            value={body}
            maxLength={4000}
            rows={6}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending !== null || !subject.trim() || !body.trim()}>
            {pending === "preview" ? "Previewing…" : "Preview audience"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null || !previewMatches || !preview || preview.count === 0}
            onClick={() => void handleConfirm()}
          >
            {pending === "confirm" ? "Sending…" : "Send campaign"}
          </Button>
        </div>
      </form>
      {previewMatches && preview ? (
        <section className="max-w-2xl space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {preview.count} {segmentLabel(preview.segment)}{" "}
            {preview.count === 1 ? "student" : "students"}
          </h2>
          {preview.count === 0 ? (
            <p className="text-sm text-muted-foreground">No students to email.</p>
          ) : (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {preview.sample.map((student) => (
                <li key={student.email}>
                  {student.fullName ? `${student.fullName} · ${student.email}` : student.email}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {loading ? <LoadingState message="Loading campaigns…" /> : null}
      {!loading && campaigns.length === 0 ? (
        <EmptyState message="No campaigns have been sent." />
      ) : null}
      {!loading && campaigns.length > 0 ? (
        <DataTable columns={columns}>
          {campaigns.map((campaign) => (
            <DataRow key={campaign.id}>
              <DataCell>{campaign.subject}</DataCell>
              <DataCell>{segmentLabel(campaign.segment)}</DataCell>
              <DataCell>{campaign.sent}</DataCell>
              <DataCell>{campaign.opened}</DataCell>
              <DataCell>{campaign.bounced}</DataCell>
              <DataCell>{campaign.reenrolled}</DataCell>
            </DataRow>
          ))}
        </DataTable>
      ) : null}
    </PageSection>
  );
}

function campaignDraft(segment: string, subject: string, body: string) {
  return `${segment}\n${subject.trim()}\n${body.trim()}`;
}

function segmentLabel(segment: string) {
  if (segment === "new") return "New";
  if (segment === "active") return "Active";
  if (segment === "inactive") return "Inactive";
  return segment;
}

function sendNotice(sent: number, failed: number, pending: number) {
  return `Sent ${sent}. Failed ${failed}. Still pending ${pending}.`;
}
