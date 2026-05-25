import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDocxBuffer } from "@/lib/report-export-docx";
import type { ExportSection } from "@/lib/report-export-content";

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

describe("buildDocxBuffer", () => {
  it("embeds canvas frames as SVG with PNG fallback and preserves aspect ratio", async () => {
    const frameImage = svgDataUrl(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600">',
        '<rect width="1200" height="600" fill="#eef2ff"/>',
        '<text x="40" y="80" font-size="42">Readable vector canvas text</text>',
        "</svg>",
      ].join("")
    );
    const sections: ExportSection[] = [
      {
        heading: "Evidence Network",
        blocks: [],
        isPageBreak: false,
        data: {
          kind: "connections",
          connections: [],
          fullImageUrl: null,
          frameImages: { frame1: frameImage },
        },
      },
    ];

    const buffer = await buildDocxBuffer({
      artifactType: "report",
      generatedAt: "2026-05-25T10:00:00Z",
      roundLabel: "Test Round",
      sections,
      title: "Test Report",
    });
    const zip = await JSZip.loadAsync(buffer);
    const mediaNames = Object.keys(zip.files).filter((name) =>
      name.startsWith("word/media/")
    );
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const extent = documentXml.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);

    expect(mediaNames.some((name) => name.endsWith(".svg"))).toBe(true);
    expect(mediaNames.some((name) => name.endsWith(".png"))).toBe(true);
    expect(extent).not.toBeNull();
    const [, cx, cy] = extent!;
    expect(Number(cx) / Number(cy)).toBeCloseTo(2, 2);
  });
});
