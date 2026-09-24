import { normalizeServerUrl } from "@/lib/format";

export function itemListenUrl(serverUrl: string, libraryItemId: string, timeSeconds: number) {
  return `${normalizeServerUrl(serverUrl)}/item/${libraryItemId}?t=${Math.floor(timeSeconds)}`;
}

export function absShareListenUrl(serverUrl: string, shareSlug: string, timeSeconds: number) {
  return `${normalizeServerUrl(serverUrl)}/share/${shareSlug}?t=${Math.floor(timeSeconds)}`;
}

export function libbySearchUrl(input: {
  title: string;
  author?: string | null;
  isbn?: string | null;
}) {
  const query = input.isbn?.trim() || [input.title, input.author].filter(Boolean).join(" ");
  return `https://www.overdrive.com/search?q=${encodeURIComponent(query)}`;
}

export function passageSharePath(slug: string) {
  return `/p/${slug}`;
}
