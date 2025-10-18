"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { VersionCard } from "./version-card";
import { Loader2 } from "lucide-react";
import type { Version } from "../src/modules/versions/types";

interface VersionListProps {
  versions: Version[];
  selectedVersionId: string | null;
  onVersionSelect: (versionId: string) => void;
  isLoading?: boolean;
}

/**
 * Version List Component
 * Displays all versions for a project with version cards
 * Shows in chronological order (oldest to newest)
 */
export function VersionList({
  versions,
  selectedVersionId,
  onVersionSelect,
  isLoading = false,
}: VersionListProps) {
  // Sort versions by version number (ascending)
  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => a.version_number - b.version_number);
  }, [versions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Loader2 className="size-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading versions...</p>
        </div>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            No versions yet. Start a conversation to create the first version!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      <AnimatePresence mode="popLayout">
        {sortedVersions.map((version, index) => (
          <VersionCard
            key={version.id}
            version={version}
            isActive={version.id === selectedVersionId}
            onClick={() => onVersionSelect(version.id)}
            previousVersion={index > 0 ? sortedVersions[index - 1] : undefined}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
