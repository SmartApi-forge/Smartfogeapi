"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Github, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/trpc-client';
import { toast } from 'sonner';

interface GitHubRepoSelectorProps {
  onRepositorySelected?: (repo: any) => void;
  children?: React.ReactNode;
}

export function GitHubRepoSelector({ onRepositorySelected, children }: GitHubRepoSelectorProps) {
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
        {children || (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 py-0 rounded-full text-xs text-gray-200 border-[#444444] bg-transparent hover:bg-gray-700/40"
          >
            <Github className="h-3.5 w-3.5 mr-1.5" />
            GitHub
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-[#1F2023] border-[#444444]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Github className="h-5 w-5" />
            Connect GitHub Repository
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Select an existing repository to clone and work with
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !isConnected ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-center space-y-2">
                <XCircle className="h-12 w-12 text-gray-500 mx-auto" />
                <p className="text-sm text-gray-400">
                  GitHub not connected. Connect your GitHub account to access repositories.
                </p>
              </div>
              <Button onClick={handleConnectGithub} className="w-full">
                <Github className="mr-2 h-4 w-4" />
                Connect GitHub Account
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                <span>Connected as {integrationStatus.username}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">
                  Select Repository
                </label>
                <Select 
                  value={selectedRepoId?.toString()} 
                  onValueChange={(value) => setSelectedRepoId(Number(value))}
                >
                  <SelectTrigger className="bg-[#2A2A2E] border-[#444444] text-white">
                    <SelectValue placeholder="Choose a repository..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2A2A2E] border-[#444444]">
                    {repositories?.map((repo) => (
                      <SelectItem 
                        key={repo.id} 
                        value={repo.id.toString()}
                        className="text-white hover:bg-[#3A3A40]"
                      >
                        <div className="flex items-center gap-2">
                          <span>{repo.full_name}</span>
                          {repo.private && (
                            <span className="text-xs text-gray-500">(Private)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {repositories && repositories.length > 0 && selectedRepoId && (
                  <p className="text-xs text-gray-400">
                    {repositories.find(r => r.id === selectedRepoId)?.description || 'No description'}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSelectRepository}
                  disabled={!selectedRepoId || connectRepoMutation.isLoading}
                  className="flex-1"
                >
                  {connectRepoMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Select Repository'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

