const webProtocols = new Set(["http:", "https:"]);

export function externalVideoUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!webProtocols.has(url.protocol)) return null;
  } catch {
    return null;
  }

  return trimmed;
}
