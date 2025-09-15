#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '../dist');

async function fixImports(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await fixImports(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const content = await readFile(fullPath, 'utf-8');

      // Fix relative imports by adding .js extension
      const fixedContent = content.replace(
        /from\s+['"](\.\S+?)['"];/g,
        (match, importPath) => {
          if (!importPath.endsWith('.js')) {
            return match.replace(importPath, `${importPath}.js`);
          }
          return match;
        }
      ).replace(
        /import\s*\(\s*['"](\.\S+?)['"]\s*\)/g,
        (match, importPath) => {
          if (!importPath.endsWith('.js')) {
            return match.replace(importPath, `${importPath}.js`);
          }
          return match;
        }
      );

      if (content !== fixedContent) {
        await writeFile(fullPath, fixedContent, 'utf-8');
        console.log(`Fixed imports in: ${fullPath}`);
      }
    }
  }
}

try {
  await fixImports(distDir);
  console.log('✅ Import paths fixed successfully');
} catch (error) {
  console.error('❌ Error fixing imports:', error);
  process.exit(1);
}