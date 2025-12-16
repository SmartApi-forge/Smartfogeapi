/**
 * Interactive Test Page for Scroll Behavior Verification
 * 
 * This component can be added to a documentation page to provide
 * interactive testing of scroll behavior and right sidebar sync.
 * 
 * Usage: Add this component to any documentation page during testing
 */

"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertCircle, Play } from 'lucide-react'

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'pending' | 'running'
  message: string
}

export function ScrollBehaviorTestPage() {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Scroll Spy Highlighting', status: 'pending', message: 'Not started' },
    { name: 'Smooth Scrolling', status: 'pending', message: 'Not started' },
    { name: 'Scroll Offset', status: 'pending', message: 'Not started' },
    { name: 'Subsection Linking', status: 'pending', message: 'Not started' },
  ])
  const [isRunning, setIsRunning] = useState(false)

  const updateTest = (index: number, status: TestResult['status'], message: string) => {
    setTests(prev => {
      const newTests = [...prev]
      newTests[index] = { ...newTests[index], status, message }
      return newTests
    })
  }

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const runTests = async () => {
    setIsRunning(true)

    // Test 1: Scroll Spy Highlighting
    updateTest(0, 'running', 'Testing scroll spy...')
    await wait(500)
    
    const rightSidebar = document.querySelector('aside[aria-label="Table of contents"]')
    if (!rightSidebar) {
      updateTest(0, 'fail', 'Right sidebar not found')
    } else {
      const activeLink = rightSidebar.querySelector('[aria-current="location"]')
      if (activeLink) {
        updateTest(0, 'pass', `Active section: "${activeLink.textContent}"`)
      } else {
        updateTest(0, 'fail', 'No active section found')
      }
    }

    await wait(500)

    // Test 2: Smooth Scrolling
    updateTest(1, 'running', 'Testing smooth scrolling...')
    await wait(500)

    if (rightSidebar) {
      const tocLinks = rightSidebar.querySelectorAll('a')
      if (tocLinks.length >= 2) {
        const testLink = tocLinks[1] as HTMLAnchorElement
        const initialScrollY = window.scrollY
        
        testLink.click()
        await wait(1000)
        
        const finalScrollY = window.scrollY
        if (finalScrollY !== initialScrollY) {
          updateTest(1, 'pass', `Scrolled from ${initialScrollY}px to ${finalScrollY}px`)
        } else {
          updateTest(1, 'fail', 'Scroll position did not change')
        }
      } else {
        updateTest(1, 'fail', 'Not enough TOC links to test')
      }
    } else {
      updateTest(1, 'fail', 'Right sidebar not found')
    }

    await wait(500)

    // Test 3: Scroll Offset
    updateTest(2, 'running', 'Testing scroll offset...')
    await wait(500)

    if (rightSidebar) {
      const tocLinks = rightSidebar.querySelectorAll('a')
      if (tocLinks.length >= 2) {
        const testLink = tocLinks[1] as HTMLAnchorElement
        const targetId = testLink.getAttribute('href')?.substring(1)
        
        if (targetId) {
          testLink.click()
          await wait(1000)
          
          const targetElement = document.getElementById(targetId)
          if (targetElement) {
            const rect = targetElement.getBoundingClientRect()
            const distanceFromTop = rect.top
            
            if (distanceFromTop >= 60 && distanceFromTop <= 120) {
              updateTest(2, 'pass', `Offset: ${distanceFromTop.toFixed(0)}px (expected 80-100px)`)
            } else {
              updateTest(2, 'fail', `Offset: ${distanceFromTop.toFixed(0)}px (expected 80-100px)`)
            }
          } else {
            updateTest(2, 'fail', 'Target element not found')
          }
        } else {
          updateTest(2, 'fail', 'Link has no href')
        }
      } else {
        updateTest(2, 'fail', 'Not enough TOC links to test')
      }
    } else {
      updateTest(2, 'fail', 'Right sidebar not found')
    }

    await wait(500)

    // Test 4: Subsection Linking
    updateTest(3, 'running', 'Testing subsection linking...')
    await wait(500)

    if (rightSidebar) {
      const tocLinks = rightSidebar.querySelectorAll('a')
      let allValid = true
      let missingTargets: string[] = []

      tocLinks.forEach(link => {
        const href = link.getAttribute('href')
        if (href && href.startsWith('#')) {
          const targetId = href.substring(1)
          const targetElement = document.getElementById(targetId)
          if (!targetElement) {
            allValid = false
            missingTargets.push(targetId)
          }
        }
      })

      if (allValid) {
        updateTest(3, 'pass', `All ${tocLinks.length} links have valid targets`)
      } else {
        updateTest(3, 'fail', `Missing targets: ${missingTargets.join(', ')}`)
      }
    } else {
      updateTest(3, 'fail', 'Right sidebar not found')
    }

    // Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    setIsRunning(false)
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'running':
        return <AlertCircle className="h-5 w-5 text-blue-500 animate-pulse" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = (status: TestResult['status']) => {
    const variants: Record<TestResult['status'], string> = {
      pass: 'bg-green-500/10 text-green-500 border-green-500/20',
      fail: 'bg-red-500/10 text-red-500 border-red-500/20',
      running: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      pending: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    }

    return (
      <Badge variant="outline" className={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  const passedTests = tests.filter(t => t.status === 'pass').length
  const totalTests = tests.length
  const allPassed = passedTests === totalTests && !isRunning

  return (
    <Card className="w-full max-w-3xl mx-auto my-8">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Scroll Behavior Test Suite</span>
          {allPassed && (
            <Badge className="bg-green-500">
              All Tests Passed ✓
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Interactive testing for Requirements 3.3, 3.4, and 3.5
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {passedTests} / {totalTests} tests passed
          </div>
          <Button
            onClick={runTests}
            disabled={isRunning}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </Button>
        </div>

        <div className="space-y-3">
          {tests.map((test, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 rounded-lg border bg-card"
            >
              <div className="mt-0.5">
                {getStatusIcon(test.status)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{test.name}</h4>
                  {getStatusBadge(test.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {test.message}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t space-y-2">
          <h4 className="font-medium text-sm">Manual Verification Steps:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Scroll through the page and observe the right sidebar highlighting</li>
            <li>Click different sections in the right sidebar</li>
            <li>Verify smooth scrolling animation</li>
            <li>Check that headings are not hidden behind the fixed header</li>
            <li>Test keyboard navigation (Tab + Enter)</li>
          </ul>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            For detailed verification steps, see{' '}
            <code className="px-1 py-0.5 bg-muted rounded text-xs">
              components/documentation/SCROLL_BEHAVIOR_VERIFICATION.md
            </code>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
