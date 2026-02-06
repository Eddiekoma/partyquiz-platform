import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// DEV ONLY - Opens Chrome incognito with a URL
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 });
  }

  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // macOS command to open Chrome in incognito
    const command = `open -na "Google Chrome" --args --incognito "${url}"`;
    
    await execAsync(command);
    
    return NextResponse.json({ success: true, message: "Opened in incognito" });
  } catch (error: any) {
    console.error("Error opening incognito:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
