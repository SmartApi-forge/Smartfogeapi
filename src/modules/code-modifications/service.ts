import { createClient } from "@supabase/supabase-js";
import {
  CodeModification,
  CreateCodeModification,
  UpdateCodeModification,
  GetCodeModificationsByProject,
  ApplyMultipleModifications,
} from "./types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export class CodeModificationService {
  /**
   * Create a new code modification
   */
  static async create(
    input: CreateCodeModification,
  ): Promise<CodeModification> {
    const { data, error } = await supabase
      .from("code_modifications")
      .insert({
        project_id: input.project_id,
        message_id: input.message_id,
        file_path: input.file_path,
        old_content: input.old_content || null,
        new_content: input.new_content,
        line_start: input.line_start || null,
        line_end: input.line_end || null,
        modification_type: input.modification_type,
        reason: input.reason || null,
        applied: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating code modification:", error);
      throw new Error(`Failed to create code modification: ${error.message}`);
    }

    return data as CodeModification;
  }

  /**
   * Get code modification by ID
   */
  static async getById(id: string): Promise<CodeModification | null> {
    const { data, error } = await supabase
      .from("code_modifications")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      console.error("Error fetching code modification:", error);
      throw new Error(`Failed to fetch code modification: ${error.message}`);
    }

    return data as CodeModification;
  }

  /**
   * Get code modifications by project
   */
  static async getByProject(
    params: GetCodeModificationsByProject,
  ): Promise<CodeModification[]> {
    let query = supabase
      .from("code_modifications")
      .select("*")
      .eq("project_id", params.project_id)
      .order("created_at", { ascending: false });

    if (params.applied !== undefined) {
      query = query.eq("applied", params.applied);
    }

    if (params.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching code modifications:", error);
      throw new Error(`Failed to fetch code modifications: ${error.message}`);
    }

    return data as CodeModification[];
  }

  /**
   * Get code modifications by message ID
   */
  static async getByMessage(messageId: string): Promise<CodeModification[]> {
    const { data, error } = await supabase
      .from("code_modifications")
      .select("*")
      .eq("message_id", messageId)
      .order("file_path", { ascending: true });

    if (error) {
      console.error("Error fetching code modifications by message:", error);
      throw new Error(`Failed to fetch code modifications: ${error.message}`);
    }

    return data as CodeModification[];
  }

  /**
   * Update a code modification
   */
  static async update(
    input: UpdateCodeModification,
  ): Promise<CodeModification> {
    const updateData: any = {};

    if (input.applied !== undefined) {
      updateData.applied = input.applied;
    }

    if (input.new_content !== undefined) {
      updateData.new_content = input.new_content;
    }

    const { data, error } = await supabase
      .from("code_modifications")
      .update(updateData)
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating code modification:", error);
      throw new Error(`Failed to update code modification: ${error.message}`);
    }

    return data as CodeModification;
  }

  /**
   * Mark a code modification as applied and update the API fragment
   */
  static async apply(
    id: string,
  ): Promise<{ modification: CodeModification; updated: boolean }> {
    // Get the modification
    const modification = await this.getById(id);
    if (!modification) {
      throw new Error("Code modification not found");
    }

    if (modification.applied) {
      return { modification, updated: false };
    }

    // Update the api_fragments table with the new content
    const { data: fragments, error: fragmentError } = await supabase
      .from("api_fragments")
      .select("*")
      .eq("project_id", modification.project_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fragmentError) {
      console.error("Error fetching API fragment:", fragmentError);
      throw new Error(`Failed to fetch API fragment: ${fragmentError.message}`);
    }

    if (fragments && fragments.length > 0) {
      const fragment = fragments[0];
      let implementationCode: any = {};

      try {
        implementationCode =
          typeof fragment.implementation_code === "string"
            ? JSON.parse(fragment.implementation_code)
            : fragment.implementation_code || {};
      } catch (e) {
        console.error("Error parsing implementation code:", e);
        implementationCode = {};
      }

      // Update the file content
      implementationCode[modification.file_path] = modification.new_content;

      // Save back to database
      const { error: updateError } = await supabase
        .from("api_fragments")
        .update({
          implementation_code: JSON.stringify(implementationCode),
          updated_at: new Date().toISOString(),
        })
        .eq("id", fragment.id);

      if (updateError) {
        console.error("Error updating API fragment:", updateError);
        throw new Error(
          `Failed to update API fragment: ${updateError.message}`,
        );
      }
    }

    // Mark the modification as applied
    const updatedModification = await this.update({ id, applied: true });

    return { modification: updatedModification, updated: true };
  }

  /**
   * Apply multiple code modifications
   */
  static async applyMultiple(
    params: ApplyMultipleModifications,
  ): Promise<CodeModification[]> {
    const results: CodeModification[] = [];

    for (const id of params.modification_ids) {
      const { modification } = await this.apply(id);
      results.push(modification);
    }

    return results;
  }

  /**
   * Delete a code modification (reject it)
   */
  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("code_modifications")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting code modification:", error);
      throw new Error(`Failed to delete code modification: ${error.message}`);
    }
  }

  /**
   * Get unapplied modifications count for a project
   */
  static async getUnappliedCount(projectId: string): Promise<number> {
    const { count, error } = await supabase
      .from("code_modifications")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("applied", false);

    if (error) {
      console.error("Error getting unapplied modifications count:", error);
      throw new Error(`Failed to get count: ${error.message}`);
    }

    return count || 0;
  }
}
