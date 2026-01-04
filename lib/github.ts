import { Octokit } from "octokit";

// 1. Initialize the Client
// We use the Token from your .env.local file
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_OWNER!;
const REPO = process.env.GITHUB_REPO!;

// --- TYPES ---
export type FileResponse = {
  content: any; // The parsed JSON or raw string
  sha: string;  // The Fingerprint (Crucial for safety)
  exists: boolean;
};

// --- CORE FUNCTIONS ---

/**
 * READ a file from the Repo
 * Returns: { content, sha, exists }
 */
export async function getFile(path: string): Promise<FileResponse> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: path,
    });

    // Safety Check: Ensure it's a file, not a folder
    if (Array.isArray(data) || !('content' in data)) {
      throw new Error(`Path points to a folder, not a file: ${path}`);
    }

    // GitHub returns content encoded in Base64 (e.g., "SGVsbG8=").
    // We must decode it to read it.
    const contentEncoded = data.content;
    const contentDecoded = Buffer.from(contentEncoded, 'base64').toString('utf-8');
    
    // Try parsing JSON (if it's a data file), otherwise return string (if it's code)
    let parsedContent = contentDecoded;
    try {
      parsedContent = JSON.parse(contentDecoded);
    } catch {
      // It's just a regular file (like .cpp), keep as string
    }

    return {
      content: parsedContent,
      sha: data.sha, // Capture the SHA so we can update safely later
      exists: true,
    };

  } catch (error: any) {
    // If file doesn't exist, return a clean "Empty" response instead of crashing
    if (error.status === 404) {
      return { content: null, sha: "", exists: false };
    }
    throw error; // If it's a real error (like Bad Token), crash loudly
  }
}

/**
 * WRITE (Create or Update) a file
 * @param path - The file path (e.g., "data/users/aksh.json")
 * @param content - The data to save
 * @param sha - (Optional) The SHA of the previous version. REQUIRED if updating.
 */
export async function saveFile(path: string, content: any, sha?: string, message?: string) {
  
  // 1. Prepare Content: Convert JSON back to string if needed
  const contentString = typeof content === 'string' 
    ? content 
    : JSON.stringify(content, null, 2);

  // 2. Encode: GitHub requires Base64
  const contentEncoded = Buffer.from(contentString).toString('base64');

  // 3. Push to GitHub
  await octokit.rest.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path: path,
    message: message || `Update ${path}`,
    content: contentEncoded,
    sha: sha, // The Optimistic Lock: GitHub rejects if this SHA doesn't match the server
  });
}