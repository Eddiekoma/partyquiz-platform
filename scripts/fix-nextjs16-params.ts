#!/usr/bin/env tsx
/**
 * Fix Next.js 16 async params in all route handlers
 * 
 * Transforms:
 * { params }: { params: { id: string } }
 * → { params }: { params: Promise<{ id: string }> }
 * 
 * And adds await before params usage:
 * params.id → (await params).id
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import { join } from 'path';

const routeFiles = globSync('apps/web/src/app/api/**/route.ts', {
  cwd: join(process.cwd()),
  absolute: true,
});

console.log(`Found ${routeFiles.length} route files to process\n`);

let totalFixed = 0;

for (const file of routeFiles) {
  let content = readFileSync(file, 'utf-8');
  let modified = false;
  
  // Pattern 1: Single param { params: { id: string } }
  const singleParamPattern = /\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*(\w+):\s*string\s*\}\s*\}/g;
  if (content.match(singleParamPattern)) {
    content = content.replace(
      singleParamPattern,
      '{ params }: { params: Promise<{ $1: string }> }'
    );
    modified = true;
  }
  
  // Pattern 2: Multiple params { params: { id: string; quizId: string } }
  const multiParamPattern = /\{\s*params\s*\}:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g;
  if (content.match(multiParamPattern)) {
    content = content.replace(
      multiParamPattern,
      (match, paramList) => {
        return `{ params }: { params: Promise<{${paramList}}> }`;
      }
    );
    modified = true;
  }
  
  // Pattern 3: Add await to params usage - params.id → (await params).id
  // Only if not already awaited
  if (modified && !content.includes('await params')) {
    // Find first usage of params.something and add await
    content = content.replace(
      /(\n\s+)(const\s+\w+\s*=\s*)params\.(\w+)/,
      '$1const { $3 } = await params;\n$1$2$3'
    );
    
    // Replace remaining params.something with variable
    const paramNames = content.match(/const \{ (\w+(?:,\s*\w+)*) \} = await params/)?.[1];
    if (paramNames) {
      const names = paramNames.split(/,\s*/);
      names.forEach(name => {
        content = content.replace(new RegExp(`params\\.${name}\\b`, 'g'), name);
      });
    }
  }
  
  if (modified) {
    writeFileSync(file, content, 'utf-8');
    console.log(`✅ Fixed: ${file.replace(process.cwd(), '.')}`);
    totalFixed++;
  }
}

console.log(`\n✨ Fixed ${totalFixed} route files for Next.js 16 async params`);
