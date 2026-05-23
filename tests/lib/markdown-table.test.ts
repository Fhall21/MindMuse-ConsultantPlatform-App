import { describe, expect, it } from "vitest";
import {
  extractTableRows,
  isTableLine,
  isTableSeparatorLine,
  normalizeTableBlock,
  parseTableRow,
} from "@/lib/markdown-table";

describe("parseTableRow", () => {
  it("parses a standard pipe-delimited row", () => {
    expect(parseTableRow("| A | B | C |")).toEqual(["A", "B", "C"]);
  });

  it("tolerates a missing trailing pipe", () => {
    expect(parseTableRow("| A | B | C")).toEqual(["A", "B", "C"]);
  });

  it("returns an empty array for non-table lines", () => {
    expect(parseTableRow("not a table")).toEqual([]);
  });
});

describe("isTableLine", () => {
  it("detects lines that start with a pipe", () => {
    expect(isTableLine("| col | val |")).toBe(true);
    expect(isTableLine("  | indented |")).toBe(true);
    expect(isTableLine("plain text")).toBe(false);
  });
});

describe("isTableSeparatorLine", () => {
  it("detects markdown separator rows", () => {
    expect(isTableSeparatorLine("|---|---|")).toBe(true);
    expect(isTableSeparatorLine("| --- | :---: | ---: |")).toBe(true);
    expect(isTableSeparatorLine("| Header | Value |")).toBe(false);
  });
});

describe("extractTableRows", () => {
  it("skips separator rows and keeps data rows", () => {
    const lines = [
      "| Header | Value |",
      "|---|---|",
      "| A | 1 |",
      "| B | 2 |",
    ];
    expect(extractTableRows(lines)).toEqual([
      "| Header | Value |",
      "| A | 1 |",
      "| B | 2 |",
    ]);
  });
});

describe("normalizeTableBlock", () => {
  it("drops blank lines inside a table block", () => {
    const lines = [
      "| Header | Value |",
      "",
      "|---|---|",
      "",
      "| A | 1 |",
    ];
    expect(normalizeTableBlock(lines)).toEqual({
      rows: ["| Header | Value |", "| A | 1 |"],
      isValid: true,
    });
  });

  it("marks header-only blocks as invalid", () => {
    expect(
      normalizeTableBlock(["| Header | Value |", "|---|---|"])
    ).toEqual({
      rows: ["| Header | Value |"],
      isValid: false,
    });
  });
});
