/**
 * Usage Example for Custom MDX Components
 * 
 * This file demonstrates how to use the custom MDX components
 * in documentation files.
 */

// Example MDX content:
/*

# Documentation Page Title

This is a regular paragraph with **bold** and *italic* text.

## Using Callouts

<Callout type="info" title="Information">
  This is an informational callout. Use it to highlight important information.
</Callout>

<Callout type="warning" title="Warning">
  This is a warning callout. Use it to warn users about potential issues.
</Callout>

<Callout type="error" title="Error">
  This is an error callout. Use it to highlight errors or critical issues.
</Callout>

<Callout type="success" title="Success">
  This is a success callout. Use it to confirm successful operations.
</Callout>

## Using Tabs

<Tabs defaultValue="typescript">
  <TabsList>
    <TabsTrigger value="typescript">TypeScript</TabsTrigger>
    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
    <TabsTrigger value="python">Python</TabsTrigger>
  </TabsList>
  
  <TabsContent value="typescript">
    ```typescript
    const greeting: string = "Hello, World!";
    console.log(greeting);
    ```
  </TabsContent>
  
  <TabsContent value="javascript">
    ```javascript
    const greeting = "Hello, World!";
    console.log(greeting);
    ```
  </TabsContent>
  
  <TabsContent value="python">
    ```python
    greeting = "Hello, World!"
    print(greeting)
    ```
  </TabsContent>
</Tabs>

## Using Cards

<Card
  title="Getting Started"
  description="Learn the basics of SmartAPIForge"
  href="/docs/getting-started"
/>

<CardGrid cols={2}>
  <Card
    title="API Reference"
    description="Explore our comprehensive API documentation"
    href="/docs/api-reference"
  />
  <Card
    title="Guides"
    description="Step-by-step tutorials and guides"
    href="/docs/guides"
  />
</CardGrid>

## Code Examples

Inline code: `const x = 10;`

Code block:
```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet("World"));
```

*/

export const usageExample = `
# Documentation Page Title

This is a regular paragraph with **bold** and *italic* text.

## Using Callouts

<Callout type="info" title="Information">
  This is an informational callout. Use it to highlight important information.
</Callout>

<Callout type="warning" title="Warning">
  This is a warning callout. Use it to warn users about potential issues.
</Callout>

## Using Tabs

<Tabs defaultValue="typescript">
  <TabsList>
    <TabsTrigger value="typescript">TypeScript</TabsTrigger>
    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
  </TabsList>
  
  <TabsContent value="typescript">
    \`\`\`typescript
    const greeting: string = "Hello, World!";
    console.log(greeting);
    \`\`\`
  </TabsContent>
  
  <TabsContent value="javascript">
    \`\`\`javascript
    const greeting = "Hello, World!";
    console.log(greeting);
    \`\`\`
  </TabsContent>
</Tabs>

## Using Cards

<Card
  title="Getting Started"
  description="Learn the basics of SmartAPIForge"
  href="/docs/getting-started"
/>

<CardGrid cols={2}>
  <Card
    title="API Reference"
    description="Explore our comprehensive API documentation"
    href="/docs/api-reference"
  />
  <Card
    title="Guides"
    description="Step-by-step tutorials and guides"
    href="/docs/guides"
  />
</CardGrid>
`;
