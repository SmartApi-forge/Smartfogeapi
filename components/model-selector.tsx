'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Available AI models for code generation
 * Gemini models have free tier via Google AI Studio
 */
export type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.0-flash';

export interface ModelOption {
  id: AIModel;
  name: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
];

interface ModelSelectorProps {
  value: AIModel;
  onChange: (model: AIModel) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Minimal model selector dropdown - v0 style
 */
export function ModelSelector({ value, onChange, disabled, className }: ModelSelectorProps) {
  const selectedModel = MODEL_OPTIONS.find(m => m.id === value) || MODEL_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className={cn(
            "flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <span>{selectedModel.name}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {MODEL_OPTIONS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onChange(model.id)}
            className="flex items-center justify-between gap-2"
          >
            <span>{model.name}</span>
            {value === model.id && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ModelSelector;
