/**
 * Shared utilities, types, and constants for the Weft application.
 */

export const APP_NAME = 'Weft';

export interface AppConfig {
  name: string;
  version: string;
}

export const config: AppConfig = {
  name: APP_NAME,
  version: '0.0.1',
};

export function greet(name: string): string {
  return `Hello, ${name}!`;
}
