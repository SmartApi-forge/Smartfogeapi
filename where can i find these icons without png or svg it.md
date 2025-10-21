<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# where can i find these icons without png or svg it can be in lucid or same like this image

Based on your image showing file type icons (React, CSS, TypeScript, JS files), here are the best **component-based icon libraries** (no PNG/SVG imports needed) to get those file icons:

***

## **Best Options for File Type Icons (React Components)**

### **1. Lucide React (Recommended)**

Lucide has a `FileType` icon and various file-related icons as React components.[^1][^2][^3]

**Installation:**

```bash
npm install lucide-react
```

**Usage:**

```tsx
import { 
  FileType,      // Generic file type icon
  FileCode,      // Code file icon
  FileJson,      // JSON file icon
  FileText,      // Text file icon
  Braces         // CSS/config file
} from 'lucide-react';

<FileCode className="w-5 h-5 text-blue-500" />
<FileJson className="w-5 h-5 text-yellow-500" />
```

**Available File Icons in Lucide:**[^4][^1]

- `FileType` - Generic file type
- `FileCode` - Code files (tsx, ts, js)
- `FileJson` - JSON files
- `FileText` - Text files
- `Settings` - Config files (tsconfig, postcss)
- `Palette` - CSS files
- `File` - Generic file

***

### **2. React Icons (Most Comprehensive)**

React Icons includes **VSCode Icons** package which has the exact file type icons you're looking for.[^5][^6][^7]

**Installation:**

```bash
npm install react-icons
```

**Usage:**

```tsx
import { 
  VscFileCode,          // TypeScript/JS files
  VscJson,              // JSON files
  VscSettingsGear,      // Config files
  VscCss                // CSS files
} from 'react-icons/vsc';

// Or use other icon packs
import { 
  SiReact,              // React logo
  SiTypescript,         // TypeScript logo
  SiJavascript,         // JavaScript logo
  SiCss3,               // CSS logo
  SiTailwindcss         // Tailwind logo
} from 'react-icons/si'; // Simple Icons

<SiReact className="w-5 h-5 text-blue-400" />
<SiTypescript className="w-5 h-5 text-blue-600" />
```

**VSCode Icon Set Includes:**[^6][^7]

- 466 VSCode file type icons
- Matches the exact look of VSCode sidebar
- All major file extensions covered

***

### **3. File Icons Mapping Helper (Custom Solution)**

If you want dynamic icon assignment based on file extension:

```tsx
import { 
  FileCode, 
  FileJson, 
  Settings, 
  Palette,
  File 
} from 'lucide-react';
import { 
  SiReact, 
  SiTypescript, 
  SiJavascript,
  SiCss3,
  SiTailwindcss 
} from 'react-icons/si';

const fileIconMap: Record<string, React.ComponentType<any>> = {
  // Extensions
  '.tsx': SiReact,
  '.ts': SiTypescript,
  '.js': SiJavascript,
  '.jsx': SiReact,
  '.css': SiCss3,
  '.json': FileJson,
  
  // Specific files
  'tailwind.config.ts': SiTailwindcss,
  'postcss.config.js': Settings,
  'tsconfig.json': SiTypescript,
  'package.json': FileJson,
  'globals.css': SiCss3,
};

// Component to render file icon
export function FileIcon({ filename, className }: { filename: string; className?: string }) {
  const extension = filename.match(/\.\w+$/)?.[^0] || '';
  const Icon = fileIconMap[filename] || fileIconMap[extension] || File;
  
  return <Icon className={className} />;
}

// Usage
<FileIcon filename="badge.tsx" className="w-5 h-5 text-blue-400" />
<FileIcon filename="globals.css" className="w-5 h-5 text-blue-600" />
```


***

## **Comparison Table**

