"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { api } from '@/lib/trpc-client';
import { toast } from 'sonner';
import Image from 'next/image';
import { useTheme } from 'next-themes';

interface GitHubRepoSelectorProps {
  onRepositorySelected?: (repo: any) => void;
  children?: React.ReactNode;
}

export function GitHubRepoSelector({ onRepositorySelected, children }: GitHubRepoSelectorProps) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [open, setOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);

  // Check integration status
  const { data: integrationStatus, isLoading: statusLoading } = api.github.getIntegrationStatus.useQuery();

  // Fetch repositories
  const { data: repositories, isLoading: reposLoading, refetch } = api.github.listRepositories.useQuery(
    { page: 1, perPage: 50 },
    { enabled: integrationStatus?.connected }
  );

  // Connect repository and create project
  const connectRepoMutation = api.github.connectRepository.useMutation({
    onSuccess: (data) => {
      toast.success('Cloning repository and starting preview...');
      // Redirect to loading page, then to project
      if (data.projectId) {
        window.location.href = `/loading?projectId=${data.projectId}`;
      }
      setOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to connect repository: ${error.message}`);
    },
  });

  const handleConnectGithub = () => {
    // Redirect to GitHub OAuth
    window.location.href = '/api/auth/github';
  };

  const handleSelectRepository = () => {
    if (!selectedRepoId) {
      toast.error('Please select a repository');
      return;
    }

    const repo = repositories?.find(r => r.id === selectedRepoId);
    if (!repo) return;

    // Create project and trigger clone + preview workflow
    connectRepoMutation.mutate({
      repositoryId: repo.id,
      repositoryFullName: repo.full_name,
      createProject: true, // This will create project and trigger workflow
    });
  };

  const isLoading = statusLoading || reposLoading;
  const isConnected = integrationStatus?.connected;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className={`w-[calc(100vw-2rem)] sm:max-w-[500px] p-0 ${isDark ? 'bg-[#0a0a0a] border-[#262626]' : 'bg-white border-[#e5e5e5]'}`}>
        <div className="p-2.5 sm:p-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <DialogTitle className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#171717]'}`}>
              Connect GitHub Repository
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className={`h-5 w-5 p-0 hover:bg-transparent ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <p className={`text-xs sm:text-sm leading-snug sm:leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Select an existing repository to clone and work with
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : !isConnected ? (
              <div className="flex flex-col gap-3 py-2">
                <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  You need to connect your GitHub account to access repositories.
                </p>
                <Button 
                  onClick={handleConnectGithub} 
                  className={`w-full text-sm h-9 ${isDark ? 'bg-[#EDEDED] hover:bg-[#E0E0E0] text-black' : 'bg-[#171717] hover:bg-black text-white'}`}
                >
                  Connect GitHub Account
                </Button>
              </div>
            ) : (
              <>
                <div className={`flex items-center gap-2 p-2 sm:p-2.5 rounded border ${isDark ? 'bg-[#262626] border-[#404040]' : 'bg-[#fafafa] border-[#e5e5e5]'}`}>
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                  <span className={`text-xs sm:text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Connected as {integrationStatus.username}
                  </span>
                </div>

                <div className="space-y-1 sm:space-y-1.5">
                  <Label htmlFor="repository-select" className={`text-xs sm:text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    Select Repository
                  </Label>
                  <Select 
                    value={selectedRepoId?.toString()} 
                    onValueChange={(value) => setSelectedRepoId(Number(value))}
                  >
                    <SelectTrigger 
                      id="repository-select"
                      className={`w-full h-9 text-sm ${isDark ? 'bg-[#262626] border-[#404040] text-white hover:bg-[#2a2a2a]' : 'bg-white border-[#e5e5e5] text-gray-900 hover:bg-[#fafafa]'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Image 
                          src={isDark ? "/github-dark.svg" : "/github-light.svg"}
                          alt="GitHub"
                          width={16}
                          height={16}
                          className={isDark ? "opacity-70" : "opacity-90"}
                        />
                        <SelectValue placeholder="Choose a repository..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent className={`${isDark ? 'bg-[#262626] border-[#404040]' : 'bg-white border-[#e5e5e5]'}`}>
                      {repositories?.map((repo) => (
                        <SelectItem 
                          key={repo.id} 
                          value={repo.id.toString()}
                          className={`text-sm ${isDark ? 'text-white focus:bg-[#2a2a2a] data-[highlighted]:bg-[#2a2a2a]' : 'text-black focus:bg-[#f2f2f2] data-[highlighted]:bg-[#f2f2f2] data-[highlighted]:text-black'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{repo.full_name}</span>
                            {repo.private && (
                              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>(Private)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {repositories && repositories.length > 0 && selectedRepoId && (
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {repositories.find(r => r.id === selectedRepoId)?.description || 'No description'}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleSelectRepository}
                  disabled={!selectedRepoId || connectRepoMutation.isLoading}
                  className={`w-full disabled:opacity-50 text-sm h-9 mt-2 sm:mt-3 ${isDark ? 'bg-[#EDEDED] hover:bg-[#E0E0E0] text-black' : 'bg-[#171717] hover:bg-black text-white'}`}
                >
                  {connectRepoMutation.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Select Repository'
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

