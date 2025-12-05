#!/usr/bin/env node

/**
 * Post-build script to add .js extensions to relative imports for ESM compatibility
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '../dist');

function hasIndexFile(dirPath) {
  try {
    const indexPath = join(dirPath, 'index.js');
    return statSync(indexPath).isFile();
  } catch {
    return false;
  }
}

function resolveImport(importPath, fromFile) {
  // Only process relative imports that don't already have extensions
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
    return null; // Not a relative import
  }

  // Skip if already has an extension
  if (importPath.match(/\.(js|mjs|cjs|json)$/)) {
    return null;
  }

  const fromDir = dirname(fromFile);
  const targetPath = join(fromDir, importPath);
  
  // Skip imports that go outside the dist directory (these are workspace package imports)
  // This handles workspace package imports that tsc-alias resolved to source paths
  // Also skip if the path contains '/src/' as it's pointing to source files in other packages
  if (!targetPath.startsWith(distDir) || importPath.includes('/src/')) {
    return null; // Goes outside dist directory or references source files, don't modify it
  }
  
  // Check if it's a file with .js extension
  const jsFile = targetPath + '.js';
  try {
    if (statSync(jsFile).isFile()) {
      return importPath + '.js';
    }
  } catch {
    // Not a .js file, check if it's a directory
  }

  // Check if it's a directory with index.js
  try {
    if (statSync(targetPath).isDirectory()) {
      if (hasIndexFile(targetPath)) {
        return importPath + '/index.js';
      }
    }
  } catch {
    // Doesn't exist
  }

  // Default: assume it's a .js file
  return importPath + '.js';
}

function processFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Match import/export statements with relative paths
  // Matches: from './something' or export ... from './something'
  const regex = /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g;
  
  const newContent = content.replace(regex, (match, prefix, importPath, suffix) => {
    const resolved = resolveImport(importPath, filePath);
    if (resolved && resolved !== importPath) {
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
  console.log('Fixing ESM imports in dist files...');
  const filesModified = walkDir(distDir);
  console.log(`✓ Fixed ESM imports in ${filesModified} file(s)`);
} catch (error) {
  console.error('Error fixing ESM imports:', error);
  process.exit(1);
}
