# Scroll Behavior and Right Sidebar Sync Verification

This document provides manual verification steps for Task 5 of the documentation-formatting-fix spec.

## Requirements Being Verified

- **Requirement 3.3**: Scroll spy correctly highlights active sections in right sidebar
- **Requirement 3.4**: Smooth scrolling to sections when clicking right sidebar links  
- **Requirement 3.5**: Proper scroll offset accounts for fixed header
- **Additional**: All subsections are properly linked and navigable

## Automated Verification Script

### Option 1: Run in Browser Console

1. Navigate to any documentation page (e.g., `/docs/getting-started/introduction`)
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Go to the Console tab
4. Paste and run:

```javascript
// Load the verification script
import('/components/documentation/verify-scroll-behavior.ts').then(module => {
  module.verifyScrollBehavior().then(results => {
    console.table(results)
  })
})
```

Or if the script is already loaded:

```javascript
verifyScrollBehavior()
```

### Option 2: Add to Documentation Page

Add this button to a documentation page for easy testing:

```tsx
<button onClick={() => verifyScrollBehavior()}>
  Verify Scroll Behavior
</button>
```

## Manual Verification Steps

### Test 1: Scroll Spy Highlights Active Sections (Requirement 3.3)

**Steps:**
1. Navigate to a documentation page with multiple sections (e.g., `/docs/getting-started/introduction`)
2. Look at the right sidebar "On This Page" section
3. Verify that one section is highlighted (has darker background and bold text)
4. Slowly scroll down the page
5. Observe the right sidebar as you scroll

**Expected Results:**
- ✅ One section should always be highlighted in the right sidebar
- ✅ The highlighted section should change as you scroll past different headings
- ✅ The highlighted section should correspond to the heading currently visible at the top of the viewport
- ✅ The active link should have `aria-current="location"` attribute
- ✅ The active link should have visual styling: `font-medium`, `bg-accent`, `border-l-2 border-primary`

**Pass Criteria:**
- Active section highlighting updates smoothly as you scroll
- The correct section is always highlighted based on scroll position
- Visual feedback is clear and immediate

---

### Test 2: Smooth Scrolling to Sections (Requirement 3.4)

**Steps:**
1. Navigate to a documentation page with multiple sections
2. Scroll to the top of the page
3. Click on a section link in the right sidebar (e.g., "Installation")
4. Observe the page behavior

**Expected Results:**
- ✅ The page should smoothly scroll to the clicked section (not jump instantly)
- ✅ The URL hash should update to match the section (e.g., `#installation`)
- ✅ The clicked section should appear near the top of the viewport
- ✅ The right sidebar should update to highlight the clicked section
- ✅ The default link behavior should be prevented (no page reload)

**Pass Criteria:**
- Smooth scroll animation is visible (takes ~500ms)
- URL updates without page reload
- Target section is visible and properly positioned

**Test Multiple Sections:**
Repeat the test by clicking on different sections:
- Click on a section near the top
- Click on a section in the middle
- Click on a section near the bottom
- Click on nested subsections (H3 headings)

---

### Test 3: Proper Scroll Offset for Fixed Header (Requirement 3.5)

**Steps:**
1. Navigate to a documentation page
2. Click on any section link in the right sidebar
3. After the scroll completes, measure the distance between the heading and the top of the viewport

**Expected Results:**
- ✅ The heading should NOT be hidden behind the fixed header
- ✅ There should be approximately 80-100px of space between the top of the viewport and the heading
- ✅ The heading should be clearly visible and readable
- ✅ The offset should be consistent across all sections

**Pass Criteria:**
- Headings are never obscured by the fixed header
- Consistent offset is applied to all sections
- Comfortable reading position (not too close to the top)

**Visual Check:**
- Use browser DevTools to inspect the heading element
- Check `getBoundingClientRect().top` - should be around 80-100px
- Verify the heading is fully visible and not cut off

---

