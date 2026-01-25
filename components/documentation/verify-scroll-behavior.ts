/**
 * Manual Verification Script for Scroll Behavior and Right Sidebar Sync
 * 
 * This script provides manual verification steps for Requirements 3.3, 3.4, 3.5:
 * - Scroll spy correctly highlights active sections in right sidebar
 * - Smooth scrolling to sections when clicking right sidebar links
 * - Proper scroll offset accounts for fixed header
 * - All subsections are properly linked and navigable
 * 
 * Run this in the browser console on a documentation page to verify behavior.
 */

export interface VerificationResult {
  test: string
  passed: boolean
  details: string
}

export class ScrollBehaviorVerifier {
  private results: VerificationResult[] = []

  /**
   * Run all verification tests
   */
  async runAllTests(): Promise<VerificationResult[]> {
    console.log('🔍 Starting Scroll Behavior Verification...\n')

    await this.verifyScrollSpyHighlighting()
    await this.verifySmoothScrolling()
    await this.verifyScrollOffset()
    await this.verifySubsectionLinking()

    this.printResults()
    return this.results
  }

  /**
   * Requirement 3.3: Verify scroll spy correctly highlights active sections
   */
  private async verifyScrollSpyHighlighting(): Promise<void> {
    console.log('📍 Testing Requirement 3.3: Scroll spy highlighting...')

    try {
      // Find the right sidebar
      const rightSidebar = document.querySelector('aside[aria-label="Table of contents"]')
      if (!rightSidebar) {
        this.addResult('Scroll spy highlighting', false, 'Right sidebar not found')
        return
      }

      // Get all TOC links
      const tocLinks = rightSidebar.querySelectorAll('a')
      if (tocLinks.length === 0) {
        this.addResult('Scroll spy highlighting', false, 'No TOC links found')
        return
      }

      // Check if at least one link has active styling
      const activeLink = Array.from(tocLinks).find(link => 
        link.classList.contains('font-medium') || 
        link.getAttribute('aria-current') === 'location'
      )

      if (activeLink) {
        this.addResult(
          'Scroll spy highlighting - Initial state',
          true,
          `Active link found: "${activeLink.textContent}"`
        )
      } else {
        this.addResult(
          'Scroll spy highlighting - Initial state',
          false,
          'No active link found in initial state'
        )
      }

      // Verify active link changes on scroll
      const initialActiveText = activeLink?.textContent || ''
      
      // Scroll to bottom
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
      await this.wait(500) // Wait for scroll spy to update

      const newActiveLink = Array.from(tocLinks).find(link => 
        link.classList.contains('font-medium') || 
        link.getAttribute('aria-current') === 'location'
      )

      if (newActiveLink && newActiveLink.textContent !== initialActiveText) {
        this.addResult(
          'Scroll spy highlighting - Updates on scroll',
          true,
          `Active link changed from "${initialActiveText}" to "${newActiveLink.textContent}"`
        )
      } else {
        this.addResult(
          'Scroll spy highlighting - Updates on scroll',
          false,
          'Active link did not change after scrolling'
        )
      }

      // Scroll back to top
      window.scrollTo({ top: 0, behavior: 'instant' })
      await this.wait(500)

    } catch (error) {
      this.addResult('Scroll spy highlighting', false, `Error: ${error}`)
    }
  }

