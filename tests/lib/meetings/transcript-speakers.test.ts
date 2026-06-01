import { describe, expect, it } from "vitest";
import { extractSpeakerNamesFromTranscript } from "@/lib/meetings/transcript-speakers";

describe("extractSpeakerNamesFromTranscript", () => {
  it("extracts unique speaker labels from colon-prefixed lines", () => {
    const text = [
      "Louise: Thanks for making the time, Chris.",
      "Chris: Yeah, pretty full on already.",
      "Louise: Maybe start broadly — what has work felt like?",
    ].join("\n");

    expect(extractSpeakerNamesFromTranscript(text)).toEqual(["Louise", "Chris"]);
  });

  it("returns an empty list when no speaker labels are present", () => {
    expect(extractSpeakerNamesFromTranscript("Plain notes without speakers.")).toEqual([]);
  });
});
