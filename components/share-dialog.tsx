"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Link as LinkIcon, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/trpc-client";

interface ShareDialogProps {
  children: React.ReactNode;
  projectId: string;
  projectName: string;
  isGitHubProject?: boolean;
  repoUrl?: string;
  isProjectOwner?: boolean;
}

export function ShareDialog({
  children,
  projectId,
  projectName,
  isGitHubProject = false,
  repoUrl,
  isProjectOwner = true,
}: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState<"public" | "workspace" | "personal" | "business">("public");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showMigrationError, setShowMigrationError] = useState(false);
  const [previousAccessLevel, setPreviousAccessLevel] = useState<string | null>(null);
  const visibilityToastId = useRef<string | number | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);

  // Fetch existing invitations
  const { data: invitations = [] } = api.invitations.getProjectInvitations.useQuery(
    { projectId },
    { enabled: open }
  );

  // Fetch project collaborators
  const { data: collaboratorsData } = api.invitations.getProjectCollaborators.useQuery(
    { projectId },
    { enabled: open }
  );

  // Mutations
  const createInviteLinkMutation = api.invitations.createInviteLink.useMutation({
    onSuccess: (data) => {
      const fullUrl = `${window.location.origin}/invite/${data.token}`;
      setInviteLink(fullUrl);
      toast.success("Secret link created");
      setShowMigrationError(false);
    },
    onError: (error) => {
      console.error('Create invite link error:', error);
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        setShowMigrationError(true);
        toast.error("Please run database migration first");
      } else {
        toast.error(error.message || "Failed to create invite link");
      }
    },
  });

  const deleteInviteMutation = api.invitations.deleteInvitation.useMutation({
    onSuccess: () => {
      setInviteLink(null);
      toast.success("Invite link removed");
    },
    onError: (error) => {
      toast.error("Failed to remove invite link");
      console.error(error);
    },
  });

  const sendEmailInviteMutation = api.invitations.sendEmailInvite.useMutation({
    onSuccess: (data) => {
      setEmail("");
      
      // Show appropriate message based on email sending status
      if (data.emailSent) {
        toast.success(`✉️ Invitation sent to ${data.email}`);
      } else if (data.emailError) {
        toast.warning(`Invitation created, but email failed: ${data.emailError}`);
      } else {
        toast.info("Invitation created. Please configure RESEND_API_KEY to send emails.");
      }
      
      setShowMigrationError(false);
    },
    onError: (error) => {
      console.error('Send email invite error:', error);
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        setShowMigrationError(true);
        toast.error("Please run database migration first");
      } else {
        toast.error(error.message || "Failed to send invitation");
      }
    },
  });

  const handleCreateInviteLink = () => {
    createInviteLinkMutation.mutate({
      projectId,
      accessLevel,
    });
  };

  const handleCopyLink = async () => {
    // For GitHub projects, copy the repository URL
    if (isGitHubProject && repoUrl) {
      try {
        await navigator.clipboard.writeText(repoUrl);
        setIsCopied(true);
        toast.success("Repository link copied to clipboard");
        setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {
        toast.error("Failed to copy link");
      }
      return;
    }
    
    // For regular projects, copy the invitation link
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setIsCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleRemoveLink = () => {
    const invitation = invitations.find((inv) => inv.status === "pending");
    if (invitation) {
      deleteInviteMutation.mutate({ invitationId: invitation.id });
    }
  };

  const handleSendInvite = () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    sendEmailInviteMutation.mutate({
      projectId,
      email: email.trim(),
      accessLevel,
    });
  };

  // Check if there's an active invite link
  const activeInvitation = invitations.find((inv) => inv.status === "pending");
  const hasInviteLink = activeInvitation && !inviteLink;
  
  // Set invite link from active invitation when dialog opens
  if (open && activeInvitation && !inviteLink) {
    setInviteLink(`${window.location.origin}/invite/${activeInvitation.token}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[450px] bg-white dark:bg-[#1D1D1D] border-border dark:border-[#333433]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Share</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Invite collaborators to work on this project together
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-3">
          {/* Migration Error Alert */}
          {showMigrationError && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                Database Setup Required
              </h3>
              <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-3">
                The invitation tables haven't been created yet. Please run:
              </p>
              <code className="block bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-200 px-3 py-2 rounded text-xs font-mono">
                supabase db push
              </code>
            </div>
          )}

          {/* Email Invite Section - Only for project owners */}
          {isProjectOwner ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Invite by email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSendInvite();
                  }
                }}
                className="flex-1 bg-background dark:bg-[#0E100F]"
              />
              <Button
                onClick={handleSendInvite}
                disabled={!email.trim() || sendEmailInviteMutation.isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Invite
              </Button>
            </div>

            {/* Collaborators List */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">People with access</h3>
              
              {/* Owner */}
              {collaboratorsData?.owner && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                    {collaboratorsData.owner.full_name?.charAt(0).toUpperCase() || 'O'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {collaboratorsData.owner.full_name || 'Owner'}
                      </span>
                      <span className="text-xs text-muted-foreground">(Owner)</span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate block">
                      {collaboratorsData.owner.email}
                    </span>
                  </div>
                </div>
              )}

              {/* Collaborators */}
              {collaboratorsData?.collaborators?.map((collab: any) => {
                const profile = collab.profiles;
                return (
                  <div key={collab.id} className="flex items-center gap-2 py-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-500 text-white text-sm font-medium">
                      {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground truncate">
                          {profile?.full_name || 'User'}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">({collab.access_level})</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Show count if there are collaborators */}
              {collaboratorsData && collaboratorsData.collaborators.length > 0 && (
                <p className="text-xs text-muted-foreground pt-1">
                  {collaboratorsData.collaborators.length} collaborator{collaboratorsData.collaborators.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-900 dark:text-yellow-200">
                Only the project owner can invite collaborators.
              </p>
            </div>
          )}

          {/* Project Access Section */}
          <div className="space-y-3 border-t border-border dark:border-[#333433] pt-4">
            <h3 className="text-sm font-medium">Project access</h3>
            
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">Invitation access level</span>
                  <span className="text-xs text-muted-foreground">
                    Choose who can access via invite link
                  </span>
                </div>
              </div>
              <Select 
                value={accessLevel} 
                open={selectOpen}
                onOpenChange={setSelectOpen}
                onValueChange={(value: any) => {
                // Close dropdown immediately
                setSelectOpen(false);
                
                setPreviousAccessLevel(accessLevel);
                setAccessLevel(value);
                
                // Dismiss previous visibility toast if exists
                if (visibilityToastId.current !== null) {
                  toast.dismiss(visibilityToastId.current);
                }
                
                // Show visibility notification
                const visibilityMessages = {
                  public: "Your project is now public. Anyone with the invite link can access it.",
                  workspace: "Your project is now workspace-only. Only users in the same workspace can access it.",
                  personal: "Your project is now personal. Only you can access this project.",
                  business: "Your project is now business-only. Only users in your organization can access it."
                };
                
                // Store the toast ID so we can dismiss it later
                visibilityToastId.current = toast.success("Visibility updated", {
                  description: visibilityMessages[value as keyof typeof visibilityMessages],
                  duration: 4000,
                });
                
                // Persist visibility to database
                api.projects.updateVisibility.mutate(
                  { projectId, visibility: value },
                  {
                    onError: (error) => {
                      console.error('Failed to update visibility:', error);
                      setAccessLevel(previousAccessLevel || 'public');
                      toast.error('Failed to update visibility');
                    }
                  }
                );
              }}>
                <SelectTrigger className="w-[140px] bg-background dark:bg-[#0E100F]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3" />
                      <span>Public</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="workspace">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">👥</span>
                      <span>Workspace</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="personal">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">👤</span>
                      <span>Personal</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="business">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">💼</span>
                      <span>Business</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Create/Share Invite Link or GitHub Repository Link */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">
                    {isGitHubProject ? "Share repository link" : (inviteLink || hasInviteLink ? "Share invite link" : "Create invite link")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isGitHubProject 
                      ? "Share this GitHub repository with others"
                      : (inviteLink || hasInviteLink) 
                        ? `Anyone with this link can ${accessLevel === "business" ? "edit" : "view"} the project`
                        : "Generate a shareable link for this project"
                    }
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isGitHubProject || inviteLink || hasInviteLink ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="h-9"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        "Copy"
                      )}
                    </Button>
                    {!isGitHubProject && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveLink}
                        className="h-9"
                      >
                        Remove
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateInviteLink}
                    disabled={createInviteLinkMutation.isLoading}
                    className="h-9"
                  >
                    Create
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Upgrade Section */}
          <div className="border-t border-border dark:border-[#333433] pt-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium">Upgrade to Pro</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Permission control & more
                </p>
              </div>
              <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-600 text-white">
                <span className="text-xs">👑</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
