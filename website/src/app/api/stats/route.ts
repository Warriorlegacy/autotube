import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const [
      { count: totalVideos },
      { count: todayVideos },
      { count: waitlistCount },
      { count: activeTopics },
    ] = await Promise.all([
      supabaseAdmin
        .from("pipeline_runs")
        .select("*", { count: "exact", head: true })
        .eq("status", "success"),
      supabaseAdmin
        .from("pipeline_runs")
        .select("*", { count: "exact", head: true })
        .eq("status", "success")
        .gte("created_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
      supabaseAdmin
        .from("waitlist")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("topics")
        .select("*", { count: "exact", head: true })
        .eq("status", "queued"),
    ]);

    return NextResponse.json({
      total_videos: totalVideos ?? 0,
      videos_today: todayVideos ?? 0,
      waitlist_count: waitlistCount ?? 0,
      queued_topics: activeTopics ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
