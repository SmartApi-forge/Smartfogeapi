import { notFound } from 'next/navigation';
import { createCallerFactory, createTRPCContext } from '@/src/trpc/init';
import { appRouter } from '@/src/trpc/routers/_app';
import { ProjectPageClient } from './project-page-client';

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

    // Fetch project messages with fragments
    const messages = await caller.messages.getMany({
      projectId,
      limit: 100,
      includeFragment: true,
    });

    // Mock project data - in a real app, you'd fetch this from your projects table
    const project = {
      id: projectId,
      name: `Project ${projectId.slice(0, 8)}`,
      description: 'API project generated with SmartAPIForge',
      framework: 'fastapi' as const,
      status: 'deployed' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deploy_url: `https://api-${projectId.slice(0, 8)}.vercel.app`,
      swagger_url: `https://api-${projectId.slice(0, 8)}.vercel.app/docs`,
    };

    return (
      <ProjectPageClient
        projectId={projectId}
        initialMessages={messages}
        project={project}
      />
    );
  } catch (error) {
    console.error('Error fetching project data:', error);
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