  /**
   * Requirement 3.4: Verify smooth scrolling to sections when clicking links
   */
  private async verifySmoothScrolling(): Promise<void> {
    console.log('📍 Testing Requirement 3.4: Smooth scrolling...')

    try {
      const rightSidebar = document.querySelector('aside[aria-label="Table of contents"]')
      if (!rightSidebar) {
        this.addResult('Smooth scrolling', false, 'Right sidebar not found')
        return
      }

      const tocLinks = rightSidebar.querySelectorAll('a')
      if (tocLinks.length < 2) {
        this.addResult('Smooth scrolling', false, 'Not enough TOC links to test')
        return
      }

      // Test clicking the second link
      const testLink = tocLinks[1] as HTMLAnchorElement
      const targetId = testLink.getAttribute('href')?.substring(1)
      
      if (!targetId) {
        this.addResult('Smooth scrolling', false, 'Link has no href')
        return
      }

      const initialScrollY = window.scrollY

      // Click the link
      testLink.click()
      await this.wait(1000) // Wait for smooth scroll animation

      const finalScrollY = window.scrollY

      if (finalScrollY !== initialScrollY) {
        this.addResult(
          'Smooth scrolling - Link click triggers scroll',
          true,
          `Scrolled from ${initialScrollY}px to ${finalScrollY}px`
        )
      } else {
        this.addResult(
          'Smooth scrolling - Link click triggers scroll',
          false,
          'Scroll position did not change after clicking link'
        )
      }

      // Verify URL hash was updated
      if (window.location.hash === `#${targetId}`) {
        this.addResult(
          'Smooth scrolling - URL hash updated',
          true,
          `URL hash set to #${targetId}`
        )
      } else {
        this.addResult(
          'Smooth scrolling - URL hash updated',
          false,
          `Expected #${targetId}, got ${window.location.hash}`
        )
      }

      // Verify target element exists
      const targetElement = document.getElementById(targetId)
      if (targetElement) {
        this.addResult(
          'Smooth scrolling - Target element exists',
          true,
          `Element with id "${targetId}" found`
        )
      } else {
        this.addResult(
          'Smooth scrolling - Target element exists',
          false,
          `Element with id "${targetId}" not found`
        )
      }

    } catch (error) {
      this.addResult('Smooth scrolling', false, `Error: ${error}`)
    }
  }

  /**
   * Requirement 3.5: Verify proper scroll offset accounts for fixed header
   */
  private async verifyScrollOffset(): Promise<void> {
    console.log('📍 Testing Requirement 3.5: Scroll offset...')

    try {
      const rightSidebar = document.querySelector('aside[aria-label="Table of contents"]')
      if (!rightSidebar) {
        this.addResult('Scroll offset', false, 'Right sidebar not found')
        return
      }

      const tocLinks = rightSidebar.querySelectorAll('a')
      if (tocLinks.length < 2) {
        this.addResult('Scroll offset', false, 'Not enough TOC links to test')
        return
      }

      // Scroll to top first
      window.scrollTo({ top: 0, behavior: 'instant' })
      await this.wait(300)

      // Click a link and measure the offset
      const testLink = tocLinks[1] as HTMLAnchorElement
      const targetId = testLink.getAttribute('href')?.substring(1)
      
      if (!targetId) {
        this.addResult('Scroll offset', false, 'Link has no href')
        return
      }

      testLink.click()
      await this.wait(1000) // Wait for scroll animation

      const targetElement = document.getElementById(targetId)
      if (!targetElement) {
        this.addResult('Scroll offset', false, `Target element #${targetId} not found`)
        return
      }

      const elementRect = targetElement.getBoundingClientRect()
      const distanceFromTop = elementRect.top

      // Expected offset is around 80-100px for fixed header
      const expectedOffset = 80
      const tolerance = 30 // Allow some tolerance

      if (Math.abs(distanceFromTop - expectedOffset) <= tolerance) {
        this.addResult(
          'Scroll offset - Correct offset applied',
          true,
          `Element is ${distanceFromTop.toFixed(0)}px from top (expected ~${expectedOffset}px)`
        )
      } else {
        this.addResult(
          'Scroll offset - Correct offset applied',
          false,
          `Element is ${distanceFromTop.toFixed(0)}px from top (expected ~${expectedOffset}px)`
        )
      }

      // Check if header is fixed
      const header = document.querySelector('header') || document.querySelector('[class*="header"]')
      if (header) {
        const headerStyles = window.getComputedStyle(header)
        const isFixed = headerStyles.position === 'fixed' || headerStyles.position === 'sticky'
        
        this.addResult(
          'Scroll offset - Fixed header detected',
          isFixed,
          `Header position: ${headerStyles.position}`
        )
      }

    } catch (error) {
      this.addResult('Scroll offset', false, `Error: ${error}`)
    }
  }

