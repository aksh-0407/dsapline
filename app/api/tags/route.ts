import { NextResponse } from "next/server";
import { getGlobalTags } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const tags = await getGlobalTags();
  return NextResponse.json(tags);
}