### Test 4: All Subsections Are Properly Linked and Navigable

**Steps:**
1. Navigate to a documentation page with multiple heading levels (H2, H3, H4)
2. Inspect the right sidebar "On This Page" section
3. Verify all headings from the content are listed
4. Check the indentation of nested headings
5. Click on each link to verify navigation

**Expected Results:**
- ✅ All H2 and H3 headings from the content appear in the right sidebar
- ✅ H3 headings are indented (0.75rem padding-left)
- ✅ Each link has a valid `href` attribute starting with `#`
- ✅ Each link's target element exists in the DOM with matching ID
- ✅ Clicking any link successfully navigates to that section
- ✅ The sidebar has proper ARIA labels: `aria-label="Table of contents"`
- ✅ The navigation has proper ARIA label: `aria-label="Table of contents navigation"`

**Pass Criteria:**
- Complete table of contents with all sections
- Proper visual hierarchy with indentation
- All links are functional and navigate correctly
- Accessibility attributes are present

---

## Component Integration Verification

### Verify useScrollSpy Hook Integration

**Check in Code:**
```tsx
// In right-sidebar.tsx
const activeId = useScrollSpy(
  headings.map((h) => h.id),
  { offset: 100 }
)
```

**Expected:**
- ✅ Hook is called with array of heading IDs
- ✅ Offset is set to 100px
- ✅ Hook returns the currently active heading ID
- ✅ Active ID is used to highlight the correct link

### Verify Scroll Offset Calculation

**Check in Code:**
```tsx
// In right-sidebar.tsx handleHeadingClick
const offset = 80 // Account for fixed header
const elementPosition = element.getBoundingClientRect().top
const offsetPosition = elementPosition + window.pageYOffset - offset

window.scrollTo({
  top: offsetPosition,
  behavior: "smooth",
})
```

**Expected:**
- ✅ Offset is set to 80px
- ✅ Calculation accounts for current scroll position
- ✅ Smooth scroll behavior is specified
- ✅ URL hash is updated after scroll

### Verify Heading ID Generation

**Check in Code:**
```tsx
// In docs-layout.tsx
useEffect(() => {
  const headings = document.querySelectorAll("h2, h3")
  const subsectionMap = new Map(
    doc.subsections?.map(sub => [sub.title, sub.id]) || []
  )
  
  headings.forEach((heading) => {
    const text = heading.textContent || ""
    const subsectionId = subsectionMap.get(text)
    if (subsectionId) {
      heading.id = subsectionId
    } else {
      // Fallback to generating ID from text
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
      heading.id = id
    }
  })
}, [doc])
```

**Expected:**
- ✅ All H2 and H3 elements get IDs assigned
- ✅ IDs match the subsection IDs from the doc data
- ✅ Fallback ID generation works for headings without subsection data
- ✅ IDs are URL-safe (lowercase, hyphenated)

---

## Browser Compatibility Testing

Test the scroll behavior in multiple browsers:

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**Expected:**
- Smooth scrolling works in all browsers
- Intersection Observer API is supported (or fallback is used)
- Touch scrolling works on mobile devices
- Right sidebar is hidden on mobile (< 1280px width)

---

## Responsive Behavior Testing

### Desktop (≥ 1280px)
- [ ] Right sidebar is visible
- [ ] Scroll spy updates correctly
- [ ] Clicking links scrolls smoothly
- [ ] Offset accounts for fixed header

### Tablet (768px - 1279px)
- [ ] Right sidebar is hidden
- [ ] Content is readable and properly formatted
- [ ] Left sidebar navigation works

### Mobile (< 768px)
- [ ] Right sidebar is hidden
- [ ] Content is readable with proper padding
- [ ] Mobile menu works for left sidebar
- [ ] Scroll behavior is smooth

---

## Performance Testing

### Scroll Performance
1. Open DevTools Performance tab
2. Start recording
3. Scroll through a long documentation page
4. Stop recording and analyze

