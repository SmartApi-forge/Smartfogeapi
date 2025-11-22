"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/trpc-client";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;
  const [isDialogOpen, setIsDialogOpen] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Store the current URL to redirect back after login
        const currentUrl = window.location.pathname;
        router.push(`/?auth=login&redirect=${encodeURIComponent(currentUrl)}`);
        return;
      }
      
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, [router]);

  // Fetch invitation details
  const {
    data: invitation,
    isLoading,
    error,
  } = api.invitations.getInvitationByToken.useQuery(
    { token },
    { 
      enabled: !!token && !isCheckingAuth,
      retry: 1,
      onError: (err) => {
        console.error('[InvitePage] Query error:', err);
        console.error('[InvitePage] Error details:', JSON.stringify(err, null, 2));
      },
      onSuccess: (data) => {
        console.log('[InvitePage] Successfully fetched invitation:', data?.id);
      }
    }
  );

  // Log state changes
  useEffect(() => {
    console.log('[InvitePage] State:', { token, isCheckingAuth, isLoading, hasError: !!error, hasInvitation: !!invitation });
  }, [token, isCheckingAuth, isLoading, error, invitation]);

  // Mutations
  const acceptMutation = api.invitations.acceptInvitation.useMutation({
    onSuccess: (data) => {
      toast.success("Invitation accepted!");
      setIsDialogOpen(false);
      // Redirect to the project
      setTimeout(() => {
        router.push(`/projects/${data.projectId}`);
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to accept invitation");
    },
  });

  const declineMutation = api.invitations.declineInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation declined");
      setIsDialogOpen(false);
      // Redirect to home
      setTimeout(() => {
        router.push("/");
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to decline invitation");
    },
  });

  const handleAccept = () => {
    acceptMutation.mutate({ token });
  };

  const handleDecline = () => {
    declineMutation.mutate({ token });
  };

  // Close dialog handler
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    router.push("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#1D1D1D] border-border dark:border-[#333433]">
          {isCheckingAuth || isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20">
                <span className="text-3xl">❌</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Invalid Invitation</h2>
              <p className="text-muted-foreground text-center mb-6 px-4">
                {error.message || "This invitation link is invalid or has expired."}
              </p>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-muted-foreground mb-4 px-4 text-center">
                  Token: {token}
                </p>
              )}
              <Button onClick={handleDialogClose} variant="outline">
                Go to Home
              </Button>
            </div>
          ) : invitation ? (
            <>
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-pink-500">
                  <span className="text-3xl">❤️</span>
                </div>
              </div>

              <DialogHeader className="text-center">
                <DialogTitle className="text-3xl font-bold mb-2">
                  You've been invited!
                </DialogTitle>
                <p className="text-base text-muted-foreground">
                  You've been invited to collaborate on "
                  <span className="font-semibold text-foreground">
                    {invitation.projects?.name || "a project"}
                  </span>
                  " by {invitation.profiles?.full_name || "a team member"}
                </p>
              </DialogHeader>

              <div className="mt-8 space-y-3">
                <Button
                  onClick={handleAccept}
                  disabled={acceptMutation.isLoading || declineMutation.isLoading}
                  className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 hover:border-gray-300 transition-all text-base font-medium"
                >
                  {acceptMutation.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">✓</span>
                      Accept invitation
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleDecline}
                  disabled={acceptMutation.isLoading || declineMutation.isLoading}
                  variant="ghost"
                  className="w-full h-12 text-base font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {declineMutation.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Declining...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">✕</span>
                      Decline invitation
                    </>
                  )}
                </Button>
              </div>

              {invitation.projects?.description && (
                <div className="mt-6 pt-6 border-t border-border dark:border-[#333433]">
                  <h3 className="text-sm font-medium mb-2">Project Description</h3>
                  <p className="text-sm text-muted-foreground">
                    {invitation.projects.description}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
