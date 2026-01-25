import { describe, it, expect } from 'vitest';
import { greet, APP_NAME, config } from './index';

describe('shared', () => {
  it('should greet correctly', () => {
    expect(greet('World')).toBe('Hello, World!');
  });

  it('should have correct app name', () => {
    expect(APP_NAME).toBe('Weft');
  });

  it('should have config', () => {
    expect(config.name).toBe('Weft');
    expect(config.version).toBe('0.0.1');
  });
});
