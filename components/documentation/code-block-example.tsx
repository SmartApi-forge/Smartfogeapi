/**
 * CodeBlock Usage Examples
 * 
 * This file demonstrates how to use the CodeBlock and CopyButton components
 * in your documentation pages.
 */

import { CodeBlock } from "./code-block"

export function CodeBlockExamples() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Basic TypeScript Example</h2>
        <CodeBlock
          code={`function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet("World");
console.log(message);`}
          language="typescript"
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Python with Filename</h2>
        <CodeBlock
          code={`def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

# Calculate the 10th Fibonacci number
result = calculate_fibonacci(10)
print(f"The 10th Fibonacci number is: {result}")`}
          language="python"
          filename="fibonacci.py"
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Bash Script with Line Numbers</h2>
        <CodeBlock
          code={`#!/bin/bash

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start`}
          language="bash"
          filename="deploy.sh"
          showLineNumbers={true}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">JSON Configuration</h2>
        <CodeBlock
          code={`{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "react": "^19.0.0",
    "next": "^15.0.0"
  }
}`}
          language="json"
          filename="package.json"
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">YAML Configuration</h2>
        <CodeBlock
          code={`name: CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test`}
          language="yaml"
          filename=".github/workflows/ci.yml"
        />
      </div>
    </div>
  )
}
