'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Key,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * Environment variable for display
 */
interface EnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
  isRequired: boolean;
}

interface EnvVariablesDialogProps {
  projectId: string;
  sandboxId?: string;
  /** Trigger element to open the dialog */
  trigger?: React.ReactNode;
  /** Callback when variables are saved */
  onSave?: (variables: EnvVariable[]) => void;
  /** Initial variables to display */
  initialVariables?: EnvVariable[];
  /** Required variables detected from code */
  requiredVariables?: string[];
}

/**
 * Environment Variables Dialog
 * 
 * Allows users to manage environment variables for their project.
 * Features:
 * - Add/edit/delete environment variables
 * - Mask sensitive values by default (Requirements: 16.5)
 * - Show required variables detected from code
 * - Validate KEY=value format
 * 
 * Requirements: 16.5
 */
export function EnvVariablesDialog({
  projectId,
  sandboxId,
  trigger,
  onSave,
  initialVariables = [],
  requiredVariables = [],
}: EnvVariablesDialogProps) {
  const [open, setOpen] = useState(false);
  const [variables, setVariables] = useState<EnvVariable[]>(initialVariables);
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initialize with required variables that aren't already set
  useEffect(() => {
    if (open && requiredVariables.length > 0) {
      const existingKeys = new Set(variables.map(v => v.key));
      const missingRequired = requiredVariables.filter(key => !existingKeys.has(key));
      
      if (missingRequired.length > 0) {
        setVariables(prev => [
          ...prev,
          ...missingRequired.map(key => ({
            key,
            value: '',
            isSecret: isSecretKey(key),
            isRequired: true,
          })),
        ]);
      }
    }
  }, [open, requiredVariables]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(null);
      setVisibleValues(new Set());
    }
  }, [open]);

  const isSecretKey = (key: string): boolean => {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('key') ||
      lowerKey.includes('token') ||
      lowerKey.includes('api')
    );
  };

  const handleAddVariable = () => {
    setVariables(prev => [
      ...prev,
      { key: '', value: '', isSecret: false, isRequired: false },
    ]);
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyChange = (index: number, key: string) => {
    setVariables(prev =>
      prev.map((v, i) =>
        i === index
          ? { ...v, key: key.toUpperCase().replace(/[^A-Z0-9_]/g, '_'), isSecret: isSecretKey(key) }
          : v
      )
    );
  };

  const handleValueChange = (index: number, value: string) => {
    setVariables(prev =>
      prev.map((v, i) => (i === index ? { ...v, value } : v))
    );
  };

  const toggleValueVisibility = (key: string) => {
    setVisibleValues(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const validateVariables = (): string | null => {
    for (const variable of variables) {
      if (!variable.key) {
        return 'All variables must have a key';
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.key)) {
        return `Invalid key format: ${variable.key}. Keys must start with a letter or underscore.`;
      }
    }
    
    // Check for duplicates
    const keys = variables.map(v => v.key);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    if (duplicates.length > 0) {
      return `Duplicate keys found: ${[...new Set(duplicates)].join(', ')}`;
    }
    
    return null;
  };

  const handleSave = async () => {
    const validationError = validateVariables();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Filter out empty variables
      const validVariables = variables.filter(v => v.key && v.value);
      
      // Call the API to save variables
      const response = await fetch('/api/env/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          sandboxId,
          variables: validVariables,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save environment variables');
      }

      setSuccess('Environment variables saved successfully');
      onSave?.(validVariables);
      
      // Close dialog after short delay
      setTimeout(() => {
        setOpen(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save variables');
    } finally {
      setIsSaving(false);
    }
  };

  const missingRequired = requiredVariables.filter(
    key => !variables.find(v => v.key === key && v.value)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Key className="size-4 mr-2" />
            Environment Variables
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="size-5" />
            Environment Variables
          </DialogTitle>
          <DialogDescription>
            Manage environment variables for your project. Sensitive values are masked by default.
          </DialogDescription>
        </DialogHeader>

        {/* Required variables warning */}
        {missingRequired.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <AlertCircle className="size-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-600 dark:text-yellow-400">
                Missing required variables
              </p>
              <p className="text-muted-foreground mt-1">
                The following variables are used in your code but not set:{' '}
                <span className="font-mono text-xs">
                  {missingRequired.join(', ')}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Variables list */}
        <div className="flex-1 overflow-y-auto space-y-3 py-4 min-h-[200px] max-h-[400px]">
          <AnimatePresence mode="popLayout">
            {variables.map((variable, index) => (
              <motion.div
                key={`${variable.key}-${index}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2"
              >
                {/* Key input */}
                <div className="flex-1 min-w-[120px]">
                  <Input
                    placeholder="KEY_NAME"
                    value={variable.key}
                    onChange={(e) => handleKeyChange(index, e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                <span className="text-muted-foreground">=</span>

                {/* Value input with visibility toggle */}
                <div className="flex-[2] relative">
                  <Input
                    type={variable.isSecret && !visibleValues.has(variable.key) ? 'password' : 'text'}
                    placeholder="value"
                    value={variable.value}
                    onChange={(e) => handleValueChange(index, e.target.value)}
                    className="font-mono text-sm pr-10"
                  />
                  {variable.isSecret && (
                    <button
                      type="button"
                      onClick={() => toggleValueVisibility(variable.key)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {visibleValues.has(variable.key) ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Badges and delete button */}
                <div className="flex items-center gap-1">
                  {variable.isRequired && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                  {variable.isSecret && (
                    <Badge variant="secondary" className="text-xs">
                      Secret
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveVariable(index)}
                    className="size-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {variables.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="size-8 mx-auto mb-2 opacity-50" />
              <p>No environment variables defined</p>
              <p className="text-sm">Click &quot;Add Variable&quot; to get started</p>
            </div>
          )}
        </div>

        {/* Error/Success messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
            <AlertCircle className="size-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="size-4 flex-shrink-0" />
            {success}
          </div>
        )}

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button variant="outline" onClick={handleAddVariable}>
            <Plus className="size-4 mr-2" />
            Add Variable
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" />
                Save Variables
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
