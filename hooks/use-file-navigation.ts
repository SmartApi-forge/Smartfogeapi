'use client';

/**
 * File Navigation Hook
 * 
 * Provides a reusable way to handle file path clicks throughout the application.
 * Integrates with the file explorer and editor panel.
 * 
 * Requirements: 3.3, 9.2
 * - Open file in editor panel on click
 * - Integrate with existing file explorer
 */

import { useCallback } from 'react';

/**
 * Tree node structure for file navigation
 */
export interface FileTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FileTreeNode[];
}

/**
 * Options for the file navigation hook
 */
export interface UseFileNavigationOptions {
  /** The file tree to search within */
  fileTree: FileTreeNode[];
  /** Current expanded folders */
  expanded: Set<string>;
  /** Callback to update expanded folders */
  setExpanded: (expanded: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  /** Callback to set the selected file */
  setSelected: (fileId: string | null) => void;
  /** Callback to switch to code view (optional) */
  setViewMode?: (mode: 'code' | 'preview') => void;
  /** Callback for mobile view switching (optional) */
  setMobileView?: (view: 'chat' | 'code') => void;
  /** Whether the screen is mobile size */
  isMobileScreen?: boolean;
}

/**
 * Return type for the file navigation hook
 */
export interface UseFileNavigationReturn {
  /** Navigate to a file by path */
  navigateToFile: (filePath: string) => boolean;
  /** Find a file in the tree */
  findFile: (filePath: string) => FileTreeNode | null;
  /** Expand all parent folders for a file path */
  expandParentFolders: (filePath: string) => void;
}

/**
 * Hook for handling file navigation throughout the application
 * 
 * Usage:
 * ```tsx
 * const { navigateToFile } = useFileNavigation({
 *   fileTree,
 *   expanded,
 *   setExpanded,
 *   setSelected,
 *   setViewMode,
 * });
 * 
 * // In a component
 * <ClickableFilePath
 *   path="src/auth.ts"
 *   onClick={navigateToFile}
 * />
 * ```
 */
export function useFileNavigation({
  fileTree,
  expanded,
  setExpanded,
  setSelected,
  setViewMode,
  setMobileView,
  isMobileScreen = false,
}: UseFileNavigationOptions): UseFileNavigationReturn {
  
  /**
   * Find a file in the tree by path
   * Searches recursively through all nodes
   */
  const findFile = useCallback((filePath: string): FileTreeNode | null => {
    const searchTree = (nodes: FileTreeNode[], targetPath: string): FileTreeNode | null => {
      for (const node of nodes) {
        // Match by full path (node.id), by filename, or by path ending
        if (
          node.type === 'file' && 
          (node.id === targetPath || 
           node.name === targetPath || 
           node.id.endsWith(targetPath) ||
           node.id.endsWith('/' + targetPath))
        ) {
          return node;
        }
        if (node.children) {
          const found = searchTree(node.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };
    
    return searchTree(fileTree, filePath);
  }, [fileTree]);
  
  /**
   * Expand all parent folders for a given file path
   */
  const expandParentFolders = useCallback((filePath: string) => {
    const pathParts = filePath.split('/');
    
    setExpanded((prev: Set<string>) => {
      const newExpanded = new Set(prev);
      
      // Add each parent folder path to expanded set
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderPath = pathParts.slice(0, i + 1).join('/');
        newExpanded.add(folderPath);
        // Also try with folder- prefix (some implementations use this)
        newExpanded.add(`folder-${folderPath}`);
      }
      
      return newExpanded;
    });
  }, [setExpanded]);
  
  /**
   * Navigate to a file by path
   * - Switches to code view
   * - Finds the file in the tree
   * - Expands parent folders
   * - Selects the file
   * 
   * @returns true if navigation was successful, false otherwise
   */
  const navigateToFile = useCallback((filePath: string): boolean => {
    console.log('📁 Navigating to file:', filePath);
    
    // 1. Switch to code view if callback provided
    if (setViewMode) {
      setViewMode('code');
    }
    
    // 2. Handle mobile view switching
    if (isMobileScreen && setMobileView) {
      setMobileView('code');
    }
    
    // 3. Find the file in the tree
    const fileNode = findFile(filePath);
    
    if (fileNode) {
      console.log('✅ Found file in tree:', fileNode.id);
      
      // 4. Expand all parent folders
      expandParentFolders(fileNode.id);
      
      // 5. Select the file
      setSelected(fileNode.id);
      
      console.log('✅ Navigated to file successfully');
      return true;
    } else {
      console.warn('❌ File not found in tree:', filePath);
      return false;
    }
  }, [findFile, expandParentFolders, setSelected, setViewMode, setMobileView, isMobileScreen]);
  
  return {
    navigateToFile,
    findFile,
    expandParentFolders,
  };
}

export default useFileNavigation;
