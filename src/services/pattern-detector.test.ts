/**
 * PatternDetector Unit Tests
 * 
 * Tests for the PatternDetector service to verify detection of
 * UI libraries, styling approaches, state management, and form handling.
 * 
 * Requirements: 7.1
 */

import { describe, it, expect } from 'vitest';
import { PatternDetector } from './pattern-detector';

describe('PatternDetector', () => {
  const patternDetector = new PatternDetector();

  describe('detectUILibrary', () => {
    it('should detect shadcn/ui from package.json and imports', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            '@radix-ui/react-dialog': '^1.0.0',
            'class-variance-authority': '^0.7.0',
          },
        }),
        'components/ui/button.tsx': `
          import { cva } from 'class-variance-authority';
          export const Button = () => <button>Click</button>;
        `,
      };

      const result = patternDetector.detectUILibrary(files);
      expect(result.detected).toBe('shadcn/ui');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Material UI from package.json and imports', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            '@mui/material': '^5.0.0',
            '@mui/icons-material': '^5.0.0',
          },
        }),
        'src/App.tsx': `
          import { Button } from '@mui/material';
          import { Add } from '@mui/icons-material';
        `,
      };

      const result = patternDetector.detectUILibrary(files);
      expect(result.detected).toBe('Material UI');
    });

    it('should detect Chakra UI from package.json and imports', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            '@chakra-ui/react': '^2.0.0',
          },
        }),
        'src/App.tsx': `
          import { Box, Button } from '@chakra-ui/react';
        `,
      };

      const result = patternDetector.detectUILibrary(files);
      expect(result.detected).toBe('Chakra UI');
    });

    it('should detect Ant Design from package.json and imports', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'antd': '^5.0.0',
          },
        }),
        'src/App.tsx': `
          import { Button, Table } from 'antd';
        `,
      };

      const result = patternDetector.detectUILibrary(files);
      expect(result.detected).toBe('Ant Design');
    });

    it('should detect Mantine from package.json and imports', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            '@mantine/core': '^7.0.0',
          },
        }),
        'src/App.tsx': `
          import { Button } from '@mantine/core';
        `,
      };

      const result = patternDetector.detectUILibrary(files);
      expect(result.detected).toBe('Mantine');
    });

    it('should detect Headless UI from package.json and imports', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            '@headlessui/react': '^1.0.0',
          },
        }),
        'src/App.tsx': `
          import { Dialog } from '@headlessui/react';
        `,
      };

      const result = patternDetector.detectUILibrary(files);
      expect(result.detected).toBe('Headless UI');
    });

    it('should return none when no UI library is detected', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'react': '^18.0.0',
          },
        }),
        'src/App.tsx': `
          export const App = () => <div>Hello</div>;
        `,
      };

      const result = patternDetector.detectUILibrary(files);
      expect(result.detected).toBe('none');
    });
  });

  describe('detectStyling', () => {
    it('should detect Tailwind CSS from config file and class usage', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          devDependencies: {
            'tailwindcss': '^3.0.0',
          },
        }),
        'tailwind.config.js': `
          module.exports = { content: ['./src/**/*.tsx'] };
        `,
        'src/App.tsx': `
          export const App = () => <div className="flex p-4 bg-blue-500">Hello</div>;
        `,
      };

      const result = patternDetector.detectStyling(files);
      expect(result.detected).toBe('Tailwind CSS');
    });

    it('should detect CSS Modules from imports and file patterns', () => {
      const files: Record<string, string> = {
        'src/App.tsx': `
          import styles from './App.module.css';
          export const App = () => <div className={styles.container}>Hello</div>;
        `,
        'src/App.module.css': `.container { display: flex; }`,
      };

      const result = patternDetector.detectStyling(files);
      expect(result.detected).toBe('CSS Modules');
    });

    it('should detect styled-components from package and usage', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'styled-components': '^6.0.0',
          },
        }),
        'src/App.tsx': `
          import styled from 'styled-components';
          const Container = styled.div\`display: flex;\`;
        `,
      };

      const result = patternDetector.detectStyling(files);
      expect(result.detected).toBe('styled-components');
    });

    it('should detect Emotion from package and usage', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            '@emotion/react': '^11.0.0',
            '@emotion/styled': '^11.0.0',
          },
        }),
        'src/App.tsx': `
          import { css } from '@emotion/react';
          import styled from '@emotion/styled';
        `,
      };

      const result = patternDetector.detectStyling(files);
      expect(result.detected).toBe('Emotion');
    });

    it('should detect Sass/SCSS from file patterns', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          devDependencies: {
            'sass': '^1.0.0',
          },
        }),
        'src/App.tsx': `
          import './App.scss';
        `,
        'src/App.scss': `.container { display: flex; }`,
      };

      const result = patternDetector.detectStyling(files);
      expect(result.detected).toBe('Sass/SCSS');
    });
  });

  describe('detectStateManagement', () => {
    it('should detect Zustand from package and usage', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'zustand': '^4.0.0',
          },
        }),
        'src/store.ts': `
          import { create } from 'zustand';
          export const useStore = create((set) => ({ count: 0 }));
        `,
      };

      const result = patternDetector.detectStateManagement(files);
      expect(result.detected).toBe('Zustand');
    });

    it('should detect Redux Toolkit from package and hooks', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            '@reduxjs/toolkit': '^1.0.0',
            'react-redux': '^8.0.0',
          },
        }),
        'src/App.tsx': `
          import { useSelector, useDispatch } from 'react-redux';
        `,
      };

      const result = patternDetector.detectStateManagement(files);
      expect(result.detected).toBe('Redux Toolkit');
    });

    it('should detect Jotai from package and usage', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'jotai': '^2.0.0',
          },
        }),
        'src/atoms.ts': `
          import { atom } from 'jotai';
          export const countAtom = atom(0);
        `,
        'src/App.tsx': `
          import { useAtom } from 'jotai';
        `,
      };

      const result = patternDetector.detectStateManagement(files);
      expect(result.detected).toBe('Jotai');
    });

    it('should detect Recoil from package and usage', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'recoil': '^0.7.0',
          },
        }),
        'src/atoms.ts': `
          import { atom } from 'recoil';
          export const countState = atom({ key: 'count', default: 0 });
        `,
        'src/App.tsx': `
          import { useRecoilState } from 'recoil';
        `,
      };

      const result = patternDetector.detectStateManagement(files);
      expect(result.detected).toBe('Recoil');
    });

    it('should detect TanStack Query from package and hooks', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            '@tanstack/react-query': '^5.0.0',
          },
        }),
        'src/App.tsx': `
          import { useQuery, useMutation } from '@tanstack/react-query';
        `,
      };

      const result = patternDetector.detectStateManagement(files);
      expect(result.detected).toBe('TanStack Query');
    });

    it('should detect React Context from usage patterns', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'react': '^18.0.0',
          },
        }),
        'src/context.tsx': `
          import { createContext, useContext } from 'react';
          export const MyContext = createContext(null);
        `,
      };

      const result = patternDetector.detectStateManagement(files);
      expect(result.detected).toBe('React Context');
    });
  });

  describe('detectFormLibrary', () => {
    it('should detect react-hook-form from package and usage', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'react-hook-form': '^7.0.0',
          },
        }),
        'src/Form.tsx': `
          import { useForm } from 'react-hook-form';
          const { register, handleSubmit } = useForm();
        `,
      };

      const result = patternDetector.detectFormLibrary(files);
      expect(result.detected).toBe('react-hook-form');
    });

    it('should detect Formik from package and usage', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'formik': '^2.0.0',
          },
        }),
        'src/Form.tsx': `
          import { useFormik, Formik } from 'formik';
        `,
      };

      const result = patternDetector.detectFormLibrary(files);
      expect(result.detected).toBe('Formik');
    });

    it('should detect Zod from package and usage', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            'zod': '^3.0.0',
          },
        }),
        'src/schema.ts': `
          import { z } from 'zod';
          export const userSchema = z.object({
            name: z.string(),
            email: z.string().email(),
          });
        `,
      };

      const result = patternDetector.detectFormLibrary(files);
      expect(result.detected).toBe('Zod');
    });
  });

  describe('detectPatterns', () => {
    it('should detect all patterns from a complete project', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({
          dependencies: {
            '@radix-ui/react-dialog': '^1.0.0',
            'class-variance-authority': '^0.7.0',
            'zustand': '^4.0.0',
            'react-hook-form': '^7.0.0',
          },
          devDependencies: {
            'tailwindcss': '^3.0.0',
          },
        }),
        'tailwind.config.js': `module.exports = { content: ['./src/**/*.tsx'] };`,
        'components/ui/button.tsx': `
          import { cva } from 'class-variance-authority';
          export const Button = () => <button className="flex p-4">Click</button>;
        `,
        'src/store.ts': `
          import { create } from 'zustand';
        `,
        'src/Form.tsx': `
          import { useForm } from 'react-hook-form';
        `,
      };

      const patterns = patternDetector.detectPatterns(files);
      
      expect(patterns.uiLibrary).toBe('shadcn/ui');
      expect(patterns.styling).toBe('Tailwind CSS');
      expect(patterns.stateManagement).toBe('Zustand');
      expect(patterns.formLibrary).toBe('react-hook-form');
    });

    it('should detect common components from file paths', () => {
      const files: Record<string, string> = {
        'package.json': '{}',
        'components/ui/button.tsx': 'export const Button = () => null;',
        'components/ui/input.tsx': 'export const Input = () => null;',
        'components/ui/card.tsx': 'export const Card = () => null;',
        'components/ui/dialog.tsx': 'export const Dialog = () => null;',
        'components/header.tsx': 'export const Header = () => null;',
        'components/footer.tsx': 'export const Footer = () => null;',
        'components/sidebar.tsx': 'export const Sidebar = () => null;',
      };

      const patterns = patternDetector.detectPatterns(files);
      
      expect(patterns.commonComponents).toContain('Button');
      expect(patterns.commonComponents).toContain('Input');
      expect(patterns.commonComponents).toContain('Card');
      expect(patterns.commonComponents).toContain('Dialog');
      expect(patterns.commonComponents).toContain('Header');
      expect(patterns.commonComponents).toContain('Footer');
      expect(patterns.commonComponents).toContain('Sidebar');
    });

    it('should detect import alias patterns', () => {
      const files: Record<string, string> = {
        'package.json': '{}',
        'src/App.tsx': `
          import { Button } from '@/components/ui/button';
          import { useStore } from '@lib/store';
          import { cn } from '@utils/cn';
        `,
      };

      const patterns = patternDetector.detectPatterns(files);
      
      expect(patterns.importPatterns).toContain('@/');
      expect(patterns.importPatterns).toContain('@lib/');
      expect(patterns.importPatterns).toContain('@utils/');
    });

    it('should return none for all categories when project is empty', () => {
      const files: Record<string, string> = {
        'package.json': JSON.stringify({ dependencies: {} }),
      };

      const patterns = patternDetector.detectPatterns(files);
      
      expect(patterns.uiLibrary).toBe('none');
      expect(patterns.styling).toBe('none');
      expect(patterns.stateManagement).toBe('none');
      expect(patterns.formLibrary).toBe('none');
      expect(patterns.commonComponents).toHaveLength(0);
      expect(patterns.importPatterns).toHaveLength(0);
    });
  });
});
