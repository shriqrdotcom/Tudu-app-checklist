import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.local for local builds
config({ path: resolve(process.cwd(), '.env.local') });

/**
 * Generate a deterministic version hash for the service worker based on
 * the built asset files. This ensures the SW version changes on every
 * actual deployment, not on every browser launch.
 */
async function generateSWVersion() {
  const distDir = resolve(process.cwd(), 'dist');
  const swPath = resolve(distDir, 'sw.js');
  
  if (!existsSync(swPath)) {
    console.error('Service worker not found at', swPath);
    process.exit(1);
  }

  // Read all asset files in dist/assets to create a content-based hash
  const assetsDir = resolve(distDir, 'assets');
  let combinedContent = '';
  
  if (existsSync(assetsDir)) {
    const assetFiles = readdirSync(assetsDir)
      .filter(f => f.endsWith('.js') || f.endsWith('.css'))
      .sort(); // Deterministic order
    
    for (const file of assetFiles) {
      const filePath = resolve(assetsDir, file);
      combinedContent += readFileSync(filePath, 'utf-8');
    }
  }

  // Also include index.html for shell changes
  const indexPath = resolve(distDir, 'index.html');
  if (existsSync(indexPath)) {
    combinedContent += readFileSync(indexPath, 'utf-8');
  }

  // Generate short hash (first 8 chars of SHA256)
  const hash = createHash('sha256').update(combinedContent).digest('hex').slice(0, 8);
  const version = `v-${hash}`;

  // Read and update the service worker
  let swContent = readFileSync(swPath, 'utf-8');
  
  // Replace the version constant
  swContent = swContent.replace(
    /const VERSION = '[^']+';/,
    `const VERSION = '${version}';`
  );

  // Replace the VAPID public key placeholder if present
  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || '';
  if (vapidPublicKey) {
    swContent = swContent.replace(
      /const VAPID_PUBLIC_KEY = '__VAPID_PUBLIC_KEY__';/,
      `const VAPID_PUBLIC_KEY = '${vapidPublicKey}';`
    );
  }

  writeFileSync(swPath, swContent);
  console.log(`[SW] Updated version to ${version}`);
}

generateSWVersion().catch(err => {
  console.error('[SW] Version generation failed:', err);
  process.exit(1);
});