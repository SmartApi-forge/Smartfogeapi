"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingAnimation } from "@/components/ui/loading-animation";

/**
 * Loading Page - Brief transition before redirecting to project page
 * 
 * Modes:
 * - ?mode=github → Redirect with ?clone=true for GitHub repo cloning
 * - Default → Redirect with ?generate=true for AI code generation
 */
function LoadingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId");
  const mode = searchParams?.get("mode"); // 'github' or undefined

  // Redirect to project page with appropriate action
  useEffect(() => {
    if (projectId) {
      // Brief delay to show loading animation, then redirect
      const timer = setTimeout(() => {
        if (mode === 'github') {
          // GitHub mode: clone the repository
          router.push(`/projects/${projectId}?clone=true`);
        } else {
          // Normal mode: generate code from prompt
          router.push(`/projects/${projectId}?generate=true`);
        }
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // No projectId, go back to ask
      const timer = setTimeout(() => {
        router.push("/ask");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [projectId, mode, router]);

  return <LoadingAnimation />;
}

export default function LoadingPage() {
  return (
    <Suspense fallback={<LoadingAnimation />}>
      <LoadingPageContent />
    </Suspense>
  );
}
