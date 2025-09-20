import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Fetch job details from database
    const { data: job, error } = await supabase
      .from("jobs")
      .select(`
        *,
        api_fragments (
          id,
          openapi_spec,
          implementation_code,
          requirements,
          description,
          validation_results,
          pr_url,
          created_at
        )
      `)
      .eq("id", jobId)
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch job status" },
        { status: 500 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Return job status with related data
    return NextResponse.json({
      id: job.id,
      status: job.status,
      prompt: job.prompt,
      mode: job.mode,
      repo_url: job.repo_url,
      created_at: job.created_at,
      completed_at: job.completed_at,
      error_message: job.error_message,
      result: job.result,
      api_fragment: job.api_fragments?.[0] || null,
    });
  } catch (error) {
    console.error("Error fetching job status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}