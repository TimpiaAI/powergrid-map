import { NextRequest, NextResponse } from "next/server";
import { statSync, openSync, readSync, closeSync } from "fs";
import { join } from "path";

const PMTILES_PATH = join(process.cwd(), "public", "data", "powergrid.pmtiles");

export async function GET(request: NextRequest) {
  const range = request.headers.get("range");

  let fileSize: number;
  try {
    fileSize = statSync(PMTILES_PATH).size;
  } catch {
    return new NextResponse("PMTiles file not found", { status: 404 });
  }

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024, fileSize - 1);
    const chunkSize = end - start + 1;

    const fd = openSync(PMTILES_PATH, "r");
    const buffer = Buffer.alloc(chunkSize);
    readSync(fd, buffer, 0, chunkSize, start);
    closeSync(fd);

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
      "Content-Type": "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function HEAD(request: NextRequest) {
  return GET(request);
}
