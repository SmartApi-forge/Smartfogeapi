import React from 'react'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

interface CardProps {
  title?: string
  description?: string
  href?: string
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

/**
 * Card Component
 * 
 * A styled card for highlighting features, links, or important content.
 * Used in MDX documentation to create visually distinct sections.
 * 
 * Requirements: 6.1, 6.5
 */
export function Card({ 
  title, 
  description, 
  href, 
  icon, 
  children, 
  className 
}: CardProps) {
  const content = (
    <>
      {icon && (
        <div className="mb-3 text-primary" aria-hidden="true">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-muted-foreground mb-0">
          {description}
        </p>
      )}
      {children && (
        <div className="mt-3">
          {children}
        </div>
      )}
      {href && (
        <div className="mt-3 flex items-center text-sm font-medium text-primary">
          Learn more
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </div>
      )}
    </>
  )
  
  const baseClasses = cn(
    'my-4 rounded-lg border border-border bg-card p-6',
    'transition-all duration-200',
    className
  )
  
  // Requirements: 6.1, 6.2 - Descriptive link text and ARIA labels
  if (href) {
    return (
      <a
        href={href}
        className={cn(
          baseClasses,
          'group block no-underline hover:border-primary hover:shadow-md'
        )}
        aria-label={title ? `${title} - Learn more` : 'Learn more'}
      >
        {content}
      </a>
    )
  }
  
  return (
    <article className={baseClasses}>
      {content}
    </article>
  )
}

/**
 * CardGrid Component
 * 
 * A responsive grid layout for multiple cards
 */
interface CardGridProps {
  children: React.ReactNode
  cols?: 2 | 3 | 4
  className?: string
}

export function CardGrid({ children, cols = 2, className }: CardGridProps) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  }
  
  return (
    <div
      className={cn(
        'my-6 grid grid-cols-1 gap-4',
        gridCols[cols],
        className
      )}
      role="list"
      aria-label="Card grid"
    >
      {children}
    </div>
  )
}
