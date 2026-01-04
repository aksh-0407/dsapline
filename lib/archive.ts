import { getFile } from "./github";
import { IndexEntry } from "./types";

export async function getGlobalArchive(): Promise<IndexEntry[]> {
  const file = await getFile("data/index.json");
  
  if (!file.exists || !file.content) {
    return [];
  }

  // The index is just a big array of metadata
  const allSubmissions: IndexEntry[] = Array.isArray(file.content) ? file.content : [];

  return allSubmissions;
}