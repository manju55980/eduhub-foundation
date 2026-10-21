export const searchLearningVideosTool = "search_learning_videos";
export const missingVideoMessage = "Video suggestions are not configured.";
export const unavailableVideoMessage = "Video suggestions are unavailable right now.";
export const emptyVideoMessage = "No matching videos were found.";

export type LearningVideo = {
  title: string;
  channel: string;
  description: string;
  url: string;
};

const youtubeSearchUrl = "https://www.googleapis.com/youtube/v3/search";
const descriptionLimit = 280;
const queryLimit = 180;

export function learningVideoQuery(title: string, resources: string) {
  return [title, resources]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, queryLimit);
}

export async function searchLearningVideos(
  input: { apiKey: string | undefined; query: string; limit: number },
  fetchImpl: typeof fetch,
): Promise<
  { ok: true; videos: LearningVideo[]; message: string } | { ok: false; message: string }
> {
  const apiKey = input.apiKey?.trim() ?? "";
  const query = input.query.trim();
  if (!apiKey) return { ok: false, message: missingVideoMessage };
  if (!query) return { ok: true, videos: [], message: emptyVideoMessage };

  const limit = Math.min(5, Math.max(1, Math.trunc(input.limit)));
  const url = new URL(youtubeSearchUrl);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("safeSearch", "strict");
  url.searchParams.set("maxResults", String(limit));
  url.searchParams.set("q", query);
  url.searchParams.set("key", apiKey);

  let response: Response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    return { ok: false, message: unavailableVideoMessage };
  }

  if (!response.ok) {
    console.error(JSON.stringify({ source: "youtube", status: response.status }));
    return { ok: false, message: unavailableVideoMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: unavailableVideoMessage };
  }

  const videos = parseYoutubeSearch(payload);
  if (videos.length === 0) return { ok: true, videos: [], message: emptyVideoMessage };
  return { ok: true, videos, message: "" };
}

export function parseYoutubeSearch(payload: unknown): LearningVideo[] {
  if (!payload || typeof payload !== "object" || !("items" in payload)) return [];
  const items = payload.items;
  if (!Array.isArray(items)) return [];
  const videos: LearningVideo[] = [];
  for (const item of items) {
    const video = parseYoutubeItem(item);
    if (video) videos.push(video);
  }
  return videos;
}

function parseYoutubeItem(item: unknown): LearningVideo | null {
  if (!item || typeof item !== "object") return null;
  const id = "id" in item && item.id && typeof item.id === "object" ? item.id : null;
  const videoId = id && "videoId" in id && typeof id.videoId === "string" ? id.videoId.trim() : "";
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return null;
  const snippet =
    "snippet" in item && item.snippet && typeof item.snippet === "object" ? item.snippet : null;
  const title = snippetText(snippet, "title");
  if (!title) return null;
  return {
    title,
    channel: snippetText(snippet, "channelTitle") || "Unknown channel",
    description: snippetText(snippet, "description").slice(0, descriptionLimit),
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

function snippetText(snippet: object | null, key: string) {
  if (!snippet || !(key in snippet)) return "";
  const value = (snippet as Record<string, unknown>)[key];
  return typeof value === "string" ? decodeHtml(value).replace(/\s+/g, " ").trim() : "";
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