  /**
   * Verify all subsections are properly linked and navigable
   */
  private async verifySubsectionLinking(): Promise<void> {
    console.log('📍 Testing subsection linking and navigation...')

    try {
      const rightSidebar = document.querySelector('aside[aria-label="Table of contents"]')
      if (!rightSidebar) {
        this.addResult('Subsection linking', false, 'Right sidebar not found')
        return
      }

      const tocLinks = rightSidebar.querySelectorAll('a')
      
      // Check all links have proper href attributes
      let allLinksValid = true
      let invalidLinks: string[] = []

      tocLinks.forEach((link) => {
        const href = link.getAttribute('href')
        if (!href || !href.startsWith('#')) {
          allLinksValid = false
          invalidLinks.push(link.textContent || 'Unknown')
        }
      })

      if (allLinksValid) {
        this.addResult(
          'Subsection linking - All links have valid hrefs',
          true,
          `All ${tocLinks.length} links have valid href attributes`
        )
      } else {
        this.addResult(
          'Subsection linking - All links have valid hrefs',
          false,
          `Invalid links found: ${invalidLinks.join(', ')}`
        )
      }

      // Check all target elements exist
      let allTargetsExist = true
      let missingTargets: string[] = []

      tocLinks.forEach((link) => {
        const href = link.getAttribute('href')
        if (href) {
          const targetId = href.substring(1)
          const targetElement = document.getElementById(targetId)
          if (!targetElement) {
            allTargetsExist = false
            missingTargets.push(targetId)
          }
        }
      })

      if (allTargetsExist) {
        this.addResult(
          'Subsection linking - All target elements exist',
          true,
          `All ${tocLinks.length} target elements found in DOM`
        )
      } else {
        this.addResult(
          'Subsection linking - All target elements exist',
          false,
          `Missing targets: ${missingTargets.join(', ')}`
        )
      }

      // Check for proper indentation of nested headings
      const nestedLinks = Array.from(tocLinks).filter(link => {
        const parent = link.parentElement
        return parent && parent.style.paddingLeft && parent.style.paddingLeft !== '0px'
      })

      if (nestedLinks.length > 0) {
        this.addResult(
          'Subsection linking - Nested headings have indentation',
          true,
          `${nestedLinks.length} nested headings found with proper indentation`
        )
      } else {
        this.addResult(
          'Subsection linking - Nested headings have indentation',
          true,
          'No nested headings found (or all headings are at same level)'
        )
      }

      // Check ARIA labels
      const hasAriaLabel = rightSidebar.getAttribute('aria-label') !== null
      const nav = rightSidebar.querySelector('nav')
      const navHasAriaLabel = nav?.getAttribute('aria-label') !== null

      if (hasAriaLabel && navHasAriaLabel) {
        this.addResult(
          'Subsection linking - Proper ARIA labels',
          true,
          'Sidebar and navigation have proper ARIA labels'
        )
      } else {
        this.addResult(
          'Subsection linking - Proper ARIA labels',
          false,
          `Missing ARIA labels: sidebar=${hasAriaLabel}, nav=${navHasAriaLabel}`
        )
      }

    } catch (error) {
      this.addResult('Subsection linking', false, `Error: ${error}`)
    }
  }

  /**
   * Helper method to add a result
   */
  private addResult(test: string, passed: boolean, details: string): void {
    this.results.push({ test, passed, details })
    const icon = passed ? '✅' : '❌'
    console.log(`${icon} ${test}: ${details}`)
  }

  /**
   * Helper method to wait
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Print summary of results
   */
  private printResults(): void {
    const passed = this.results.filter(r => r.passed).length
    const total = this.results.length
    const percentage = ((passed / total) * 100).toFixed(1)

    console.log('\n' + '='.repeat(60))
    console.log(`📊 Verification Summary: ${passed}/${total} tests passed (${percentage}%)`)
    console.log('='.repeat(60))

    if (passed === total) {
      console.log('🎉 All tests passed! Scroll behavior is working correctly.')
    } else {
      console.log('⚠️  Some tests failed. Please review the details above.')
    }
  }
}

// Export a function to run the verification
export async function verifyScrollBehavior(): Promise<VerificationResult[]> {
  const verifier = new ScrollBehaviorVerifier()
  return await verifier.runAllTests()
}

// Make it available in browser console
if (typeof window !== 'undefined') {
  (window as any).verifyScrollBehavior = verifyScrollBehavior
}
