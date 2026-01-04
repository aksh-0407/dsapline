import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { saveFile } from "@/lib/github";
import { enrichProblemData } from "@/lib/services"; 
import { safeUpdateIndex, safeUpdateUserStats, safeUpdateGlobalTags, getGlobalTags } from "@/lib/db";
import path from "path";

// --- CONFIGURATION ---
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

type Platform = "leetcode" | "codeforces" | "hackerrank" | "geeksforgeeks" | "other";

function detectPlatform(url: string): Platform {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("leetcode")) return "leetcode";
  if (lowerUrl.includes("codeforces")) return "codeforces";
  if (lowerUrl.includes("hackerrank")) return "hackerrank";
  if (lowerUrl.includes("geeksforgeeks")) return "geeksforgeeks";
  return "other";
}

async function processCodeInput(file: File | null, text: string) {
  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 1MB limit.");
    const content = await file.text();
    const ext = path.extname(file.name).replace(".", "") || "txt";
    return { content, ext };
  }
  if (text && text.trim()) {
    return { content: text, ext: "txt" }; 
  }
  return null;
}

export async function POST(req: Request) {
  try {
    // 1. Security & Identity
    const { userId } = await auth();
    const user = await currentUser();
    
    if (!userId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse Form
    const formData = await req.formData();
    const url = formData.get("url") as string;
    const difficulty = parseFloat(formData.get("difficulty") as string);
    const manualTags = JSON.parse(formData.get("tags") as string) as string[];
    const notes = formData.get("notes") as string;

    // 3. Smart Enrichment
    const enrichedData = await enrichProblemData(url);
    
    // 4. Tag Normalization
    const incomingTags = [...manualTags, ...(enrichedData?.tags || [])];
    const globalTags = await getGlobalTags();
    const submissionTags: string[] = [];
    const fingerprintsMap = new Map<string, string>();
    
    globalTags.forEach(t => fingerprintsMap.set(t.toLowerCase().replace(/[^a-z0-9]/g, ""), t));
    
    incomingTags.forEach(rawTag => {
       const print = rawTag.toLowerCase().replace(/[^a-z0-9]/g, "");
       if (fingerprintsMap.has(print)) {
         const niceTag = fingerprintsMap.get(print)!;
         if (!submissionTags.includes(niceTag)) submissionTags.push(niceTag);
       } else {
         const formatted = rawTag.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
         if (!submissionTags.includes(formatted)) submissionTags.push(formatted);
         fingerprintsMap.set(print, formatted);
       }
    });

    // 5. Determine Final Title
    // Fallback for "Other" platforms: "Problem" + last segment of URL
    let displayTitle = enrichedData?.realTitle;
    if (!displayTitle) {
      const urlParts = url.split("/").filter(Boolean);
      const lastPart = urlParts.length > 0 ? urlParts[urlParts.length - 1] : "Unknown";
      displayTitle = "Problem " + lastPart;
    }

    // 6. Process Code
    const mainResult = await processCodeInput(
      formData.get("file") as File | null,
      formData.get("code") as string
    );

    if (!mainResult) {
      return NextResponse.json({ error: "No solution code provided" }, { status: 400 });
    }

    const altLabel = formData.get("altLabel") as string;
    const altResult = await processCodeInput(
      formData.get("altFile") as File | null,
      formData.get("altCode") as string
    );

    // 7. GENERATE PATHS (CRITICAL: STRICT LOGIC)
    const submissionId = crypto.randomUUID();
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().split('T')[0]; // "2026-01-04"
    
    // Strict Directory Logic: Use String Split, NOT Date Object (Avoids timezone bugs)
    const [year, month] = dateStr.split("-"); 
    
    // Usernames
    let safeUsername = "user";
    if (user.username) safeUsername = user.username;
    else if (user.firstName) safeUsername = user.firstName;
    const cleanUsername = safeUsername.replace(/[^a-zA-Z0-9]/g, "");

    // Strict Filename Logic: Alphanumeric ONLY
    // This MUST match getSubmissionById in viewer.ts exactly!
    const safeTitle = displayTitle.replace(/[^a-zA-Z0-9]/g, ""); 
    const fileNameBase = `${dateStr}_${safeTitle}_${cleanUsername}_${submissionId}`;
    
    const mainCodePath = `data/submissions/${year}/${month}/${fileNameBase}.${mainResult.ext}`;
    const metaPath = `data/submissions/${year}/${month}/${fileNameBase}.json`;

    // 8. Save Files
    const savePromises = [];

    savePromises.push(saveFile(mainCodePath, mainResult.content, undefined, `Code: ${displayTitle}`));

    let altData = null;
    if (altResult) {
      const altCodePath = `data/submissions/${year}/${month}/${fileNameBase}_alt.${altResult.ext}`;
      savePromises.push(saveFile(altCodePath, altResult.content, undefined, `Alt Code: ${displayTitle}`));
      altData = { label: altLabel || "Alternate Solution", path: altCodePath, extension: altResult.ext };
    }

    const platform = detectPlatform(url);

    const metadata = {
      id: submissionId,
      userId: userId,
      username: cleanUsername,
      question: { url, title: displayTitle },
      difficulty,
      tags: submissionTags,
      notes,
      timestamp: timestamp.toISOString(),
      mainSolution: { path: mainCodePath, extension: mainResult.ext },
      alternateSolution: altData,
      platform: platform,
      enrichment: enrichedData ? {
        realTitle: enrichedData.realTitle,
        difficultyLabel: enrichedData.difficultyLabel,
        rating: enrichedData.rating,
        contestId: enrichedData.contestId,
        problemIndex: enrichedData.problemIndex
      } : undefined
    };
    
    savePromises.push(saveFile(metaPath, metadata, undefined, `Meta: ${displayTitle}`));

    await Promise.all(savePromises);
    
    // 9. Update Stats & Index
    safeUpdateUserStats(userId, cleanUsername, dateStr); // Fire & Forget
    safeUpdateGlobalTags(submissionTags); // Fire & Forget

    const indexEntry = {
      id: submissionId,
      title: displayTitle,
      difficulty,
      tags: submissionTags,
      username: cleanUsername,
      userId: userId,
      date: dateStr,
      timestamp: timestamp.toISOString(),
      platform: platform,
      difficultyLabel: enrichedData?.difficultyLabel,
      rating: enrichedData?.rating,
      contestId: enrichedData?.contestId,
      problemIndex: enrichedData?.problemIndex,
    };
    
    await safeUpdateIndex(indexEntry);

    return NextResponse.json({ success: true, id: submissionId });

  } catch (error: any) {
    console.error("Submission Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}