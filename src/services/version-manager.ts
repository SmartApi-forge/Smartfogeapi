import { createClient } from "@supabase/supabase-js";
import type {
  Version,
  CreateVersionInput,
  UpdateVersionInput,
  VersionComparison,
  FileDiff,
} from "../modules/versions/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Version Manager Service
 * Handles all version-related database operations
 * Stores FULL file snapshots, not diffs
 */
export class VersionManager {
  /**
   * Create a new version
   */
  static async createVersion(input: CreateVersionInput): Promise<Version> {
    const { data, error } = await supabase
      .from("versions")
      .insert({
        project_id: input.project_id,
        version_number: input.version_number,
        name: input.name,
        description: input.description || null,
        files: input.files,
        command_type: input.command_type || null,
        prompt: input.prompt,
        parent_version_id: input.parent_version_id || null,
        status: input.status || "generating",
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating version:", error);
      throw new Error(`Failed to create version: ${error.message}`);
    }

    return data as Version;
  }

  /**
   * Get a specific version by ID
   */
  static async getVersion(id: string): Promise<Version> {
    const { data, error } = await supabase
      .from("versions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching version:", error);
      throw new Error(`Failed to fetch version: ${error.message}`);
    }

    if (!data) {
      throw new Error("Version not found");
    }

    return data as Version;
  }

  /**
   * Get all versions for a project
   */
  static async listVersions(
    projectId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Version[]> {
    const { data, error } = await supabase
      .from("versions")
      .select("*")
      .eq("project_id", projectId)
      .order("version_number", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error listing versions:", error);
      throw new Error(`Failed to list versions: ${error.message}`);
    }

    return (data || []) as Version[];
  }

  /**
   * Get the latest version for a project
   */
  static async getLatestVersion(projectId: string): Promise<Version | null> {
    const { data, error } = await supabase
      .from("versions")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "complete")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching latest version:", error);
      throw new Error(`Failed to fetch latest version: ${error.message}`);
    }

    return data as Version | null;
  }

  /**
   * Get the next version number for a project
   */
  static async getNextVersionNumber(projectId: string): Promise<number> {
    const { data, error } = await supabase
      .from("versions")
      .select("version_number")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching version number:", error);
      return 1; // Default to version 1
    }

    if (!data) {
      return 1;
    }

    return (data.version_number || 0) + 1;
  }

  /**
   * Update a version
   */
  static async updateVersion(
    id: string,
    updates: UpdateVersionInput,
  ): Promise<Version> {
    const { data, error } = await supabase
      .from("versions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating version:", error);
      throw new Error(`Failed to update version: ${error.message}`);
    }

    return data as Version;
  }

  /**
   * Delete a version
   */
  static async deleteVersion(id: string): Promise<void> {
    const { error } = await supabase.from("versions").delete().eq("id", id);

    if (error) {
      console.error("Error deleting version:", error);
      throw new Error(`Failed to delete version: ${error.message}`);
    }
  }

  /**
   * Compare two versions and generate diff
   * For UI display only - actual storage uses full snapshots
   */
  static compareVersions(
    version1: Version,
    version2: Version,
  ): VersionComparison {
    const diffs: FileDiff[] = [];
    const files1 = version1.files || {};
    const files2 = version2.files || {};

    const allFiles = new Set([...Object.keys(files1), ...Object.keys(files2)]);

    let filesAdded = 0;
    let filesModified = 0;
    let filesDeleted = 0;
    let filesUnchanged = 0;

    for (const filename of allFiles) {
      const content1 = files1[filename];
      const content2 = files2[filename];

      if (!content1 && content2) {
        // File was added
        diffs.push({
          filename,
          status: "added",
          newContent: content2,
        });
        filesAdded++;
      } else if (content1 && !content2) {
        // File was deleted
        diffs.push({
          filename,
          status: "deleted",
          oldContent: content1,
        });
        filesDeleted++;
      } else if (content1 !== content2) {
        // File was modified
        diffs.push({
          filename,
          status: "modified",
          oldContent: content1,
          newContent: content2,
        });
        filesModified++;
      } else {
        // File unchanged
        diffs.push({
          filename,
          status: "unchanged",
          oldContent: content1,
          newContent: content2,
        });
        filesUnchanged++;
      }
    }

    return {
      version1,
      version2,
      diffs,
      summary: {
        filesAdded,
        filesModified,
        filesDeleted,
        filesUnchanged,
      },
    };
  }

  /**
   * Get version count for a project
   */
  static async getVersionCount(projectId: string): Promise<number> {
    const { count, error } = await supabase
      .from("versions")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);

    if (error) {
      console.error("Error counting versions:", error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get version history chain (follow parent_version_id)
   */
  static async getVersionHistory(versionId: string): Promise<Version[]> {
    const history: Version[] = [];
    let currentId: string | null = versionId;

    while (currentId) {
      const version = await this.getVersion(currentId);
      history.push(version);
      currentId = version.parent_version_id;
    }

    return history.reverse(); // Return oldest to newest
  }

  /**
   * Mark version as complete
   */
  static async markComplete(id: string): Promise<Version> {
    return this.updateVersion(id, { status: "complete" });
  }

  /**
   * Mark version as failed
   */
  static async markFailed(id: string): Promise<Version> {
    return this.updateVersion(id, { status: "failed" });
  }
}
