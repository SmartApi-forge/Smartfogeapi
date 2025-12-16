import React from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react'

export type CalloutType = 'info' | 'warning' | 'error' | 'success'

interface CalloutProps {
  type?: CalloutType
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Callout Component
 * 
 * A styled callout box for notes, warnings, errors, and success messages.
 * Used in MDX documentation to highlight important information.
 * 
 * Requirements: 6.1, 6.5
 */
export function Callout({ 
  type = 'info', 
  title, 
  children, 
  className 
}: CalloutProps) {
  const icons = {
    info: Info,
    warning: AlertTriangle,
    error: AlertCircle,
    success: CheckCircle,
  }
  
  const styles = {
    info: {
      container: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-900 dark:text-blue-100',
    },
    warning: {
      container: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900',
      icon: 'text-yellow-600 dark:text-yellow-400',
      title: 'text-yellow-900 dark:text-yellow-100',
    },
    error: {
      container: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
      icon: 'text-red-600 dark:text-red-400',
      title: 'text-red-900 dark:text-red-100',
    },
    success: {
      container: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900',
      icon: 'text-green-600 dark:text-green-400',
      title: 'text-green-900 dark:text-green-100',
    },
  }
  
  const Icon = icons[type]
  const style = styles[type]
  
  // Map callout types to ARIA roles - Requirements: 6.1, 6.2
  const roleMap = {
    info: 'note',
    warning: 'alert',
    error: 'alert',
    success: 'status',
  }
  
  const ariaLabelMap = {
    info: 'Information',
    warning: 'Warning',
    error: 'Error',
    success: 'Success',
  }
  
  return (
    <aside
      role={roleMap[type]}
      aria-label={title || ariaLabelMap[type]}
      className={cn(
        'my-6 rounded-lg border p-4',
        style.container,
        className
      )}
    >
      <div className="flex gap-3">
        <Icon 
          className={cn('h-5 w-5 flex-shrink-0 mt-0.5', style.icon)} 
          aria-hidden="true"
        />
        <div className="flex-1 space-y-2">
          {title && (
            <div className={cn('font-semibold', style.title)}>
              {title}
            </div>
          )}
          <div className="text-sm leading-relaxed [&>p]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </aside>
  )
}
