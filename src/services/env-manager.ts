/**
 * EnvManager Service
 * 
 * Manages environment variables for projects including:
 * - Saving and retrieving env variables from database
 * - Detecting required variables from code (process.env references)
 * - Validating env file format (KEY=value)
 * - Merging new variables without overwriting existing ones
 * 
 * Requirements: 16.1, 16.3, 16.4, 16.6
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnvVariable, EnvValidationResult, IEnvManager } from '../types/context-management';

// Database row type for project_env_variables table is defined in types

/**
 * Lazy-load supabase client to avoid initialization errors in tests
 */
let _supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    // Dynamic import to avoid initialization at module load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../../lib/supabase');
    _supabaseClient = supabase;
  }
  return _supabaseClient!;
}

/**
 * Regex pattern for valid env variable keys
 * Must start with letter or underscore, followed by letters, numbers, or underscores
 */
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Regex pattern for detecting process.env references in code
 * Matches: process.env.VAR_NAME, process.env['VAR_NAME'], process.env["VAR_NAME"]
 */
const PROCESS_ENV_PATTERN = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)|process\.env\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g;

/**
 * EnvManager implementation
 * Provides environment variable management for projects
 */
export class EnvManager implements IEnvManager {
  private supabaseClient: SupabaseClient | null;

