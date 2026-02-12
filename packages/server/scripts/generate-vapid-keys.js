#!/usr/bin/env node
/* global console */

/**
 * VAPID Key Generator for Weft Push Notifications
 *
 * Generates VAPID keys for Web Push notifications.
 * Run this script once during initial self-hosted deployment setup.
 *
 * Usage:
 *   node scripts/generate-vapid-keys.js
 *
 * Then add the output to your environment variables:
 *   VAPID_PUBLIC_KEY=xxx
 *   VAPID_PRIVATE_KEY=xxx
 *   VAPID_SUBJECT=mailto:your-email@example.com
 */

import webpush from 'web-push';

// Generate VAPID keys
const keys = webpush.generateVAPIDKeys();

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║               VAPID Keys for Weft Push Notifications              ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Add these to your environment variables or .env file:');
console.log('');
console.log('────────────────────────────────────────────────────────────────────');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:your-email@example.com');
console.log('────────────────────────────────────────────────────────────────────');
console.log('');
console.log('⚠️  IMPORTANT: Keep the private key secret! Never share it publicly.');
console.log('');
console.log('For Docker Compose, add these to your docker-compose.yml or .env:');
console.log('');
console.log('  environment:');
console.log('    VAPID_PUBLIC_KEY: ' + keys.publicKey);
console.log('    VAPID_PRIVATE_KEY: ' + keys.privateKey);
console.log('    VAPID_SUBJECT: mailto:your-email@example.com');
console.log('');
console.log('For direct deployment, set environment variables:');
console.log('');
console.log('  export VAPID_PUBLIC_KEY="' + keys.publicKey + '"');
console.log('  export VAPID_PRIVATE_KEY="' + keys.privateKey + '"');
console.log('  export VAPID_SUBJECT="mailto:your-email@example.com"');
console.log('');
