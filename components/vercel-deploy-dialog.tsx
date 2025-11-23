"use client";

import { useState, useEffect, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, Trash2, Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface VercelDeployDialogProps {
  children: React.ReactNode;
  projectId: string;
  projectName: string;
}

type DeploymentState =
  | "idle"
  | "initializing"
  | "building"
  | "deploying"
  | "ready"
  | "error";

export function VercelDeployDialog({
  children,
  projectId,
  projectName,
}: VercelDeployDialogProps) {
  const [open, setOpen] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);
  const [state, setState] = useState<DeploymentState>("idle");
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [claimUrl, setClaimUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Check for existing deployment when dialog opens
  useEffect(() => {
    if (open && state === "idle") {
      checkExistingDeployment();
    }
    // Reset iframe state when dialog opens
    if (open) {
      setIframeError(false);
      setIframeLoading(true);
    }
    // Reset to idle when popover closes (unless building)
    if (!open && state !== "building" && state !== "deploying") {
      setState("idle");
    }
  }, [open]);

  const checkExistingDeployment = async () => {
    try {
      const { data: deployment } = await supabase
        .from('deployments')
        .select('vercel_deployment_id, deployment_url, status, transfer_code')
        .eq('project_id', projectId)
        .in('status', ['ready', 'building']) // Only get active deployments
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (deployment) {
        // Verify deployment still exists on Vercel
        try {
          const statusResponse = await fetch(
            `/api/deploy/vercel/${deployment.vercel_deployment_id}/status`,
            { credentials: 'include' }
          );
          
          if (!statusResponse.ok) {
            // Deployment doesn't exist on Vercel anymore, delete from DB
            await supabase
              .from('deployments')
              .delete()
              .eq('vercel_deployment_id', deployment.vercel_deployment_id);
            
            // Don't show this deployment
            return;
          }
        } catch (err) {
          console.error('Failed to verify deployment:', err);
          // If verification fails, don't show the deployment
          return;
        }

        setDeploymentId(deployment.vercel_deployment_id);
        setDeploymentUrl(deployment.deployment_url);
        
        if (deployment.transfer_code) {
          setClaimUrl(`https://vercel.com/claim?code=${deployment.transfer_code}`);
        }

        // Set state based on deployment status
        if (deployment.status === 'ready') {
          setState('ready');
          // Reset iframe states for fresh load
          setIframeError(false);
          setIframeLoading(true);
        } else if (deployment.status === 'building') {
          setState('building');
          // Resume streaming if still building
        }
      }
    } catch (err) {
      console.error('Failed to check existing deployment:', err);
    }
  };

  // Real-time log streaming with SSE
  useEffect(() => {
    if (deploymentId && (state === "building" || state === "deploying")) {
      console.log(`Starting real-time log stream for deployment ${deploymentId}`);
      
      // Create EventSource for real-time streaming
      const eventSource = new EventSource(
        `/api/deploy/vercel/${deploymentId}/stream`
      );
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.done) {
            console.log('Stream completed');
            eventSource.close();
            return;
          }
          
          if (data.error) {
            console.error('Stream error:', data.error);
            setError(data.error);
            setState("error");
            eventSource.close();
            return;
          }
          
          if (data.log) {
            // Append new log in real-time
            setLogs((prev) => [...prev, data.log]);
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource error:', err);
        eventSource.close();
      };

      // Check deployment status separately (less frequently)
      statusCheckIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(
            `/api/deploy/vercel/${deploymentId}/status`,
            {
              credentials: "include",
            }
          );
          const data = await response.json();

          if (data.status === "READY") {
            setState("ready");
            if (data.url) {
              setDeploymentUrl(data.url);
            }
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
            }
            if (statusCheckIntervalRef.current) {
              clearInterval(statusCheckIntervalRef.current);
            }
          } else if (data.status === "ERROR") {
            setState("error");
            setError(data.error || "Deployment failed");
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
            }
            if (statusCheckIntervalRef.current) {
              clearInterval(statusCheckIntervalRef.current);
            }
          }
        } catch (err) {
          console.error("Failed to fetch deployment status:", err);
        }
      }, 5000); // Check status every 5 seconds

      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        if (statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current);
        }
      };
    }
  }, [deploymentId, state]);

  const handlePublish = async () => {
    setState("initializing");
    setLogs([]); // Start with empty logs - Vercel logs will populate
    setError(null);

    try {
      // Check if user is authenticated
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        setState("error");
        setError("Please sign in to deploy projects");
        toast.error("Authentication required", {
          description: "Please sign in to deploy your project",
        });
        return;
      }

      // Call deployment API
      const response = await fetch("/api/deploy/vercel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.details || errorData.error || "Deployment failed";
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        setDeploymentId(data.deploymentId);
        setDeploymentUrl(data.url);
        setClaimUrl(data.claimUrl);
        setState("building");
        
        // Show toast if resuming existing deployment
        if (data.isExisting) {
          toast.info("Resuming deployment", {
            description: "Continuing existing deployment in progress",
          });
        }
        
        // No hardcoded messages - logs will come from Vercel
      } else {
        throw new Error(data.error || "Deployment failed");
      }
    } catch (err: any) {
      console.error("Publish error:", err);
      setState("error");
      setError(err.message || "Failed to deploy");
      toast.error("Deployment failed", {
        description: err.message,
      });
    }
  };

  const handleUnpublish = async () => {
    if (!deploymentId) return;

    try {
      const response = await fetch(`/api/deploy/vercel/${deploymentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to unpublish site");
      }

      // Delete from Supabase to prevent showing stale data
      await supabase
        .from('deployments')
        .delete()
        .eq('project_id', projectId);

      // Reset to idle state immediately in frontend
      setState("idle");
      setDeploymentId(null);
      setDeploymentUrl(null);
      setClaimUrl(null);
      setLogs([]);
      setError(null);
      setIframeError(false);
      setIframeLoading(true);
      setShowUnpublishDialog(false);
      
      // Close the popover to prevent showing 404 error
      setOpen(false);

      toast.success("Site unpublished", {
        description: "Your site has been removed from Vercel",
      });
    } catch (err: any) {
      console.error("Unpublish error:", err);
      setShowUnpublishDialog(false);
      toast.error("Failed to unpublish", {
        description: err.message,
      });
    }
  };

  const renderContent = () => {
    // Initial state - Show simple publish dialog
    if (state === "idle") {
      return (
        <div className="w-[420px] bg-popover">
          <div className="p-4 space-y-3">
            <div className="space-y-1">
              <h3 className="font-medium text-sm">Publish to Web</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Deploy your site to Vercel and make it live.
              </p>
            </div>
            <Button
              onClick={handlePublish}
              className="w-full gap-2 h-9"
            >
              <svg
                viewBox="0 0 76 65"
                fill="currentColor"
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
              Publish Website
            </Button>
          </div>
        </div>
      );
    }

    // Initializing state
    if (state === "initializing") {
      return (
        <div className="w-[420px] h-[240px] bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 rounded-md">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-3" />
          <p className="text-xs font-medium text-muted-foreground">Initializing deployment...</p>
        </div>
      );
    }

    // Building state - Show logs
    if (state === "building" || state === "deploying") {
      return (
        <div className="w-[420px] bg-[#0a0a0a] text-white rounded-md overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
            <span className="text-xs font-medium">Building project...</span>
          </div>

          {/* Logs Container */}
          <div className="p-3 h-[220px] overflow-y-auto font-mono text-[10px] leading-relaxed text-gray-300 scrollbar-hide">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Waiting for build logs...</span>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap break-words border-l-2 border-transparent hover:border-blue-500/50 pl-2 py-0.5">
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
          
          <div className="px-3 py-2 bg-white/5 border-t border-white/10 flex items-center justify-between text-[9px] text-gray-400">
            <span>{logs.length} log entries</span>
            {deploymentUrl && (
              <span className="flex items-center gap-1.5">
                Target: <span className="text-blue-400">{deploymentUrl}</span>
              </span>
            )}
          </div>
        </div>
      );
    }

    // Ready state - Show preview
    if (state === "ready" && deploymentUrl) {
      return (
        <div className="w-[420px] bg-popover rounded-md overflow-hidden shadow-xl">
          {/* Preview iframe */}
          <div className="relative w-full h-[200px] bg-muted px-2 pt-2 overflow-hidden">
            {!iframeError ? (
              <>
                {iframeLoading && (
                  <div className="absolute inset-2 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 rounded-t-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <iframe
                  src={deploymentUrl}
                  className="w-full h-full border-0 rounded-t-lg bg-white scrollbar-hide"
                  title="Deployment Preview"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  scrolling="no"
                  onLoad={() => setIframeLoading(false)}
                  onError={() => {
                    setIframeError(true);
                    setIframeLoading(false);
                  }}
                  style={{ overflow: 'hidden' }}
                />
                {/* Transparent overlay to capture clicks and close dialog */}
                <div 
                  className="absolute inset-2 rounded-t-lg cursor-pointer z-5"
                  onClick={() => setOpen(false)}
                  title="Click to close preview"
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-muted/50 rounded-t-lg text-center">
                <div className="text-3xl mb-2">✨</div>
                <p className="text-xs font-medium">Live on Vercel</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => window.open(deploymentUrl, '_blank')}
                  className="h-auto px-0 text-[10px]"
                >
                  Visit Site <ExternalLink className="h-2.5 w-2.5 ml-1" />
                </Button>
              </div>
            )}
          </div>

          {/* Content below iframe - seamlessly blended */}
          <div className="bg-muted px-2 pb-2 space-y-2">
            {/* URL Row - no card wrapper */}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-background/60 rounded-b-lg">
              <a
                href={deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium hover:underline truncate flex-1 min-w-0"
              >
                {deploymentUrl.replace("https://", "")}
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:bg-transparent group flex-shrink-0"
                onClick={() => setShowUnpublishDialog(true)}
                title="Unpublish site"
              >
                <Trash2 className="h-3.5 w-3.5 transition-colors group-hover:text-destructive" />
              </Button>
            </div>

            {/* Actions Row */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-muted-foreground">
                Last updated just now
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] px-2.5"
                  onClick={() => toast.info("Custom domain coming soon")}
                >
                  <Globe className="h-3 w-3 mr-1" />
                  Custom Domain
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-[10px] px-2.5"
                  onClick={() => {
                    setState("idle");
                    setDeploymentUrl(null);
                    setDeploymentId(null);
                    setLogs([]);
                    handlePublish();
                  }}
                >
                  <svg
                    viewBox="0 0 76 65"
                    fill="currentColor"
                    className="h-2.5 w-2.5 mr-1"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                  </svg>
                  Republish
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Error state
    if (state === "error") {
      return (
        <div className="w-[420px] p-5 bg-popover">
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600">
              <span className="text-lg font-bold">✕</span>
            </div>
            <div className="space-y-0.5">
              <h3 className="font-semibold text-sm">Deployment Failed</h3>
              <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">{error}</p>
            </div>
            <div className="pt-3 w-full max-w-[180px]">
              <Button
                onClick={() => {
                  setState("idle");
                  setError(null);
                  setLogs([]);
                }}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          className="p-0 border-border w-[420px] [&>div]:overflow-y-auto [&>div]:scrollbar-hide [&>div]:max-h-[80vh]"
          align="end"
          alignOffset={-380}
          sideOffset={8}
          collisionPadding={20}
          onInteractOutside={() => {
            // Allow closing when clicking outside
            setOpen(false);
          }}
        >
          {renderContent()}
        </PopoverContent>
      </Popover>

      {/* Unpublish Confirmation Dialog */}
      <AlertDialog open={showUnpublishDialog} onOpenChange={setShowUnpublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish Site</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unpublish this site? This will remove the site from the
              web and the site URL will no longer be accessible. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnpublish}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
