"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/src/trpc/client";
import { toast } from "sonner";
import { Github, X, GitBranch, Plus, Check, Loader2, Search } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";

interface GitHubSetupDialogProps {
  children: React.ReactNode;
  projectId: string;
  projectFiles?: Record<string, any>; // Files to push
}

interface Branch {
  name: string;
  sha: string;
}

export function GitHubSetupDialog({
  children,
  projectId,
  projectFiles = {},
}: GitHubSetupDialogProps) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  
  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'connect' | 'create-repo' | 'select-branch'>('create-repo');
  
  // Repo creation state
  const [repositoryName, setRepositoryName] = useState<string>("");
  const [gitScope, setGitScope] = useState<string>(""); // GitHub username or org name
  const [isCreating, setIsCreating] = useState(false);
  const [gitHubUsername, setGitHubUsername] = useState<string>("");
  const [gitHubOrgs, setGitHubOrgs] = useState<Array<{ login: string; avatar_url: string }>>([]);
  const [loadingScopes, setLoadingScopes] = useState(false);
  
  // Branch selection state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [createBranchMode, setCreateBranchMode] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [isPushing, setIsPushing] = useState(false);
  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  
  // Created repo info
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [repoFullName, setRepoFullName] = useState<string>("");
  const [repoId, setRepoId] = useState<number>(0);

  // Check GitHub integration status
  const { data: integrationStatus, isLoading: isCheckingIntegration } = trpc.github.getIntegrationStatus.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Fetch GitHub user info and organizations when step is create-repo
  useEffect(() => {
    if (isOpen && step === 'create-repo' && integrationStatus?.connected && !gitHubUsername) {
      fetchGitHubScopes();
    }
  }, [isOpen, step, integrationStatus]);

  const fetchGitHubScopes = async () => {
    setLoadingScopes(true);
    try {
      // Fetch user info from integration status
      if (integrationStatus?.username) {
        setGitHubUsername(integrationStatus.username);
        setGitScope(integrationStatus.username); // Set default to user's account
      }

      // Fetch user's organizations using authenticated tRPC endpoint
      const orgs = await trpcUtils.github.getUserOrgs.fetch();
      if (orgs && Array.isArray(orgs)) {
        setGitHubOrgs(orgs);
      }
    } catch (error) {
      console.error('Failed to fetch GitHub scopes:', error);
    } finally {
      setLoadingScopes(false);
    }
  };

  // Update project mutation
  const updateProjectMutation = trpc.projects.update.useMutation();

  // Store repository mutation
  const storeRepositoryMutation = trpc.github.storeRepository.useMutation();

  // Create repository mutation
  const createRepositoryMutation = trpc.github.createRepository.useMutation({
    onSuccess: async (data) => {
      if (data.success && data.repoUrl && data.repoFullName && data.repoId) {
        toast.success("Repository created successfully!");
        
        // Store repo info
        setRepoUrl(data.repoUrl);
        setRepoFullName(data.repoFullName);
        setRepoId(data.repoId);
        
        // Poll for repository initialization with exponential backoff
        toast.loading("Initializing repository...", { id: "init" });
        let retries = 0;
        const maxRetries = 5;
        while (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          try {
            await fetchBranches(data.repoFullName);
            toast.success("Repository initialized!", { id: "init" });
            break;
          } catch (error) {
            retries++;
            if (retries === maxRetries) {
              toast.error("Repository initialization timeout", { id: "init" });
              setIsCreating(false);
              return;
            }
          }
        }
        
        // Move to branch selection step
        setStep('select-branch');
        setIsCreating(false);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create repository");
      setIsCreating(false);
    },
  });

  // Fetch branches from GitHub with authentication
  const fetchBranches = async (repoFullName: string) => {
    setLoadingBranches(true);
    try {
      const [owner, repo] = repoFullName.split('/');
      
      // Use tRPC query for authenticated request
      const branchData = await trpcUtils.github.getBranches.fetch({ owner, repo });
      
      if (branchData && branchData.length > 0) {
        // Safely map branches with sha check
        setBranches(
          branchData
            .filter((b: any) => b.commit && b.commit.sha) // Filter out branches without sha
            .map((b: any) => ({ 
              name: b.name, 
              sha: b.commit.sha 
            }))
        );
        
        // Set default branch (main, master, or first available)
        const hasMain = branchData.some((b: any) => b.name === 'main');
        const hasMaster = branchData.some((b: any) => b.name === 'master');
        
        if (hasMain) {
          setSelectedBranch('main');
        } else if (hasMaster) {
          setSelectedBranch('master');
        } else if (branchData.length > 0) {
          setSelectedBranch(branchData[0].name);
        }
      } else {
        // Repository is empty or still initializing - throw error to trigger retry
        setBranches([]);
        setSelectedBranch('');
        throw new Error('Repository has no branches yet');
      }
    } catch (error: any) {
      console.error("Failed to fetch branches:", error);
      setBranches([]);
      setSelectedBranch('');
      
      // Use structured error properties instead of string matching
      const status = error?.response?.status || error?.status || error?.data?.httpStatus;
      const errorCode = error?.code;
      
      if (status === 404 || errorCode === 'NOT_FOUND') {
        // Repository not found or not yet initialized - re-throw for retry
        throw new Error('Repository not found or not yet initialized');
      } else if (status === 401 || errorCode === 'UNAUTHORIZED') {
        // Authentication failed - don't retry, show error
        toast.error('GitHub authentication failed. Please reconnect.');
        throw new Error('Authentication failed');
      }
      
      // Re-throw to allow retry logic to handle it
      throw error;
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleCreateRepository = async () => {
    if (!repositoryName.trim() || !gitScope) return;

    setIsCreating(true);
    
    try {
      await createRepositoryMutation.mutateAsync({
        name: repositoryName.trim(),
        isPrivate: true,
        description: `Repository created from SmartAPIForge project`,
        owner: gitScope, // Username or organization
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleSetActiveBranch = async () => {
    setIsPushing(true);
    
    try {
      // 1. Store repository in database and link to project
      await storeRepositoryMutation.mutateAsync({
        projectId,
        repoFullName,
        repoUrl,
        repoId,
        defaultBranch: selectedBranch,
        isPrivate: true,
        description: `Repository created from SmartAPIForge project`,
      });

      // 2. Push all project files to the selected branch
      const response = await fetch('/api/github/push-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          repoFullName,
          branch: selectedBranch,
          files: projectFiles,
        }),
      });

      if (response.ok) {
        toast.success(`✓ Connected to GitHub - Code pushed to ${selectedBranch}!`);
        
        // Close this dialog - GitHub button will now show GitHubBranchSelectorV0
        setIsOpen(false);
        
        // Invalidate queries to refresh UI without full page reload
        await trpcUtils.github.getIntegrationStatus.invalidate();
        await trpcUtils.projects.getOne.invalidate();
        
        // Optionally refresh the router to update any server components
        router.refresh();
      } else {
        throw new Error('Failed to push code');
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to push code");
    } finally {
      setIsPushing(false);
    }
  };

  // Create branch mutation
  const createBranchMutation = trpc.github.createBranch.useMutation({
    onSuccess: async () => {
      toast.success(`Branch ${newBranchName} created!`);
      await fetchBranches(repoFullName);
      setSelectedBranch(newBranchName);
      setCreateBranchMode(false);
      setNewBranchName("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create branch");
    },
  });

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    
    if (!selectedBranch) {
      toast.error("Please select a base branch first");
      return;
    }
    
    try {
      // Use tRPC mutation for authenticated branch creation
      await createBranchMutation.mutateAsync({
        repoFullName,
        branchName: newBranchName.trim(),
        baseBranch: selectedBranch,
      });
    } catch (error) {
      // Error handled in mutation
    }
  };

  // Determine initial step based on connection status
  useEffect(() => {
    if (isOpen && integrationStatus) {
      if (!integrationStatus.connected) {
        setStep('connect');
      } else {
        setStep('create-repo');
      }
    }
  }, [isOpen, integrationStatus]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep('create-repo');
      setRepositoryName("");
      setGitScope("");
      setIsCreating(false);
      setBranches([]);
      setSelectedBranch("main");
      setCreateBranchMode(false);
      setNewBranchName("");
      setRepoUrl("");
      setRepoFullName("");
      setRepoId(0);
      setBranchSearchTerm("");
    }
  }, [isOpen]);

  if (isCheckingIntegration) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-[400px] bg-[#1F2023] border-[#444444] p-3 overflow-hidden" align="end">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
            <span className="ml-2 text-gray-300 text-sm">Checking GitHub connection...</span>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Step 1: Connect GitHub
  if (step === 'connect') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
        <PopoverContent className={`w-[calc(100vw-2rem)] sm:w-[400px] max-w-[400px] p-2.5 sm:p-4 overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-[#262626]' : 'bg-white border-[#e5e5e5]'}`} align="center" side="bottom" sideOffset={12} collisionPadding={16}>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#171717]'}`}>Connect to GitHub</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className={`h-5 w-5 p-0 hover:bg-transparent ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-3">
            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              You need to connect your GitHub account to create repositories.
            </p>
            <Button 
              onClick={() => window.location.href = "/api/auth/github"}
              className={`w-full text-sm h-9 ${isDark ? 'bg-[#171717] hover:bg-black text-white' : 'bg-[#fafafa] hover:bg-[#f2f2f2] text-gray-900'}`}
            >
              Connect GitHub Account
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Step 2: Create Repository
  if (step === 'create-repo') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
        <PopoverContent className={`w-[calc(100vw-2rem)] sm:w-[400px] max-w-[400px] p-2.5 sm:p-4 overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-[#262626]' : 'bg-white border-[#e5e5e5]'}`} align="center" side="bottom" sideOffset={12} collisionPadding={16}>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#171717]'}`}>Create Repository</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className={`h-5 w-5 p-0 hover:bg-transparent ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <p className={`text-xs sm:text-sm leading-snug sm:leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Create a new{" "}
              <a 
                href="https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                private repository
              </a>{" "}
              to sync changes to. SmartAPIForge will push changes to a branch on this repository each time you send a message.
            </p>
            
            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="git-scope" className={`text-xs sm:text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Git Scope</Label>
              <Select value={gitScope} onValueChange={setGitScope} disabled={loadingScopes}>
                <SelectTrigger className={`w-full h-9 text-sm overflow-hidden ${isDark ? 'bg-[#262626] border-[#404040] text-white hover:bg-[#2a2a2a]' : 'bg-white border-[#e5e5e5] text-gray-900 hover:bg-[#fafafa]'}`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Image 
                      src={isDark ? "/github-dark.svg" : "/github-light.svg"}
                      alt="GitHub"
                      width={16}
                      height={16}
                      className={`flex-shrink-0 ${isDark ? "opacity-70" : "opacity-90"}`}
                    />
                    <SelectValue placeholder={loadingScopes ? "Loading..." : "Select Git Scope"} className="truncate" />
                  </div>
                </SelectTrigger>
                <SelectContent className={`${isDark ? 'bg-[#262626] border-[#404040]' : 'bg-white border-[#e5e5e5]'}`}>
                  {gitHubUsername && (
                    <SelectItem value={gitHubUsername} className={`text-sm ${isDark ? 'text-white focus:bg-[#2a2a2a] data-[highlighted]:bg-[#2a2a2a]' : 'text-black focus:bg-[#f2f2f2] data-[highlighted]:bg-[#f2f2f2] data-[highlighted]:text-black'}`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`truncate min-w-0 flex-1 ${isDark ? '' : 'text-black'}`}>{gitHubUsername}</span>
                        <span className={`text-xs flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>(Personal)</span>
                      </div>
                    </SelectItem>
                  )}
                  {gitHubOrgs.map((org) => (
                    <SelectItem key={org.login} value={org.login} className={`text-sm ${isDark ? 'text-white focus:bg-[#2a2a2a] data-[highlighted]:bg-[#2a2a2a]' : 'text-black focus:bg-[#f2f2f2] data-[highlighted]:bg-[#f2f2f2] data-[highlighted]:text-black'}`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`truncate min-w-0 flex-1 ${isDark ? '' : 'text-black'}`}>{org.login}</span>
                        <span className={`text-xs flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>(Organization)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:space-y-1.5">
              <Label htmlFor="repository-name" className={`text-xs sm:text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Repository Name</Label>
              <Input
                id="repository-name"
                value={repositoryName}
                onChange={(e) => setRepositoryName(e.target.value)}
                placeholder="Enter repository name"
                className={`h-9 text-sm ${isDark ? 'bg-[#262626] border-[#404040] text-white placeholder-gray-500 hover:bg-[#2a2a2a]' : 'bg-white border-[#e5e5e5] text-gray-900 placeholder-gray-400 hover:bg-[#fafafa]'}`}
              />
            </div>

            <Button 
              onClick={handleCreateRepository}
              disabled={!repositoryName.trim() || !gitScope || isCreating}
              className={`w-full disabled:opacity-50 text-sm h-9 mt-2 sm:mt-3 ${isDark ? 'bg-[#EDEDED] hover:bg-[#E0E0E0] text-black' : 'bg-[#171717] hover:bg-black text-white'}`}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Repository...
                </>
              ) : (
                "Create Repository"
              )}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Step 3: Select Branch
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className={`w-[calc(100vw-2rem)] sm:w-[400px] max-w-[400px] p-2.5 sm:p-4 overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-[#262626]' : 'bg-white border-[#e5e5e5]'}`} align="center" side="bottom" sideOffset={12} collisionPadding={16}>
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#171717]'}`}>Select a Branch</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className={`h-5 w-5 p-0 hover:bg-transparent ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-2 sm:space-y-3">
          <p className={`text-xs sm:text-sm leading-snug sm:leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Select which branch you want to sync changes to.
          </p>

          {/* Repository Info */}
          <div className={`rounded p-2 sm:p-2.5 border ${isDark ? 'bg-[#262626] border-[#404040]' : 'bg-[#fafafa] border-[#e5e5e5]'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Image 
                src={isDark ? "/github-dark.svg" : "/github-light.svg"}
                alt="GitHub"
                width={16}
                height={16}
                className={`flex-shrink-0 ${isDark ? "opacity-70" : "opacity-90"}`}
              />
              <span className={`text-xs font-mono truncate min-w-0 flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{repoFullName}</span>
            </div>
          </div>

          {/* Branch Selection */}
          <div className="space-y-1 sm:space-y-1.5">
            <Label className={`text-xs sm:text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Active Branch</Label>
            
            <Popover open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-between h-9 text-sm font-normal min-w-0 ${isDark ? 'bg-[#262626] border-[#404040] text-white hover:bg-[#2a2a2a]' : 'bg-white border-[#e5e5e5] text-gray-900 hover:bg-[#fafafa]'}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <GitBranch className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate min-w-0 flex-1">{selectedBranch || 'No branch selected'}</span>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50 flex-shrink-0">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className={`w-[calc(100vw-2.5rem)] sm:w-[280px] max-w-[320px] p-0 ${isDark ? 'bg-[#1a1a1a] border-[#333333]' : 'bg-white border-[#e5e5e5]'}`}
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <div className="p-2">
                  {/* Search input */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      placeholder="Search branches"
                      value={branchSearchTerm}
                      onChange={(e) => setBranchSearchTerm(e.target.value)}
                      className={`pl-8 h-8 text-sm ${isDark ? 'bg-[#262626] border-[#404040] text-white placeholder:text-gray-500' : 'bg-[#fafafa] border-[#e5e5e5] text-gray-900 placeholder:text-gray-400'}`}
                    />
                  </div>
                  
                  {/* Branch list */}
                  <div className="max-h-40 overflow-y-auto mb-2">
                    {loadingBranches ? (
                      <div className={`p-2 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Loading branches...
                      </div>
                    ) : (
                      <>
                        {/* Show branches from API (filtered by search term) */}
                        {branches.filter((branch) => 
                          branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase())
                        ).map((branch) => (
                          <button
                            key={branch.name}
                            onClick={() => {
                              setSelectedBranch(branch.name)
                              setBranchDropdownOpen(false)
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded text-sm transition-colors min-w-0 ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f2f2f2]'}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <GitBranch className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <span className={`truncate min-w-0 flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{branch.name}</span>
                            </div>
                            {selectedBranch === branch.name && (
                              <Check className={`h-3.5 w-3.5 flex-shrink-0 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                            )}
                          </button>
                        ))}
                        
                        {/* Show "no results" message if search returns nothing */}
                        {branches.filter((branch) => 
                          branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase())
                        ).length === 0 && branches.length > 0 && (
                          <div className={`p-2 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            No branches match "{branchSearchTerm}"
                          </div>
                        )}
                        
                        {/* If no branches from API but we have selectedBranch, show it */}
                        {branches.length === 0 && selectedBranch && (
                          <button
                            onClick={() => {
                              setBranchDropdownOpen(false)
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded text-sm transition-colors min-w-0 ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f2f2f2]'}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <GitBranch className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <span className={`truncate min-w-0 flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedBranch}</span>
                            </div>
                            <Check className={`h-3.5 w-3.5 flex-shrink-0 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Create Branch option - disabled if no branches exist */}
                  <button
                    onClick={() => {
                      if (branches.length === 0) {
                        toast.error("Cannot create branch: repository has no base branch yet");
                        return;
                      }
                      setBranchDropdownOpen(false)
                      setCreateBranchMode(true)
                    }}
                    disabled={branches.length === 0}
                    className={`w-full flex items-center gap-2 p-2 rounded text-sm transition-colors pt-2 ${branches.length === 0 ? 'opacity-50 cursor-not-allowed' : ''} ${isDark ? 'hover:bg-[#2a2a2a] border-t border-[#333333]' : 'hover:bg-[#f2f2f2] border-t border-[#e5e5e5]'}`}
                  >
                    <div className={`flex items-center justify-center w-4 h-4 rounded-full ${isDark ? 'bg-white' : 'bg-gray-900'}`}>
                      <Plus className={`h-3 w-3 ${isDark ? 'text-gray-900' : 'text-white'}`} />
                    </div>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Create Branch</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* No branches warning */}
          {branches.length === 0 && (
            <div className={`p-2 rounded border text-xs ${isDark ? 'bg-yellow-900/20 border-yellow-700/30 text-yellow-200' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
              <p className="font-medium mb-1">No branches available</p>
              <p className="opacity-90">The repository is empty. Create a branch first or wait for initialization to complete.</p>
            </div>
          )}

          {/* Set Active Branch Button */}
          <Button
            onClick={handleSetActiveBranch}
            disabled={isPushing || !selectedBranch || branches.length === 0}
            className={`w-full font-medium text-sm h-9 ${isDark ? 'bg-[#171717] hover:bg-black text-white disabled:opacity-50' : 'bg-[#fafafa] hover:bg-[#f2f2f2] text-gray-900 disabled:opacity-50'}`}
          >
            {isPushing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting active branch...
              </>
            ) : (
              "Set Active Branch"
            )}
          </Button>
        </div>

        {/* Create Branch Modal Overlay */}
        {createBranchMode && (
          <div className={`absolute inset-0 rounded p-3 flex flex-col ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#171717]'}`}>Create Branch</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreateBranchMode(false)
                  setNewBranchName("")
                }}
                className={`h-5 w-5 p-0 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            <div className="space-y-2 flex-1">
              <Label className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Branch Name</Label>
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/new-feature"
                className={`h-8 text-sm ${isDark ? 'bg-[#262626] border-[#404040] text-white placeholder-gray-500' : 'bg-white border-[#e5e5e5] text-gray-900 placeholder-gray-400'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newBranchName.trim()) {
                    handleCreateBranch()
                  }
                }}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setCreateBranchMode(false)
                  setNewBranchName("")
                }}
                variant="outline"
                size="sm"
                className={`flex-1 text-sm h-8 ${isDark ? 'bg-transparent border-[#404040] text-white hover:bg-[#2a2a2a]' : 'bg-white border-[#e5e5e5] text-gray-900 hover:bg-[#fafafa]'}`}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim()}
                size="sm"
                className={`flex-1 text-sm h-8 ${isDark ? 'bg-[#EDEDED] hover:bg-[#E0E0E0] text-black' : 'bg-[#171717] hover:bg-black text-white'}`}
              >
                Create
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
