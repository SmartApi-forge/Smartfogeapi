/**
 * Scroll Behavior and Right Sidebar Sync Tests
 * 
 * Tests for Requirements 3.3, 3.4, 3.5:
 * - Scroll spy correctly highlights active sections in right sidebar
 * - Smooth scrolling to sections when clicking right sidebar links
 * - Proper scroll offset accounts for fixed header
 * - All subsections are properly linked and navigable
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RightSidebar } from './right-sidebar'
import { Heading } from '@/lib/docs/types'
import '@testing-library/jest-dom'

// Mock the useScrollSpy hook
jest.mock('@/hooks/use-scroll-spy', () => ({
  useScrollSpy: jest.fn((headingIds: string[]) => {
    // Return the first heading as active by default
    return headingIds.length > 0 ? headingIds[0] : ''
  }),
}))

// Mock window.scrollTo
const mockScrollTo = jest.fn()
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: mockScrollTo,
})

// Mock window.history.pushState
const mockPushState = jest.fn()
Object.defineProperty(window, 'history', {
  writable: true,
  value: {
    pushState: mockPushState,
  },
})

describe('RightSidebar - Scroll Behavior', () => {
  const mockHeadings: Heading[] = [
    { id: 'introduction', text: 'Introduction', level: 2 },
    { id: 'features', text: 'Features', level: 2 },
    { id: 'feature-one', text: 'Feature One', level: 3 },
    { id: 'feature-two', text: 'Feature Two', level: 3 },
    { id: 'installation', text: 'Installation', level: 2 },
  ]

  beforeEach(() => {
    mockScrollTo.mockClear()
    mockPushState.mockClear()
    
    // Mock document.getElementById to return mock elements
    document.getElementById = jest.fn((id: string) => {
      const mockElement = document.createElement('div')
      mockElement.id = id
      mockElement.getBoundingClientRect = jest.fn(() => ({
        top: 100,
        bottom: 200,
        left: 0,
        right: 0,
        width: 0,
        height: 100,
        x: 0,
        y: 100,
        toJSON: () => {},
      }))
      return mockElement
    })
    
    // Mock window.pageYOffset
    Object.defineProperty(window, 'pageYOffset', {
      writable: true,
      value: 0,
    })
  })

  describe('Requirement 3.3: Scroll spy highlights active sections', () => {
    it('should highlight the active section in the right sidebar', () => {
      const { useScrollSpy } = require('@/hooks/use-scroll-spy')
      useScrollSpy.mockReturnValue('features')

      render(<RightSidebar headings={mockHeadings} />)

      const featuresLink = screen.getByText('Features')
      const introLink = screen.getByText('Introduction')

      // Active link should have specific styling
      expect(featuresLink).toHaveClass('text-foreground', 'font-medium')
      expect(featuresLink).toHaveAttribute('aria-current', 'location')
      
      // Inactive link should not have active styling
      expect(introLink).not.toHaveClass('font-medium')
      expect(introLink).not.toHaveAttribute('aria-current')
    })

    it('should update active section as scroll position changes', () => {
      const { useScrollSpy } = require('@/hooks/use-scroll-spy')
      
      // Initially active on introduction
      useScrollSpy.mockReturnValue('introduction')
      const { rerender } = render(<RightSidebar headings={mockHeadings} />)
      
      let introLink = screen.getByText('Introduction')
      expect(introLink).toHaveClass('font-medium')

      // Scroll to features section
      useScrollSpy.mockReturnValue('features')
      rerender(<RightSidebar headings={mockHeadings} />)
      
      const featuresLink = screen.getByText('Features')
      expect(featuresLink).toHaveClass('font-medium')
      expect(featuresLink).toHaveAttribute('aria-current', 'location')
    })

    it('should handle nested headings with proper indentation', () => {
      render(<RightSidebar headings={mockHeadings} />)

      const featureOne = screen.getByText('Feature One').parentElement
      const featureTwo = screen.getByText('Feature Two').parentElement
      
      // H3 headings should have indentation (level 3 - 2 = 1 * 0.75rem)
      expect(featureOne).toHaveStyle({ paddingLeft: '0.75rem' })
      expect(featureTwo).toHaveStyle({ paddingLeft: '0.75rem' })
    })
  })

  describe('Requirement 3.4: Smooth scrolling to sections', () => {
    it('should scroll smoothly when clicking a sidebar link', () => {
      render(<RightSidebar headings={mockHeadings} />)

      const featuresLink = screen.getByText('Features')
      fireEvent.click(featuresLink)

      // Should call scrollTo with smooth behavior
      expect(mockScrollTo).toHaveBeenCalledWith({
        top: expect.any(Number),
        behavior: 'smooth',
      })
    })

    it('should prevent default link behavior when clicking', () => {
      render(<RightSidebar headings={mockHeadings} />)

      const featuresLink = screen.getByText('Features')
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
      const preventDefaultSpy = jest.spyOn(clickEvent, 'preventDefault')
      
      featuresLink.dispatchEvent(clickEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should update URL hash when clicking a section link', () => {
      render(<RightSidebar headings={mockHeadings} />)

      const featuresLink = screen.getByText('Features')
      fireEvent.click(featuresLink)

      expect(mockPushState).toHaveBeenCalledWith(null, '', '#features')
    })

    it('should handle clicks on all subsections', () => {
      render(<RightSidebar headings={mockHeadings} />)

      mockHeadings.forEach((heading) => {
        const link = screen.getByText(heading.text)
        fireEvent.click(link)

        expect(mockScrollTo).toHaveBeenCalled()
        expect(mockPushState).toHaveBeenCalledWith(null, '', `#${heading.id}`)
      })
    })
  })

  describe('Requirement 3.5: Proper scroll offset for fixed header', () => {
    it('should apply correct offset when scrolling to sections', () => {
      render(<RightSidebar headings={mockHeadings} />)

      const featuresLink = screen.getByText('Features')
      fireEvent.click(featuresLink)

      // Should calculate position with 80px offset for fixed header
      // elementPosition (100) + pageYOffset (0) - offset (80) = 20
      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 20,
        behavior: 'smooth',
      })
    })

    it('should account for current scroll position when calculating offset', () => {
      // Set current scroll position
      Object.defineProperty(window, 'pageYOffset', {
        writable: true,
        value: 500,
      })

      render(<RightSidebar headings={mockHeadings} />)

      const featuresLink = screen.getByText('Features')
      fireEvent.click(featuresLink)

      // elementPosition (100) + pageYOffset (500) - offset (80) = 520
      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 520,
        behavior: 'smooth',
      })
    })

    it('should use consistent offset value across all sections', () => {
      render(<RightSidebar headings={mockHeadings} />)

      const expectedOffset = 80

      mockHeadings.forEach((heading) => {
        mockScrollTo.mockClear()
        const link = screen.getByText(heading.text)
        fireEvent.click(link)

        const callArgs = mockScrollTo.mock.calls[0][0]
        // Verify the offset is consistently applied
        // top = elementPosition + pageYOffset - offset
        // So offset = elementPosition + pageYOffset - top
        const calculatedOffset = 100 + 0 - callArgs.top
        expect(calculatedOffset).toBe(expectedOffset)
      })
    })
  })

  describe('Subsection linking and navigation', () => {
    it('should render all subsections as navigable links', () => {
      render(<RightSidebar headings={mockHeadings} />)

      mockHeadings.forEach((heading) => {
        const link = screen.getByText(heading.text)
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', `#${heading.id}`)
      })
    })

    it('should handle missing heading elements gracefully', () => {
      // Mock getElementById to return null for a specific heading
      const originalGetElementById = document.getElementById
      document.getElementById = jest.fn((id: string) => {
        if (id === 'features') {
          return null
        }
        return originalGetElementById.call(document, id)
      })

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      render(<RightSidebar headings={mockHeadings} />)

      const featuresLink = screen.getByText('Features')
      fireEvent.click(featuresLink)

      // Should log warning but not crash
      expect(consoleWarnSpy).toHaveBeenCalledWith('Heading with id "features" not found')
      expect(mockScrollTo).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should not render sidebar when no headings are provided', () => {
      const { container } = render(<RightSidebar headings={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should display "On This Page" heading', () => {
      render(<RightSidebar headings={mockHeadings} />)
      expect(screen.getByText('On This Page')).toBeInTheDocument()
    })

    it('should have proper ARIA labels for accessibility', () => {
      render(<RightSidebar headings={mockHeadings} />)

      const aside = screen.getByLabelText('Table of contents')
      expect(aside).toBeInTheDocument()

      const nav = screen.getByLabelText('Table of contents navigation')
      expect(nav).toBeInTheDocument()
    })
  })

  describe('Scroll spy hook integration', () => {
    it('should pass correct heading IDs to useScrollSpy', () => {
      const { useScrollSpy } = require('@/hooks/use-scroll-spy')
      
      render(<RightSidebar headings={mockHeadings} />)

      expect(useScrollSpy).toHaveBeenCalledWith(
        mockHeadings.map(h => h.id),
        { offset: 100 }
      )
    })

    it('should use offset of 100 for scroll spy', () => {
      const { useScrollSpy } = require('@/hooks/use-scroll-spy')
      
      render(<RightSidebar headings={mockHeadings} />)

      const callArgs = useScrollSpy.mock.calls[0]
      expect(callArgs[1]).toEqual({ offset: 100 })
    })
  })
})
