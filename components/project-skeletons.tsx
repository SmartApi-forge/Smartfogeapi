import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for project details section
 * Shows loading state for project header, status, and metadata
 * Requirements: 5.1 - Suspense boundaries with skeleton fallback
 */
export function ProjectDetailsSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-300">
      {/* Project header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* Status bar skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Project metadata skeleton */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    </div>
  );
}


/**
 * Skeleton loader for messages/chat section
 * Shows loading state for conversation history
 * Requirements: 5.1 - Suspense boundaries with skeleton fallback
 */
export function MessagesSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-300">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="flex items-start gap-2 max-w-[80%]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-64 ml-auto" />
            <Skeleton className="h-4 w-48 ml-auto" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        </div>
      </div>

      {/* Assistant message skeleton */}
      <div className="flex justify-start">
        <div className="flex items-start gap-2 max-w-[80%]">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>

      {/* Another user message skeleton */}
      <div className="flex justify-end">
        <div className="flex items-start gap-2 max-w-[80%]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 ml-auto" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        </div>
      </div>

      {/* Another assistant message skeleton with code block */}
      <div className="flex justify-start">
        <div className="flex items-start gap-2 max-w-[80%]">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-24 w-80 rounded-md" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for file tree/explorer section
 * Shows loading state for project file structure
 * Requirements: 5.1 - Suspense boundaries with skeleton fallback
 */
export function FileTreeSkeleton() {
  return (
    <div className="p-2 space-y-1 animate-in fade-in duration-300">
      {/* Root folder */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      {/* Nested items */}
      <div className="pl-4 space-y-1">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="pl-4 space-y-1">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      
      {/* More root items */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader for code viewer section
 * Shows loading state for file content display
 * Requirements: 5.1 - Suspense boundaries with skeleton fallback
 */
export function CodeViewerSkeleton() {
  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-7 w-16 rounded" />
          <Skeleton className="h-7 w-16 rounded" />
        </div>
      </div>
      
      {/* Code lines */}
      <div className="flex-1 p-4 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-60" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-52" />
      </div>
    </div>
  );
}