| Library | File Icons | Tech Logos | Tree-shakable | Bundle Size |
| :-- | :-- | :-- | :-- | :-- |
| **Lucide** | ✅ Generic | ❌ No | ✅ Yes | 🟢 Small |
| **React Icons (VSCode)** | ✅ Specific | ✅ Yes (SI) | ✅ Yes | 🟡 Medium |
| **React Icons (Simple)** | ❌ No | ✅ Yes | ✅ Yes | 🟡 Medium |
| **Phosphor Icons** | ✅ Generic | ❌ Limited | ✅ Yes | 🟢 Small |


***

## **Recommended Setup for Your Use Case**

Since you're building a file explorer similar to VSCode, use **React Icons** with both VSCode icons and Simple Icons:

```bash
npm install react-icons
```

```tsx
'use client';

import { 
  VscFile,
  VscFileCode,
  VscJson,
  VscCss,
  VscGear
} from 'react-icons/vsc';

import {
  SiReact,
  SiTypescript,
  SiJavascript,
  SiCss3,
  SiTailwindcss,
  SiPostcss
} from 'react-icons/si';

const getFileIcon = (filename: string) => {
  const map: Record<string, JSX.Element> = {
    // React/TS files
    'badge.tsx': <SiReact className="text-blue-400" />,
    'gradient-card.tsx': <SiReact className="text-blue-400" />,
    'progress.tsx': <SiReact className="text-blue-400" />,
    
    // Config files
    'tailwind.config.ts': <SiTailwindcss className="text-cyan-400" />,
    'postcss.config.js': <SiPostcss className="text-red-400" />,
    'tsconfig.json': <SiTypescript className="text-blue-600" />,
    'package.json': <VscJson className="text-yellow-500" />,
    
    // CSS
    'globals.css': <SiCss3 className="text-blue-500" />,
    
    // Utils
    'utils.ts': <SiTypescript className="text-blue-500" />,
  };

  return map[filename] || <VscFile className="text-gray-400" />;
};

// Usage in your file tree
export function FileTreeItem({ filename }: { filename: string }) {
  return (
    <div className="flex items-center gap-2">
      {getFileIcon(filename)}
      <span>{filename}</span>
    </div>
  );
}
```


***

## **Quick Links**

- **Lucide Icons Browser:** [lucide.dev/icons](https://lucide.dev/icons/)[^4]
- **React Icons Browser:** [react-icons.github.io](https://react-icons.github.io/react-icons/)[^6]
- **VSCode Icons Preview:** Check `react-icons/vsc`[^7][^6]
- **Simple Icons (Tech Logos):** `react-icons/si`[^6]

This gives you **all the file icons you need as React components** without any PNG/SVG imports.[^2][^5][^7][^6]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://lucide.dev/icons/file-type

[^2]: https://lucide.dev/guide/packages/lucide-react

[^3]: https://www.shadcn.io/icon/lucide-file-type

[^4]: https://lucide.dev/icons/

[^5]: https://www.npmjs.com/package/react-icons

[^6]: https://react-icons.github.io/react-icons/

[^7]: https://github.com/microsoft/vscode-icons

[^8]: image.jpg

[^9]: https://github.com/alan-crts/shadcn-iconpicker

[^10]: https://hugeicons.com/blog/development/top-5-react-icon-library

[^11]: https://github.com/lucide-icons/lucide/issues/1830

[^12]: https://lucide.dev/guide/packages/lucide

[^13]: https://www.reddit.com/r/reactjs/comments/16aif6u/any_vscode_extension_to_simplify_creating_react/

[^14]: https://ui.shadcn.com/docs/installation/manual

[^15]: https://github.com/lucide-icons/lucide

[^16]: https://code.visualstudio.com/blogs/2016/09/08/icon-themes

[^17]: https://ui.shadcn.com/docs/components/button

[^18]: https://code.visualstudio.com/brand

[^19]: https://ui.shadcn.com/docs/components/sonner

[^20]: https://ui.shadcn.com/docs/react-19

[^21]: https://www.youtube.com/watch?v=_ROI6t7cHQE

