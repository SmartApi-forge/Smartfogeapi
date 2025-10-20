"use client";

import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/src/trpc/client";
import { toast } from "sonner";
import { Github, X } from "lucide-react";

interface GitHubRepositoryDialogProps {
  children: React.ReactNode;
  projectId?: string;
}

export function GitHubRepositoryDialog({
  children,
  projectId,
}: GitHubRepositoryDialogProps) {
  const [repositoryName, setRepositoryName] = useState("");
  const [gitScope, setGitScope] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Check GitHub integration status
  const { data: integrationStatus, isLoading: isCheckingIntegration } = trpc.github.getIntegrationStatus.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Update project mutation (to mark it as GitHub project)
  const updateProjectMutation = trpc.projects.update.useMutation();

  // Create repository mutation
  const createRepositoryMutation = trpc.github.createRepository.useMutation({
    onSuccess: async (data) => {
      toast.success("Repository created successfully!");
      
      // If we have a projectId, update the project with GitHub info
      if (projectId && data.repoFullName && data.repoUrl) {
        try {
          await updateProjectMutation.mutateAsync({
            id: projectId,
            github_mode: true,
            github_repo_id: data.repoFullName, // Store repo full name (e.g., "username/repo-name")
            repo_url: data.repoUrl,
          });
          
          // Reload the page to show the branch selector
          window.location.reload();
        } catch (error) {
          console.error("Failed to update project with GitHub info:", error);
        }
      }
      
      setRepositoryName("");
      setGitScope("");
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create repository");
    },
    onSettled: () => {
      setIsCreating(false);
    },
  });

  const handleSubmit = async () => {
    if (!repositoryName.trim() || !gitScope) return;

    setIsCreating(true);
    
    try {
      await createRepositoryMutation.mutateAsync({
        name: repositoryName.trim(),
        isPrivate: true,
        description: `Repository created from v0 project`,
      });
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  // Redirect to GitHub auth if not connected
  const handleConnectGitHub = () => {
    window.location.href = "/api/auth/github";
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setRepositoryName("");
      setGitScope("");
      setIsCreating(false);
    }
  }, [isOpen]);

  if (isCheckingIntegration) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-[#1F2023] border-[#444444] p-3" align="end">
          <div className="flex items-center justify-center py-4">
            <div className="text-gray-300 text-sm">Checking GitHub connection...</div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (!integrationStatus?.connected) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-[#1F2023] border-[#444444] p-3" align="end">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-sm font-medium">Connect to GitHub</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-5 w-5 p-0 text-gray-400 hover:text-white"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-3">
            <p className="text-gray-400 text-xs leading-relaxed">
              You need to connect your GitHub account to create repositories.
            </p>
            <Button 
              onClick={handleConnectGitHub}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
            >
              Connect GitHub Account
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-[#1F2023] border-[#444444] p-3" align="end">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-sm font-medium">Create GitHub Repository</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-5 w-5 p-0 text-gray-400 hover:text-white"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-gray-400 text-xs leading-relaxed">
            Create a new GitHub repository for your project and push your code
          </p>
          
          <div className="space-y-1.5">
            <Label htmlFor="git-scope" className="text-white text-xs font-medium">Git Scope</Label>
            <Select value={gitScope} onValueChange={setGitScope}>
              <SelectTrigger className="bg-[#2A2D31] border-[#444444] text-white text-xs h-8">
                <SelectValue placeholder="Select Git Scope" />
              </SelectTrigger>
              <SelectContent className="bg-[#2A2D31] border-[#444444]">
                <SelectItem value="personal" className="text-white text-xs">Personal</SelectItem>
                <SelectItem value="organization" className="text-white text-xs">Organization</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repository-name" className="text-white text-xs font-medium">Repository Name</Label>
            <Input
              id="repository-name"
              value={repositoryName}
              onChange={(e) => setRepositoryName(e.target.value)}
              placeholder="Enter repository name"
              className="bg-[#2A2D31] border-[#444444] text-white placeholder-gray-500 text-xs h-8"
            />
          </div>

          <Button 
            onClick={handleSubmit}
            disabled={!repositoryName.trim() || !gitScope || isCreating}
            className="w-full bg-[#2A2D31] hover:bg-[#3A3D41] text-white disabled:opacity-50 text-xs h-8 mt-4"
          >
            {isCreating ? "Creating Repository..." : "Create Repository"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}