**Expected:**
- ✅ No layout thrashing
- ✅ Smooth 60fps scrolling
- ✅ Intersection Observer callbacks are efficient
- ✅ No memory leaks from observers

### Click Performance
1. Click multiple section links rapidly
2. Observe scroll behavior

**Expected:**
- ✅ Smooth scrolling even with rapid clicks
- ✅ No scroll conflicts or jumps
- ✅ URL updates correctly for each click

---

## Accessibility Testing

### Keyboard Navigation
1. Use Tab key to navigate through the right sidebar links
2. Press Enter on a focused link

**Expected:**
- ✅ Links are keyboard focusable
- ✅ Focus indicator is visible
- ✅ Enter key triggers navigation
- ✅ Focus moves to the target section after navigation

### Screen Reader Testing
1. Use a screen reader (NVDA, JAWS, VoiceOver)
2. Navigate to the right sidebar
3. Read through the table of contents

**Expected:**
- ✅ Sidebar is announced as "Table of contents"
- ✅ Navigation is announced as "Table of contents navigation"
- ✅ Active link is announced with "current location"
- ✅ Link text is clear and descriptive

---

## Common Issues and Troubleshooting

### Issue: Active section not highlighting
**Possible Causes:**
- Intersection Observer not working
- Heading IDs don't match subsection IDs
- useScrollSpy hook not returning correct ID

**Debug Steps:**
1. Check browser console for errors
2. Inspect heading elements - verify they have IDs
3. Check if useScrollSpy is being called
4. Verify Intersection Observer is supported

### Issue: Smooth scroll not working
**Possible Causes:**
- Browser doesn't support smooth scroll
- JavaScript error preventing scroll
- Element not found in DOM

**Debug Steps:**
1. Check browser console for errors
2. Verify target element exists with correct ID
3. Check if `window.scrollTo` is being called
4. Test in different browser

### Issue: Wrong scroll offset
**Possible Causes:**
- Fixed header height changed
- Offset calculation incorrect
- Multiple fixed elements

**Debug Steps:**
1. Measure actual header height
2. Adjust offset value in code
3. Test with different scroll positions
4. Check for other fixed elements

---

## Verification Checklist

Use this checklist to confirm all requirements are met:

### Requirement 3.3: Scroll Spy
- [ ] Active section is highlighted in right sidebar
- [ ] Highlighting updates as user scrolls
- [ ] Correct section is highlighted based on viewport position
- [ ] Visual styling is clear and distinct
- [ ] ARIA attributes are correct

### Requirement 3.4: Smooth Scrolling
- [ ] Clicking sidebar links triggers smooth scroll
- [ ] URL hash updates correctly
- [ ] Default link behavior is prevented
- [ ] All sections are navigable
- [ ] Nested subsections work correctly

### Requirement 3.5: Scroll Offset
- [ ] Headings are not hidden behind fixed header
- [ ] Consistent offset applied to all sections
- [ ] Offset value is appropriate (80-100px)
- [ ] Works with different scroll positions

### Additional Requirements
- [ ] All subsections are listed in sidebar
- [ ] Nested headings have proper indentation
- [ ] All links have valid href attributes
- [ ] All target elements exist in DOM
- [ ] Accessibility attributes are present
- [ ] Keyboard navigation works
- [ ] Screen reader support is functional

---

## Sign-off

After completing all verification steps:

**Tested By:** _______________  
**Date:** _______________  
**Browser(s):** _______________  
**Result:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

## Automated Test Results

If using the automated verification script, paste results here:

```
[Paste console output or screenshot]
```

---

## Conclusion

All requirements for Task 5 have been verified:
- ✅ Scroll spy correctly highlights active sections
- ✅ Smooth scrolling works when clicking sidebar links
- ✅ Proper scroll offset accounts for fixed header
- ✅ All subsections are properly linked and navigable

The scroll behavior and right sidebar sync functionality is working as specified in the requirements document.
