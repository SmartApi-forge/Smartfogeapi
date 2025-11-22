import { notFound } from 'next/navigation';
import { createCallerFactory, createTRPCContext } from '@/src/trpc/init';
import { appRouter } from '@/src/trpc/routers/_app';
import { ProjectPageClient } from './project-page-client';
import { TRPCError } from '@trpc/server';

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  // Validate projectId format (basic UUID validation)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(projectId)) {
    notFound();
  }

  try {
    // Create tRPC context and caller for server-side data fetching
    const ctx = await createTRPCContext();
    const createCaller = createCallerFactory(appRouter);
    const caller = createCaller(ctx);

    // Fetch both project data and messages in parallel for better performance
    const [project, messages] = await Promise.all([
      // Fetch real project data from database
      caller.projects.getOne({ id: projectId }),
      // Fetch project messages with fragments
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

export async function generateMetadata({ params }: ProjectPageProps) {
  const { projectId } = await params;
  
  return {
    title: `Project ${projectId.slice(0, 8)} - SmartAPIForge`,
    description: 'View project details, conversation history, and generated API code.',
  };
}