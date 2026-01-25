'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';
import { api } from '@/lib/trpc-client';
import { authService } from '@/lib/auth';
import type { Attachment } from '@/src/types/chat-ux';
import type { AIModel } from '@/components/model-selector';

/**
 * Client component that handles prompt submission logic.
 * Extracted from app/page.tsx to enable Server Component architecture.
 * 
 * Updated to use model selector instead of Ask/Code mode toggle
 */
export function PromptInputClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Use the tRPC mutation hook
  const generateAPI = api.apiGeneration.generateAPI.useMutation({
    onSuccess: (result) => {
      console.log('✅ API generation successful, result:', result);
      // Redirect to the loading page with the new project ID
      console.log('🔄 Redirecting to loading page:', `/loading?projectId=${result.projectId}`);
      router.push(`/loading?projectId=${result.projectId}`);
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('❌ Failed to create project:', error);
      setIsLoading(false);
      // Handle error - could show a toast or error message
    }
  });

  const handlePromptSubmit = async (prompt: string, model: AIModel, attachments: Attachment[]) => {
    console.log('🚀 handlePromptSubmit called with:', { prompt, model, attachmentCount: attachments.length });
    
    // Check if user is authenticated using Supabase session
    const { session } = await authService.getCurrentSession();
    console.log('👤 Current session:', session);
    
    if (!session?.user) {
      console.log('❌ No authenticated session found, redirecting to login');
      // If not authenticated, show login dialog
      router.push('/?auth=login');
      return;
    }

    console.log('✅ User authenticated, starting API generation');
    setIsLoading(true);
    
    // Create a new project with the prompt using the API generation router
    console.log('📡 Calling generateAPI.mutate with:', {
      prompt: prompt,
      framework: 'fastapi',
      advanced: false,
      model,
      attachmentCount: attachments.length
    });
    
    generateAPI.mutate({
      prompt: prompt,
      framework: 'fastapi',
      advanced: false,
      model: model,
    });
  };

  return <PromptInputBox onSend={handlePromptSubmit} isLoading={isLoading} />;
}
