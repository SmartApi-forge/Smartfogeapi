"use client"

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

interface TabsProps {
  defaultValue?: string
  children: React.ReactNode
  className?: string
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

/**
 * Tabs Context
 */
const TabsContext = React.createContext<{
  activeTab: string
  setActiveTab: (value: string) => void
}>({
  activeTab: '',
  setActiveTab: () => {},
})

/**
 * Tabs Component
 * 
 * A tabbed interface for displaying multiple options or code examples.
 * Used in MDX documentation to show different implementations or configurations.
 * 
 * Requirements: 6.1, 6.5
 */
export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || '')
  
  // Auto-select first tab if no default is provided
  React.useEffect(() => {
    if (!activeTab && children) {
      const firstTrigger = React.Children.toArray(children)
        .flatMap((child) => {
          if (React.isValidElement(child) && child.type === TabsList) {
            return React.Children.toArray(child.props.children)
          }
          return []
        })
        .find((child) => React.isValidElement(child) && child.type === TabsTrigger)
      
      if (React.isValidElement(firstTrigger) && firstTrigger.props.value) {
        setActiveTab(firstTrigger.props.value)
      }
    }
  }, [activeTab, children])
  
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('my-6', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

/**
 * TabsList Component
 * 
 * Container for tab triggers
 */
export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-border',
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  )
}

/**
 * TabsTrigger Component
 * 
 * Individual tab button
 */
export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext)
  const isActive = activeTab === value
  
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      id={`tab-${value}`}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setActiveTab(value)}
      onKeyDown={(e) => {
        // Requirements: 6.5 - Keyboard navigation for tabs
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setActiveTab(value)
        }
      }}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors',
        'border-b-2 -mb-px',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
        className
      )}
    >
      {children}
    </button>
  )
}

/**
 * TabsContent Component
 * 
 * Content panel for each tab
 */
export function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = React.useContext(TabsContext)
  
  if (activeTab !== value) {
    return null
  }
  
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={cn('pt-4', className)}
    >
      {children}
    </div>
  )
}
