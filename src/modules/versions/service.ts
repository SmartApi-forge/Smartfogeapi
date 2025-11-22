import { TRPCError } from '@trpc/server';
import { VersionManager } from '../../services/version-manager';
import type {
  Version,
  CreateVersionInput,
  UpdateVersionInput,
  GetVersionInput,
  GetVersionsInput,
  GetLatestVersionInput,
  VersionComparison,
} from './types';

/**
 * Version Service
 * Business logic layer for version operations
 */
export class VersionService {
  /**
   * Create a new version
   */
  static async create(input: CreateVersionInput): Promise<Version> {
    try {
      // Get next version number if not provided
      if (!input.version_number) {
        const nextNumber = await VersionManager.getNextVersionNumber(input.project_id);
        input.version_number = nextNumber;
      }

      const version = await VersionManager.createVersion(input);
      
      console.log(`Created version ${version.version_number} for project ${version.project_id}`);
      
      return version;
    } catch (error) {
      console.error('Error in VersionService.create:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create version',
        cause: error,
      });
    }
  }

  /**
   * Get a version by ID
   */
  static async getById(input: GetVersionInput): Promise<Version> {
    try {
      const version = await VersionManager.getVersion(input.id);
      return version;
    } catch (error) {
      console.error('Error in VersionService.getById:', error);
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Version not found',
        cause: error,
      });
    }
  }

  /**
   * Get all versions for a project
   */
  static async getMany(input: GetVersionsInput): Promise<Version[]> {
    try {
      const versions = await VersionManager.listVersions(
        input.projectId,
        input.limit,
        input.offset
      );
      
      return versions;
    } catch (error) {
      console.error('Error in VersionService.getMany:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch versions',
        cause: error,
      });
    }
  }

  /**
   * Get the latest version for a project
   */
  static async getLatest(input: GetLatestVersionInput): Promise<Version | null> {
    try {
      const version = await VersionManager.getLatestVersion(input.projectId);
      return version;
    } catch (error) {
      console.error('Error in VersionService.getLatest:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch latest version',
        cause: error,
      });
    }
  }

  /**
   * Update a version
   */
  static async update(id: string, updates: UpdateVersionInput): Promise<Version> {
    try {
      const version = await VersionManager.updateVersion(id, updates);
      
      console.log(`Updated version ${version.id}`);
      
      return version;
    } catch (error) {
      console.error('Error in VersionService.update:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update version',
        cause: error,
      });
    }
  }

  /**
   * Delete a version
   */
  static async delete(input: GetVersionInput): Promise<void> {
    try {
      await VersionManager.deleteVersion(input.id);
      
      console.log(`Deleted version ${input.id}`);
    } catch (error) {
      console.error('Error in VersionService.delete:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete version',
        cause: error,
      });
    }
  }

  /**
   * Compare two versions
   */
  static async compare(version1Id: string, version2Id: string): Promise<VersionComparison> {
    try {
      const version1 = await VersionManager.getVersion(version1Id);
      const version2 = await VersionManager.getVersion(version2Id);
      
      const comparison = VersionManager.compareVersions(version1, version2);
      
      return comparison;
    } catch (error) {
      console.error('Error in VersionService.compare:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to compare versions',
        cause: error,
      });
    }
  }

  /**
   * Get version count for a project
   */
  static async getCount(projectId: string): Promise<number> {
    try {
      const count = await VersionManager.getVersionCount(projectId);
      return count;
    } catch (error) {
      console.error('Error in VersionService.getCount:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get version count',
        cause: error,
      });
    }
  }

  /**
   * Get version history chain
   */
  static async getHistory(versionId: string): Promise<Version[]> {
    try {
      const history = await VersionManager.getVersionHistory(versionId);
      return history;
    } catch (error) {
      console.error('Error in VersionService.getHistory:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get version history',
        cause: error,
      });
    }
  }
}