  /**
   * Create an EnvManager instance
   * @param supabaseClient - Optional Supabase client for dependency injection (useful for testing)
   */
  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient || null;
  }

  /**
   * Get the Supabase client (lazy-loaded or injected)
   */
  private getClient(): SupabaseClient {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }
    return getSupabaseClient();
  }

  /**
   * Save environment variables for a project
   * 
   * Stores variables in the database. Uses upsert to handle both
   * new and existing variables.
   * 
   * Requirements: 16.1
   * 
   * @param projectId - The project ID
   * @param variables - Array of environment variables to save
   */
  async saveEnvVariables(projectId: string, variables: EnvVariable[]): Promise<void> {
    if (variables.length === 0) {
      return;
    }

    // Prepare records for upsert
    const records = variables.map(variable => ({
      project_id: projectId,
      key: variable.key,
      encrypted_value: variable.value, // Note: In production, this should be encrypted
      is_secret: variable.isSecret,
      is_required: variable.isRequired,
      updated_at: new Date().toISOString(),
    }));

    // Upsert each variable (update if exists, insert if not)
    for (const record of records) {
      const { error } = await this.getClient()
        .from('project_env_variables')
        .upsert(record, {
          onConflict: 'project_id,key',
        });

      if (error) {
        console.error('Error saving env variable:', error);
        throw new Error(`Failed to save env variable ${record.key}: ${error.message}`);
      }
    }
  }

  /**
   * Get environment variables for a project
   * 
   * Retrieves all stored environment variables from the database.
   * 
   * @param projectId - The project ID
   * @returns Array of environment variables
   */
  async getEnvVariables(projectId: string): Promise<EnvVariable[]> {
    const { data, error } = await this.getClient()
      .from('project_env_variables')
      .select('key, encrypted_value, is_secret, is_required')
      .eq('project_id', projectId)
      .order('key', { ascending: true });

    if (error) {
      console.error('Error fetching env variables:', error);
      return [];
    }

    return (data || []).map(row => ({
      key: row.key,
      value: row.encrypted_value, // Note: In production, this should be decrypted
      isSecret: row.is_secret,
      isRequired: row.is_required,
    }));
  }

  /**
   * Detect required environment variables from code files
   * 
   * Scans code for process.env references and returns unique variable names.
   * 
   * Requirements: 16.3
   * 
   * @param files - Record of file paths to file contents
   * @returns Array of unique environment variable names found
   */
  detectRequiredVariables(files: Record<string, string>): string[] {
    const foundVariables = new Set<string>();

    for (const content of Object.values(files)) {
      // Reset regex lastIndex for each file
      PROCESS_ENV_PATTERN.lastIndex = 0;
      
      let match;
      while ((match = PROCESS_ENV_PATTERN.exec(content)) !== null) {
        // match[1] is from process.env.VAR_NAME
        // match[2] is from process.env['VAR_NAME'] or process.env["VAR_NAME"]
        const varName = match[1] || match[2];
        if (varName) {
          foundVariables.add(varName);
        }
      }
    }

    return Array.from(foundVariables).sort();
  }

  /**
   * Validate environment file format
   * 
   * Validates that content follows KEY=value format.
   * 
   * Requirements: 16.4
   * 
   * Property 13: Env File Format
   * For any environment variable save operation, the resulting .env.local 
   * content SHALL be valid KEY=value format.
   * 
   * @param content - The env file content to validate
   * @returns Validation result with errors and warnings
   */
  validateEnvFormat(content: string): EnvValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || content.trim() === '') {
      return { isValid: true, errors, warnings };
    }

    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        continue;
      }

      // Check for KEY=value format
      const equalsIndex = line.indexOf('=');
      if (equalsIndex === -1) {
        errors.push(`Line ${lineNum}: Missing '=' separator`);
        continue;
      }

      const key = line.substring(0, equalsIndex).trim();
      const value = line.substring(equalsIndex + 1);

      // Validate key format
      if (!key) {
        errors.push(`Line ${lineNum}: Empty key`);
        continue;
      }

      if (!ENV_KEY_PATTERN.test(key)) {
        errors.push(`Line ${lineNum}: Invalid key format '${key}'. Keys must start with a letter or underscore and contain only letters, numbers, and underscores.`);
        continue;
      }

      // Warn about potentially sensitive values
      const lowerKey = key.toLowerCase();
      if ((lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('key') || lowerKey.includes('token')) && value && !value.startsWith('"') && !value.startsWith("'")) {
        warnings.push(`Line ${lineNum}: Consider quoting sensitive value for '${key}'`);
      }

      // Warn about empty values
      if (value.trim() === '') {
        warnings.push(`Line ${lineNum}: Empty value for '${key}'`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Parse env file content into variables
   * 
   * @param content - The env file content
   * @returns Array of parsed environment variables
   */
  parseEnvContent(content: string): EnvVariable[] {
    const variables: EnvVariable[] = [];

    if (!content || content.trim() === '') {
      return variables;
    }

    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        continue;
      }

      const equalsIndex = line.indexOf('=');
      if (equalsIndex === -1) {
        continue;
      }

      const key = line.substring(0, equalsIndex).trim();
      let value = line.substring(equalsIndex + 1);

      // Remove surrounding quotes if present and unescape escaped quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
        // Unescape escaped double quotes
        value = value.replace(/\\"/g, '"');
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }

      if (key && ENV_KEY_PATTERN.test(key)) {
        const lowerKey = key.toLowerCase();
        const isSecret = lowerKey.includes('secret') || 
                        lowerKey.includes('password') || 
                        lowerKey.includes('key') || 
                        lowerKey.includes('token') ||
                        lowerKey.includes('api');

        variables.push({
          key,
          value,
          isSecret,
          isRequired: false, // Will be determined by detectRequiredVariables
        });
      }
    }

    return variables;
  }

  /**
   * Format environment variables as env file content
   * 
   * Property 13: Env File Format
   * For any environment variable save operation, the resulting .env.local 
   * content SHALL be valid KEY=value format.
   * 
   * @param variables - Array of environment variables
   * @returns Formatted env file content
   */
  formatEnvContent(variables: EnvVariable[]): string {
    if (variables.length === 0) {
      return '';
    }

    const lines: string[] = [];
    
    for (const variable of variables) {
      // Quote values that contain special characters or whitespace
      let value = variable.value;
      if (value.includes(' ') || value.includes('\n') || value.includes('"') || value.includes("'") || value.includes('#')) {
        // Escape any existing double quotes and wrap in double quotes
        value = `"${value.replace(/"/g, '\\"')}"`;
      }
      
      lines.push(`${variable.key}=${value}`);
    }

    return lines.join('\n');
  }

  /**
   * Merge new variables with existing ones without overwriting
   * 
   * Requirements: 16.6
   * 
   * @param existingContent - Existing env file content
   * @param newVariables - New variables to merge
   * @returns Merged env file content
   */
  mergeEnvContent(existingContent: string, newVariables: EnvVariable[]): string {
    const existingVariables = this.parseEnvContent(existingContent);
    const existingKeys = new Set(existingVariables.map(v => v.key));

    // Only add new variables that don't already exist
    const variablesToAdd = newVariables.filter(v => !existingKeys.has(v.key));

    if (variablesToAdd.length === 0) {
      return existingContent;
    }

    // Combine existing and new variables
    const allVariables = [...existingVariables, ...variablesToAdd];
    
    return this.formatEnvContent(allVariables);
  }

  /**
   * Delete environment variable for a project
   * 
   * @param projectId - The project ID
   * @param key - The variable key to delete
   */
  async deleteEnvVariable(projectId: string, key: string): Promise<void> {
    const { error } = await this.getClient()
      .from('project_env_variables')
      .delete()
      .eq('project_id', projectId)
      .eq('key', key);

    if (error) {
      console.error('Error deleting env variable:', error);
      throw new Error(`Failed to delete env variable ${key}: ${error.message}`);
    }
  }

  /**
   * Delete all environment variables for a project
   * 
   * @param projectId - The project ID
   */
  async deleteAllEnvVariables(projectId: string): Promise<void> {
    const { error } = await this.getClient()
      .from('project_env_variables')
      .delete()
      .eq('project_id', projectId);

    if (error) {
      console.error('Error deleting all env variables:', error);
      throw new Error(`Failed to delete env variables: ${error.message}`);
    }
  }
}

// Export singleton instance
export const envManager = new EnvManager();
