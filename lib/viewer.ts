import { getGlobalArchive } from "@/lib/archive";
import { getFile } from "@/lib/github";
import { Submission } from "@/lib/types";

export async function getSubmissionById(id: string): Promise<Submission | null> {
  const index = await getGlobalArchive();
  const entry = index.find((item) => item.id === id);

  if (!entry) return null;

  // RECONSTRUCT PATH (Must match route.ts EXACTLY)
  
  // 1. Directory: Use string split to avoid Timezone offsets
  const [year, month] = entry.date.split("-");
  
  // 2. Filename: Strict Alphanumeric Only
  const safeTitle = entry.title.replace(/[^a-zA-Z0-9]/g, ""); 
  const safeUsername = (entry.username || "user").replace(/[^a-zA-Z0-9]/g, "");
  
  const fileName = `${entry.date}_${safeTitle}_${safeUsername}_${id}.json`;
  const path = `data/submissions/${year}/${month}/${fileName}`;

  console.log(`Fetching Submission: ${path}`); // Debug Log

  // 3. Fetch Metadata
  const file = await getFile(path);
  
  if (!file.exists || !file.content) {
    console.error(`ERROR: File missing at ${path}`);
    return null;
  }

  const submission = file.content as Submission;

  // 4. Hydrate Main Code
  if (submission.mainSolution?.path) {
    const codeFile = await getFile(submission.mainSolution.path);
    if (codeFile.content) {
      submission.mainSolution.code = codeFile.content as string; 
    } else {
      submission.mainSolution.code = "// Error: Main solution file content not found.";
    }
  }

  // 5. Hydrate Alternate Code
  if (submission.alternateSolution?.path) {
    const altFile = await getFile(submission.alternateSolution.path);
    if (altFile.content) {
      submission.alternateSolution.code = altFile.content as string;
    } else {
      submission.alternateSolution.code = "// Error: Alternate solution file content not found.";
    }
  }

  return submission;
}