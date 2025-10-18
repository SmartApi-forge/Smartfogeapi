import { fragmentOperations } from "../../../lib/supabase-server";
import type {
  CreateFragmentInput,
  UpdateFragmentInput,
  GetFragmentInput,
  GetFragmentsByMessageInput,
  GetFragmentsInput,
  UpdateFragmentFilesInput,
  Fragment,
} from "./types";

export class FragmentService {
  /**
   * Create a new fragment
   */
  static async create(input: CreateFragmentInput): Promise<Fragment> {
    try {
      const fragment = await fragmentOperations.create(input);
      return fragment;
    } catch (error) {
      console.error("Error creating fragment:", error);
      throw new Error("Failed to create fragment");
    }
  }

  /**
   * Bulk create fragments with transaction support
   */
  static async bulkCreate(inputs: CreateFragmentInput[]): Promise<Fragment[]> {
    try {
      const fragments = await fragmentOperations.bulkCreate(inputs);
      return fragments;
    } catch (error) {
      console.error("Error bulk creating fragments:", error);
      throw new Error("Failed to bulk create fragments");
    }
  }

  /**
   * Get a fragment by ID
   */
  static async getById(input: GetFragmentInput): Promise<Fragment> {
    try {
      const fragment = await fragmentOperations.getById(input.id);
      return fragment;
    } catch (error) {
      console.error("Error getting fragment:", error);
      throw new Error("Fragment not found");
    }
  }

  /**
   * Get fragments by message ID with database-level pagination
   */
  static async getByMessageId(
    input: GetFragmentsByMessageInput,
  ): Promise<Fragment[]> {
    try {
      // Validate input parameters
      const limit = Math.min(Math.max(input.limit || 20, 1), 100);
      const offset = Math.max(input.offset || 0, 0);

      // Use database-level pagination
      const fragments = await fragmentOperations.getByMessageId(
        input.message_id,
        {
          limit,
          offset,
        },
      );

      return fragments;
    } catch (error) {
      console.error("Error getting fragments by message ID:", error);
      throw new Error("Failed to get fragments");
    }
  }

  /**
   * Get all fragments with optional filtering and database-level pagination
   */
  static async getAll(input: GetFragmentsInput): Promise<Fragment[]> {
    try {
      // Validate input parameters
      const limit = Math.min(Math.max(input.limit || 20, 1), 100);
      const offset = Math.max(input.offset || 0, 0);

      if (input.message_id) {
        // Get fragments for specific message with database-level pagination
        return await fragmentOperations.getByMessageId(input.message_id, {
          limit,
          offset,
        });
      } else {
        // Get all fragments with database-level pagination
        return await fragmentOperations.getAll({
          limit,
          offset,
        });
      }
    } catch (error) {
      console.error("Error getting fragments:", error);
      throw new Error("Failed to get fragments");
    }
  }

  /**
   * Search fragments by title with database-level filtering and pagination
   */
  static async searchByTitle(params: {
    title: string;
    limit?: number;
    offset?: number;
  }): Promise<Fragment[]> {
    try {
      // Validate and sanitize input parameters
      if (!params.title || typeof params.title !== "string") {
        throw new Error("Title parameter is required and must be a string");
      }

      const limit = Math.min(Math.max(params.limit || 10, 1), 100);
      const offset = Math.max(params.offset || 0, 0);

      // Use database-level search with pagination
      const fragments = await fragmentOperations.searchByContent(params.title, {
        limit,
        offset,
      });

      return fragments;
    } catch (error) {
      console.error("Error searching fragments by title:", error);
      throw new Error("Failed to search fragments");
    }
  }

  /**
   * Update a fragment
   */
  static async update(input: UpdateFragmentInput): Promise<Fragment> {
    try {
      const { id, ...updateData } = input;
      const fragment = await fragmentOperations.update(id, updateData);
      return fragment;
    } catch (error) {
      console.error("Error updating fragment:", error);
      throw new Error("Failed to update fragment");
    }
  }

  /**
   * Update fragment files specifically
   */
  static async updateFiles(input: UpdateFragmentFilesInput): Promise<Fragment> {
    try {
      const fragment = await fragmentOperations.update(input.id, {
        files: input.files,
      });
      return fragment;
    } catch (error) {
      console.error("Error updating fragment files:", error);
      throw new Error("Failed to update fragment files");
    }
  }

  /**
   * Delete a fragment
   */
  static async delete(input: GetFragmentInput): Promise<void> {
    try {
      await fragmentOperations.delete(input.id);
    } catch (error) {
      console.error("Error deleting fragment:", error);
      throw new Error("Failed to delete fragment");
    }
  }

  /**
   * Get fragment count for a message
   */
  static async getCountByMessage(messageId: string): Promise<number> {
    try {
      // Use database-level count for efficiency
      const count = await fragmentOperations.getCountByMessageId(messageId);
      return count;
    } catch (error) {
      console.error("Error getting fragment count:", error);
      throw new Error("Failed to get fragment count");
    }
  }

  /**
   * Get the latest fragment for a message
   */
  static async getLatestByMessage(messageId: string): Promise<Fragment | null> {
    try {
      // Get only the first fragment (latest) with limit 1 for efficiency
      const fragments = await fragmentOperations.getByMessageId(messageId, {
        limit: 1,
      });
      return fragments.length > 0 ? fragments[0] : null; // Already sorted by created_at desc
    } catch (error) {
      console.error("Error getting latest fragment:", error);
      throw new Error("Failed to get latest fragment");
    }
  }

  /**
   * Check if a fragment exists
   */
  static async exists(fragmentId: string): Promise<boolean> {
    try {
      await fragmentOperations.getById(fragmentId);
      return true;
    } catch (error) {
      return false;
    }
  }
}
