import { NextRequest, NextResponse } from "next/server";
import { PMTiles } from "pmtiles";

/**
 * Serve individual vector tiles from the PMTiles archive.
 * Used by deck.gl MVTLayer: /api/tiles/{z}/{x}/{y}
 */

let pmtiles: PMTiles | null = null;

function getPMTiles(): PMTiles {
  if (!pmtiles) {
    // PMTiles in the browser uses fetch — on server we need a custom source.
    // But PMTiles class can accept a URL string and will use fetch() internally.
    // We point it at our own range-request endpoint which proxies the file.
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
    pmtiles = new PMTiles(`${baseUrl}/api/tiles`);
  }
  return pmtiles;
}

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/tiles/[z]/[x]/[y]">
) {
  const { z, x, y } = await ctx.params;
  const zi = parseInt(z, 10);
  const xi = parseInt(x, 10);
  const yi = parseInt(y, 10);

  if (isNaN(zi) || isNaN(xi) || isNaN(yi)) {
    return new NextResponse("Invalid tile coordinates", { status: 400 });
  }

  try {
    const pm = getPMTiles();
    const tile = await pm.getZxy(zi, xi, yi);

    if (!tile || !tile.data || tile.data.byteLength === 0) {
      // No data for this tile — return 204
      return new NextResponse(null, { status: 204 });
    }

    const bytes = new Uint8Array(tile.data);

    // Check if the data is gzip-compressed (starts with 0x1f 0x8b)
    const isGzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

    const headers: Record<string, string> = {
      "Content-Type": "application/x-protobuf",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, immutable",
    };

    if (isGzipped) {
      headers["Content-Encoding"] = "gzip";
    }

    return new NextResponse(tile.data, { status: 200, headers });
  } catch (err) {
    console.error(`Tile error z=${zi} x=${xi} y=${yi}:`, err);
    return new NextResponse("Tile fetch error", { status: 500 });
  }
}
