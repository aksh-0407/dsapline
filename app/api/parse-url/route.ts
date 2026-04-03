import { NextResponse } from "next/server";
import { enrichProblemData } from "@/lib/services";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "Missing URL" }, { status: 400 });

    const data = await enrichProblemData(url);
    if (!data) return NextResponse.json({ success: false });

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }
}