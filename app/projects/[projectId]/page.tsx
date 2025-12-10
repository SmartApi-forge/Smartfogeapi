import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createCallerFactory, createTRPCContext } from '@/src/trpc/init';
import { appRouter } from '@/src/trpc/routers/_app';
import { ProjectPageClient } from './project-page-client';
import { ProjectDetailsSkeleton, MessagesSkeleton } from '@/components/project-skeletons';
import { TRPCError } from '@trpc/server';

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

/**
 * Async component that fetches project data
 * Wrapped in Suspense for streaming
 * Requirements: 5.1, 5.2 - Suspense boundaries with skeleton fallback
 */
async function ProjectDataLoader({ projectId }: { projectId: string }) {
  try {
    const ctx = await createTRPCContext();
    const createCaller = createCallerFactory(appRouter);
    const caller = createCaller(ctx);

    // Fetch both project data and messages in parallel for better performance
    // Requirements: 5.4 - Parallel data fetching with Promise.all
    const [project, messages] = await Promise.all([
      caller.projects.getOne({ id: projectId }),
      caller.messages.getMany({
        projectId,
        limit: 100,
        includeFragment: true,
      })
    ]);

    return (
      <ProjectPageClient
        projectId={projectId}
        initialMessages={messages}
        project={project}
      />
    );
  } catch (error) {
    console.error('Error fetching project data:', error);
    
    // Handle specific error cases
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
      notFound();
    }
    
    // For other errors, also show not found to avoid exposing internal errors
    notFound();
  }
}

/**
 * Combined skeleton for full page loading state
 * Requirements: 5.1 - Skeleton fallback for slow data fetches
 */
function ProjectPageSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r p-4 hidden lg:block">
        <ProjectDetailsSkeleton />
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        <MessagesSkeleton />
      </div>
    </div>
  );
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  // Validate projectId format (basic UUID validation)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(projectId)) {
    notFound();
  }

  // Wrap data fetching in Suspense for streaming
  // Requirements: 5.1, 5.2 - Suspense boundaries with skeleton fallback
  return (
    <Suspense fallback={<ProjectPageSkeleton />}>
      <ProjectDataLoader projectId={projectId} />
    </Suspense>
  );
}

export async function generateMetadata({ params }: ProjectPageProps) {
  const { projectId } = await params;
  
  return {
    title: `Project ${projectId.slice(0, 8)} - SmartAPIForge`,
    description: 'View project details, conversation history, and generated API code.',
  };
}