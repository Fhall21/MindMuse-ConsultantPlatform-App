import { describe, expect, it } from "vitest";
import {
  fitDataUrlImage,
  fitImageDimensions,
  getDataUrlImageDimensions,
} from "@/lib/report-canvas-assets";

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function pngDataUrl(width: number, height: number): string {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

describe("report canvas image dimensions", () => {
  it("reads SVG dimensions from viewBox", () => {
    const dataUrl = svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 10 1200 675"></svg>'
    );

    expect(getDataUrlImageDimensions(dataUrl)).toEqual({
      width: 1200,
      height: 675,
    });
  });

  it("falls back to SVG width and height attributes", () => {
    const dataUrl = svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" width="960px" height="540px"></svg>'
    );

    expect(getDataUrlImageDimensions(dataUrl)).toEqual({
      width: 960,
      height: 540,
    });
  });

  it("reads PNG dimensions from IHDR", () => {
    expect(getDataUrlImageDimensions(pngDataUrl(1200, 837))).toEqual({
      width: 1200,
      height: 837,
    });
  });

  it("fits wide, square, and tall images without changing aspect ratio", () => {
    expect(fitImageDimensions({ width: 1600, height: 800 }, { maxWidth: 400 })).toEqual({
      width: 400,
      height: 200,
    });
    expect(
      fitImageDimensions({ width: 1000, height: 1000 }, { maxWidth: 400 })
    ).toEqual({ width: 400, height: 400 });
    expect(
      fitImageDimensions({ width: 600, height: 1200 }, { maxWidth: 400, maxHeight: 300 })
    ).toEqual({ width: 150, height: 300 });
  });

  it("uses fallback ratio for invalid data URLs", () => {
    expect(
      fitDataUrlImage("not-a-data-url", { maxWidth: 560, maxHeight: 400 }, 1.6)
    ).toEqual({ width: 560, height: 350 });
  });
});
