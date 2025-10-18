"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingAnimation } from "@/components/ui/loading-animation";

function LoadingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId");

  useEffect(() => {
    // Fast redirect - just show animation for 1 second then redirect
    const timer = setTimeout(() => {
      if (projectId) {
        router.push(`/projects/${projectId}`);
      } else {
        // Fallback to ask page if no projectId
        router.push("/ask");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [projectId, router]);

  const handleAnimationComplete = () => {
    if (projectId) {
      router.push(`/projects/${projectId}`);
    } else {
      router.push("/ask");
    }
  };

  return <LoadingAnimation onComplete={handleAnimationComplete} />;
}

export default function LoadingPage() {
  return (
    <Suspense fallback={<LoadingAnimation />}>
      <LoadingPageContent />
    </Suspense>
  );
}
