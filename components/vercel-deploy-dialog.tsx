"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/src/trpc/client";

interface VercelDeployDialogProps {
  children: React.ReactNode;
  projectId: string;
  projectName: string;
  projectFiles: Record<string, string>;
}

export function VercelDeployDialog({
  children,
  projectId,
  projectName,
  projectFiles,
}: VercelDeployDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);

  // Check Vercel connection status
  const { data: connectionStatus, refetch: refetchConnection } = trpc.vercel.getConnectionStatus.useQuery(
    undefined,
    { enabled: open }
  );

  // Get latest deployment
  const { data: latestDeployment } = trpc.vercel.getLatestDeployment.useQuery(
    { projectId },
    { enabled: open }
  );

  // Mutations
  const deployMutation = trpc.vercel.deployProject.useMutation();

  useEffect(() => {
    if (latestDeployment?.deployment_url) {
      setDeploymentUrl(latestDeployment.deployment_url);
    }
  }, [latestDeployment]);

  const handleConnect = () => {
    // Redirect to Vercel OAuth flow
    window.location.href = '/api/vercel/connect';
  };

  const handleDeploy = async () => {
    if (!connectionStatus?.connected) {
      toast.error("Please connect Vercel first");
      return;
    }

    setIsDeploying(true);
    
    try {
      const result = await deployMutation.mutateAsync({
        projectId,
        files: projectFiles,
      });

      if (result.success && result.url) {
        setDeploymentUrl(result.url);
        toast.success("Deployed successfully!", {
          description: "Your project is now live on Vercel",
        });
      } else {
        throw new Error(result.error || "Deployment failed");
      }
    } catch (error: any) {
      toast.error("Deployment failed", {
        description: error.message || "Please try again",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const renderContent = () => {
    if (!connectionStatus?.connected) {
      // Not connected - show connect screen
      return (
        <>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Deploy to Vercel</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your Vercel account to deploy your project with one click.
            </p>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-border p-6 space-y-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-black dark:bg-white flex items-center justify-center">
                  <svg
                    viewBox="0 0 76 65"
                    fill="white"
                    className="h-6 w-6 dark:fill-black"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Vercel</h3>
                  <p className="text-sm text-muted-foreground">
                    Deploy instantly to the edge
                  </p>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Automatic HTTPS & SSL certificates</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Global CDN for fast delivery</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Continuous deployment from your account</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              className="w-full bg-black hover:bg-black/90 dark:bg-white dark:hover:bg-white/90 text-white dark:text-black h-11 text-base font-medium"
            >
              <svg
                viewBox="0 0 76 65"
                fill="currentColor"
                className="h-4 w-4 mr-2"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
              Connect Vercel Account
            </Button>
          </div>
        </>
      );
    }

    // Connected - show deploy screen
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Deploy to Vercel</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Deploy <span className="font-medium">{projectName}</span> to your Vercel account.
          </p>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium">Connected to Vercel</span>
            </div>
            {connectionStatus?.teamId && (
              <span className="text-xs text-muted-foreground">Team Account</span>
            )}
          </div>

          {/* Latest Deployment */}
          {deploymentUrl && (
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Latest Deployment</span>
                <a
                  href={deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  View Live Site
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {deploymentUrl}
              </p>
            </div>
          )}

          {/* Deploy Button */}
          <Button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="w-full bg-black hover:bg-black/90 dark:bg-white dark:hover:bg-white/90 text-white dark:text-black h-11 text-base font-medium"
          >
            {isDeploying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 76 65"
                  fill="currentColor"
                  className="h-4 w-4 mr-2"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                </svg>
                {deploymentUrl ? "Redeploy to Vercel" : "Deploy to Vercel"}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Deployment typically takes 1-3 minutes
          </p>
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#1D1D1D] border-border dark:border-[#333433]">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}

