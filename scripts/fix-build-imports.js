#!/usr/bin/env node

/**
 * Post-build script to fix imports for ESM compatibility
 * - Adds .js extensions to relative imports
 * - Replaces @/ path aliases with relative paths (for apps)
 * 
 * Usage: node scripts/fix-build-imports.js [distDir] [--fix-aliases]
 *   distDir: Path to dist directory (default: ./dist relative to package root)
 *   --fix-aliases: Also fix @/ path aliases (for apps)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get dist directory from args or use default
const args = process.argv.slice(2);
const fixAliases = args.includes('--fix-aliases');
const distDirArg = args.find(arg => !arg.startsWith('--'));

// If called from a package, resolve relative to that package's root
// Otherwise use the provided path or default to ./dist
let distDir;
if (distDirArg) {
  distDir = resolve(process.cwd(), distDirArg);
} else {
  // Try to find dist relative to current working directory
  distDir = resolve(process.cwd(), 'dist');
}

function hasIndexFile(dirPath) {
  try {
    const indexPath = join(dirPath, 'index.js');
    return statSync(indexPath).isFile();
  } catch {
    return false;
  }
}

function resolveAlias(alias, fromFile) {
  if (!alias.startsWith('@/')) {
    return null;
  }

  const aliasPath = alias.substring(2); // Remove '@/'
  const fromDir = dirname(fromFile);
  
  // Since baseUrl is ./src and outDir is ./dist, structure is preserved
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
  
  let newContent = content;
  
  // Fix path aliases if requested
  if (fixAliases) {
    const aliasRegex = /(from\s+['"])(@\/[^'"]+)(['"])/g;
    newContent = newContent.replace(aliasRegex, (match, prefix, alias, suffix) => {
      const resolved = resolveAlias(alias, filePath);
      if (resolved) {
        modified = true;
        return prefix + resolved + suffix;
      }
      return match;
    });
  }
  
  // Fix relative imports (add .js extensions)
  const importRegex = /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g;
  newContent = newContent.replace(importRegex, (match, prefix, importPath, suffix) => {
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
  const action = fixAliases ? 'path aliases and ESM imports' : 'ESM imports';
  console.log(`Fixing ${action} in dist files...`);
  const filesModified = walkDir(distDir);
  console.log(`✓ Fixed ${action} in ${filesModified} file(s)`);
} catch (error) {
  console.error('Error fixing imports:', error);
  process.exit(1);
}
