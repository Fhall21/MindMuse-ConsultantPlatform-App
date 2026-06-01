import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ocrJobs, transcriptionJobs } from "@/db/schema";

export async function resolveTranscriptFromArtifact(artifactId: string): Promise<string | null> {
  const [job] = await db
    .select({ transcriptText: transcriptionJobs.transcriptText, status: transcriptionJobs.status })
    .from(transcriptionJobs)
    .where(eq(transcriptionJobs.id, artifactId))
    .limit(1);

  if (job?.status === "completed" && job.transcriptText?.trim()) {
    return job.transcriptText.trim();
  }

  return null;
}

export async function resolveNotesFromArtifact(artifactId: string): Promise<string | null> {
  const [job] = await db
    .select({ extractedText: ocrJobs.extractedText, status: ocrJobs.status })
    .from(ocrJobs)
    .where(eq(ocrJobs.id, artifactId))
    .limit(1);

  if (job?.status === "completed" && job.extractedText?.trim()) {
    return job.extractedText.trim();
  }

  return null;
}
