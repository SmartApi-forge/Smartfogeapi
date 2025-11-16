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
import { Globe, Pencil, Lock, ChevronRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface PublishDialogProps {
  children: React.ReactNode;
  projectId: string;
  projectName: string;
}

type DialogView = "main" | "visibility" | "domain";

export function PublishDialog({
  children,
  projectId,
  projectName,
}: PublishDialogProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DialogView>("main");
  const [visibility, setVisibility] = useState<"public" | "password">("public");
  const [customDomain, setCustomDomain] = useState("");
  const [password, setPassword] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    
    try {
      // TODO: Integrate with Vercel API
      // 1. Connect to user's Vercel account (OAuth)
      // 2. Deploy project to Vercel
      // 3. Set custom domain if provided
      // 4. Set visibility/password protection
      
      toast.success("Publishing to Vercel...", {
        description: "Your project is being deployed",
      });
      
      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Published successfully!", {
        description: "Your project is now live on Vercel",
      });
      
      setOpen(false);
    } catch (error) {
      toast.error("Failed to publish", {
        description: "Please try again or check your Vercel connection",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleVisibilitySave = () => {
    toast.success("Visibility updated");
    setView("main");
  };

  const handleDomainSave = () => {
    if (customDomain.trim()) {
      toast.success("Custom domain saved");
      setView("main");
    }
  };

  const renderMainView = () => (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-semibold">Publish to the Web</DialogTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Push your SmartAPI Forge project live on Vercel. Once deployed, highlight it in the community as a template others can build from.
        </p>
      </DialogHeader>

      <div className="space-y-3 mt-6">
        {/* Customize Domain */}
        <button
          onClick={() => setView("domain")}
          className="w-full flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors border border-border"
        >
          <div className="flex items-center gap-3">
            <Pencil className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Customize Domain</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Visibility */}
        <button
          onClick={() => setView("visibility")}
          className="w-full flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors border border-border"
        >
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Visibility</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground capitalize">{visibility}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </div>

      {/* Publish Button */}
      <Button
        onClick={handlePublish}
        disabled={isPublishing}
        className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white h-11 text-base font-medium"
      >
        {isPublishing ? "Publishing..." : "Publish to Production"}
      </Button>
    </>
  );

  const renderVisibilityView = () => (
    <>
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setView("main")}
          className="p-1 hover:bg-muted/50 rounded-md transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <DialogTitle className="text-xl font-semibold">Visibility</DialogTitle>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Visibility</label>
        
        <Select
          value={visibility}
          onValueChange={(value: "public" | "password") => {
            setVisibility(value);
          }}
        >
          <SelectTrigger className="w-full h-11 bg-background border-border">
            <div className="flex items-center gap-2">
              {visibility === "public" ? (
                <Globe className="h-5 w-5" />
              ) : (
                <Lock className="h-5 w-5" />
              )}
              <span>{visibility === "public" ? "Public" : "Password Protected"}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">
              <div className="flex items-start gap-2 py-0.5">
                <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Public</div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    Anyone with the URL can view your app
                  </div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="password">
              <div className="flex items-start gap-2 py-0.5">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Password Protected</div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    Anyone with the password can view your app
                  </div>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {visibility === "password" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="h-11"
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          onClick={() => setView("main")}
          className="flex-1 h-11 border-2"
        >
          Cancel
        </Button>
        <Button
          onClick={handleVisibilitySave}
          className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white"
        >
          Save
        </Button>
      </div>
    </>
  );

  const renderDomainView = () => (
    <>
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setView("main")}
          className="p-1 hover:bg-muted/50 rounded-md transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <DialogTitle className="text-xl font-semibold">Add a Custom Domain</DialogTitle>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Assign a custom vercel.app subdomain to make your project more memorable.
      </p>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="your-domain"
            className="flex-1 h-11"
          />
          <span className="text-sm text-muted-foreground">.vercel.app</span>
        </div>
      </div>

      {/* Add Domain Button */}
      <Button
        onClick={handleDomainSave}
        disabled={!customDomain.trim()}
        className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white h-11"
      >
        Add Domain
      </Button>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[540px] bg-white dark:bg-[#1D1D1D] border-border dark:border-[#333433]">
        {view === "main" && renderMainView()}
        {view === "visibility" && renderVisibilityView()}
        {view === "domain" && renderDomainView()}
      </DialogContent>
    </Dialog>
  );
}
