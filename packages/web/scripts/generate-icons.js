/**
 * PWA Icon Generator Script
 *
 * This script generates PWA icons from the base SVG logo.
 *
 * Prerequisites:
 * - Node.js with sharp package: pnpm --filter @weft/web add -D sharp
 *
 * Usage:
 *   node scripts/generate-icons.js
 *
 * The script will generate icons in the following sizes:
 * - 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const INPUT_SVG = join(__dirname, '../public/logo-light.svg');
const OUTPUT_DIR = join(__dirname, '../public/icons');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateIcons() {
  console.log('Generating PWA icons...');

  for (const size of SIZES) {
    const outputPath = join(OUTPUT_DIR, `icon-${size}x${size}.png`);

    try {
      await sharp(INPUT_SVG)
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated ${size}x${size} icon`);
    } catch (error) {
      console.error(`✗ Failed to generate ${size}x${size} icon:`, error.message);
    }
  }

  console.log('Icon generation complete!');
}

// Generate shortcut icons (simplified versions)
async function generateShortcutIcons() {
  console.log('Generating shortcut icons...');

  // Record shortcut - red circle with white dot
  const recordIcon = `
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" rx="16" fill="#1A9E9E"/>
      <circle cx="48" cy="48" r="28" fill="white"/>
      <circle cx="48" cy="48" r="12" fill="#EF4444"/>
    </svg>
  `;

  // Notes shortcut - teal with white lines
  const notesIcon = `
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" rx="16" fill="#1A9E9E"/>
      <rect x="24" y="20" width="48" height="6" rx="3" fill="white"/>
      <rect x="24" y="32" width="36" height="6" rx="3" fill="white" opacity="0.7"/>
      <rect x="24" y="44" width="42" height="6" rx="3" fill="white"/>
      <rect x="24" y="56" width="30" height="6" rx="3" fill="white" opacity="0.7"/>
      <rect x="24" y="68" width="38" height="6" rx="3" fill="white"/>
    </svg>
  `;

  const shortcuts = [
    { name: 'record-shortcut', svg: recordIcon },
    { name: 'notes-shortcut', svg: notesIcon },
  ];

  for (const shortcut of shortcuts) {
    const outputPath = join(OUTPUT_DIR, `${shortcut.name}.png`);

    try {
      await sharp(Buffer.from(shortcut.svg))
        .resize(96, 96)
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated ${shortcut.name} icon`);
    } catch (error) {
      console.error(`✗ Failed to generate ${shortcut.name} icon:`, error.message);
    }
  }
}

// Run the generators
generateIcons()
  .then(() => generateShortcutIcons())
  .catch(console.error);
