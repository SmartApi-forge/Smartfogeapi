'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, File, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileCreated: (filePath: string, content: string) => void;
  projectId: string;
  sandboxId: string;
  currentFolder?: string;
}

export function NewFileDialog({
  isOpen,
  onClose,
  onFileCreated,
  projectId,
  sandboxId,
  currentFolder = '',
}: NewFileDialogProps) {
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setFileName('');
    setFileContent('');
    setError('');
    setSuccess(false);
    onClose();
  };

  const handleCreate = async () => {
    if (!fileName.trim()) {
      setError('Please enter a file name');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Construct full path
      const filePath = currentFolder 
        ? `${currentFolder}/${fileName}`.replace(/^\//, '')
        : fileName;

      const response = await fetch('/api/sandbox/file/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandboxId,
          projectId,
          filePath,
          content: fileContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create file');
      }

      setSuccess(true);
      onFileCreated(filePath, fileContent);

      // Close after short delay to show success
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err: any) {
      console.error('File creation error:', err);
      setError(err.message || 'Failed to create file');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#1D1D1D] rounded-lg shadow-2xl border border-border dark:border-[#333433]"
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border dark:border-[#333433]">
            <div className="flex items-center gap-2">
              <File className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-foreground">Create New File</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              disabled={isCreating}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {/* Current folder indicator */}
            {currentFolder && (
              <div className="text-xs text-muted-foreground">
                Location: <span className="font-mono text-foreground">/{currentFolder}</span>
              </div>
            )}

            {/* File name input */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground">
                File Name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g., .env.local, config.json, utils.ts"
                className="w-full px-3 py-2 bg-background dark:bg-[#0E100F] border border-border dark:border-[#333433] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                autoFocus
                disabled={isCreating}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            {/* File content textarea */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground">
                Content (optional)
              </label>
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="File content..."
                rows={6}
                className="w-full px-3 py-2 bg-background dark:bg-[#0E100F] border border-border dark:border-[#333433] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none"
                disabled={isCreating}
              />
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-600 dark:text-red-400 text-sm"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Success message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-md text-green-600 dark:text-green-400 text-sm"
              >
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>File created successfully!</span>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border dark:border-[#333433]">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
              className="text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !fileName.trim()}
              className="text-sm"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <File className="h-4 w-4 mr-2" />
                  Create File
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
