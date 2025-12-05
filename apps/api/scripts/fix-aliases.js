#!/usr/bin/env node

/**
 * Post-build script to replace TypeScript path aliases with relative paths
 * This is needed because tsc-alias doesn't work correctly with composite builds for apps
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = resolve(__dirname, '../dist');

// Path alias mappings: @/* -> relative paths from dist
function resolveAlias(alias, fromFile) {
  if (!alias.startsWith('@/')) {
    return null;
  }

  const aliasPath = alias.substring(2); // Remove '@/'
  const fromDir = dirname(fromFile);
  
  // Since baseUrl is ./src and outDir is ./dist, structure is preserved
  // @/app -> dist/app.js
  // @/services -> dist/services/index.js
  const targetBase = join(distDir, aliasPath);
  
  // Try to find the actual file
  let actualPath = null;
  
  // First try as direct file
  const directFile = targetBase + '.js';
  try {
    if (statSync(directFile).isFile()) {
      actualPath = directFile;
    }
  } catch {
    // Not a file, try as directory
    try {
      if (statSync(targetBase).isDirectory()) {
        const indexFile = join(targetBase, 'index.js');
        if (statSync(indexFile).isFile()) {
          actualPath = indexFile;
        }
      }
    } catch {
      // Doesn't exist
    }
  }
  
  if (!actualPath) {
    console.warn(`Warning: Could not resolve alias ${alias} from ${fromFile}`);
    return null;
  }
  
  // Calculate relative path and ensure it starts with ./
  let relativePath = relative(fromDir, actualPath);
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  // Replace backslashes with forward slashes for cross-platform compatibility
  relativePath = relativePath.replace(/\\/g, '/');
  
  return relativePath;
}

function processFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Match import/export statements with @/ aliases
  // This regex matches: from '@/something' or export ... from '@/something'
  const regex = /(from\s+['"])(@\/[^'"]+)(['"])/g;
  
  const newContent = content.replace(regex, (match, prefix, alias, suffix) => {
    const resolved = resolveAlias(alias, filePath);
    if (resolved) {
      modified = true;
      return prefix + resolved + suffix;
    }
    return match;
  });
  
  if (modified) {
    writeFileSync(filePath, newContent, 'utf8');
    return true;
  }
  
  return false;
}

function walkDir(dir) {
  const files = readdirSync(dir, { withFileTypes: true });
  let count = 0;
  
  for (const file of files) {
    const fullPath = join(dir, file.name);
    
    if (file.isDirectory()) {
      count += walkDir(fullPath);
    } else if (file.isFile() && file.name.endsWith('.js')) {
      if (processFile(fullPath)) {
        count++;
      }
    }
  }
  
  return count;
}

// Main execution
try {
  console.log('Fixing path aliases in dist files...');
  const filesModified = walkDir(distDir);
  console.log(`✓ Fixed path aliases in ${filesModified} file(s)`);
} catch (error) {
  console.error('Error fixing aliases:', error);
  process.exit(1);
}
