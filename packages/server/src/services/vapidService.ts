/**
 * VAPID Key Management Service
 *
 * Handles VAPID key generation, storage, and initialization for Web Push notifications.
 * Supports both environment variable configuration and database storage for self-hosted deployments.
 */

import webpush from 'web-push';
import { db } from '../db/index.js';
import { vapidConfig } from '../db/schema.js';

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let isInitialized = false;

/**
 * Initialize VAPID keys from environment or database
 * Should be called on server startup
 */
export async function initializeVapid(): Promise<VapidKeys | null> {
  if (isInitialized) {
    return getStoredKeys();
  }

  // Try to get from environment first (for Docker deployment)
  const envPublicKey = process.env.VAPID_PUBLIC_KEY;
  const envPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@weft.local';

  if (envPublicKey && envPrivateKey) {
    console.log('[VAPID] Using keys from environment variables');
    webpush.setVapidDetails(vapidSubject, envPublicKey, envPrivateKey);
    isInitialized = true;
    return { publicKey: envPublicKey, privateKey: envPrivateKey };
  }

  // Try to get from database
  const existingConfig = await db.select().from(vapidConfig).limit(1);

  if (existingConfig.length > 0) {
    const config = existingConfig[0];
    console.log('[VAPID] Using keys from database');
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    isInitialized = true;
    return { publicKey: config.publicKey, privateKey: config.privateKey };
  }

  // Generate new keys (first-time setup)
  console.log('[VAPID] Generating new VAPID keys...');
  const keys = webpush.generateVAPIDKeys();

  await db.insert(vapidConfig).values({
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject: vapidSubject,
  });

  webpush.setVapidDetails(vapidSubject, keys.publicKey, keys.privateKey);
  isInitialized = true;

  console.log('[VAPID] Generated new VAPID keys.');
  console.log('');
  console.log('=== IMPORTANT: For production deployment ===');
  console.log('Add these to your environment variables:');
  console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
  console.log(`VAPID_SUBJECT=${vapidSubject}`);
  console.log('');

  return keys;
}

/**
 * Get public key for client subscription
 */
export async function getVapidPublicKey(): Promise<string | null> {
  // Check environment first
  const envPublicKey = process.env.VAPID_PUBLIC_KEY;
  if (envPublicKey) {
    return envPublicKey;
  }

  // Check database
  const config = await db.select().from(vapidConfig).limit(1);
  return config.length > 0 ? config[0].publicKey : null;
}

/**
 * Get stored keys (without initialization)
 */
async function getStoredKeys(): Promise<VapidKeys | null> {
  const envPublicKey = process.env.VAPID_PUBLIC_KEY;
  const envPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (envPublicKey && envPrivateKey) {
    return { publicKey: envPublicKey, privateKey: envPrivateKey };
  }

  const config = await db.select().from(vapidConfig).limit(1);
  if (config.length > 0) {
    return { publicKey: config[0].publicKey, privateKey: config[0].privateKey };
  }

  return null;
}

/**
 * Get the webpush instance (for sending notifications)
 */
export function getWebPush(): typeof webpush {
  if (!isInitialized) {
    throw new Error('VAPID not initialized. Call initializeVapid() first.');
  }
  return webpush;
}
