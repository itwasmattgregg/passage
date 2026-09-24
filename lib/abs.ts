import { normalizeServerUrl } from "@/lib/format";

export type AbsBookmark = {
  libraryItemId: string;
  title?: string;
  time: number;
};

export type AbsChapter = {
  id?: string;
  start: number;
  end: number;
  title?: string;
};

export type AbsAudioFile = {
  ino: string;
  duration: number;
  index?: number;
  metadata?: { filename?: string };
};

export type AbsTrack = {
  ino?: string;
  index?: number;
  startOffset?: number;
  duration: number;
  contentUrl?: string;
};

export type AbsItem = {
  id: string;
  media?: {
    id?: string;
    chapters?: AbsChapter[];
    audioFiles?: AbsAudioFile[];
    tracks?: AbsTrack[];
    metadata?: {
      title?: string;
      authors?: Array<string | { name?: string }>;
      narrators?: string[];
      isbn?: string | null;
      asin?: string | null;
    };
  };
};

export type AbsMe = {
  id?: string;
  username?: string;
  bookmarks?: AbsBookmark[];
};

export class AbsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AbsError";
  }
}

export function createAbsClient(serverUrl: string, apiToken: string) {
  const base = normalizeServerUrl(serverUrl);

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new AbsError(
        `Audiobookshelf ${response.status} on ${path}${detail ? `: ${detail.slice(0, 180)}` : ""}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return {
    base,
    token: apiToken,
    getMe() {
      return request<AbsMe>("/api/me");
    },
    getItem(id: string) {
      return request<AbsItem>(`/api/items/${id}?expanded=1`);
    },
    createMediaShare(input: {
      mediaItemId: string;
      slug: string;
      expiresAt?: number;
    }) {
      return request<{ slug: string; expiresAt?: number | null }>("/api/share/mediaitem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: input.slug,
          mediaItemType: "book",
          mediaItemId: input.mediaItemId,
          expiresAt: input.expiresAt ?? 0,
          isDownloadable: false,
        }),
      });
    },
    fileUrl(libraryItemId: string, ino: string) {
      return `${base}/api/items/${libraryItemId}/file/${ino}`;
    },
  };
}

export function authorNames(item: AbsItem): string | null {
  const authors = item.media?.metadata?.authors ?? [];
  const names = authors
    .map((author) => (typeof author === "string" ? author : author.name))
    .filter((name): name is string => Boolean(name));
  return names.length ? names.join(", ") : null;
}

export function chapterAt(item: AbsItem, timeSeconds: number): string | null {
  const chapters = item.media?.chapters ?? [];
  const match = chapters.find(
    (chapter) => timeSeconds >= chapter.start && timeSeconds < chapter.end,
  );
  return match?.title ?? null;
}

export function resolveTrackAt(item: AbsItem, timeSeconds: number) {
  const files = item.media?.audioFiles ?? [];
  const tracks = item.media?.tracks ?? [];
  const resolved =
    tracks.length > 0
      ? tracks.map((track, index) => ({
          ino: track.ino ?? files[index]?.ino,
          startOffset: track.startOffset ?? 0,
          duration: track.duration,
        }))
      : files.reduce<Array<{ ino: string; startOffset: number; duration: number }>>(
          (rows, file) => {
            const startOffset = rows.reduce((sum, row) => sum + row.duration, 0);
            rows.push({ ino: file.ino, startOffset, duration: file.duration });
            return rows;
          },
          [],
        );

  const track = resolved.find((row) => {
    if (!row.ino) return false;
    return timeSeconds >= row.startOffset && timeSeconds < row.startOffset + row.duration;
  });

  if (!track?.ino) {
    throw new AbsError("Could not find an audio file for that timestamp.");
  }

  const localStart = Math.max(0, timeSeconds - track.startOffset);
  const remaining = Math.max(0.5, track.duration - localStart);

  return { ino: track.ino, localStart, remaining };
}
