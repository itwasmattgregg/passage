function audioBlob(bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy], { type: "audio/mpeg" });
}

export function serveAudioFile(
  request: Request,
  bytes: Uint8Array,
  filename: string,
  disposition: "inline" | "attachment",
) {
  const size = bytes.byteLength;
  const range = request.headers.get("range");
  const common = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `${disposition}; filename="${filename}"`,
  };

  if (!range) {
    return new Response(audioBlob(bytes), {
      status: 200,
      headers: {
        ...common,
        "Content-Length": String(size),
      },
    });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) {
    return new Response("Invalid range", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (start >= size || end >= size || start > end) {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  return new Response(audioBlob(bytes.slice(start, end + 1)), {
    status: 206,
    headers: {
      ...common,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  });
}
