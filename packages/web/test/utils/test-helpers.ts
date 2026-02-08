import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { renderWithProviders } from './render-with-providers';

/**
 * Custom render function that wraps components with necessary providers
 * and automatically waits for loading states to resolve.
 */
export async function renderAndWait(
  ui: ReactElement,
  options?: Omit<Parameters<typeof renderWithProviders>[1], 'wrapper'>
) {
  const rendered = renderWithProviders(ui, options);

  // Wait for any pending promises to resolve
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  return rendered;
}

/**
 * Helper to simulate a delay (useful for testing debounced inputs)
 */
export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to create a mock function that tracks its calls
 */
export const createTrackedMock = () => {
  const calls: any[][] = [];
  const mock = (...args: any[]) => {
    calls.push(args);
  };
  mock.calls = calls;
  return mock;
};

/**
 * Helper to mock window.location
 */
export const mockLocation = (href: string) => {
  delete (window as any).location;
  (window as any).location = { href };
};

/**
 * Helper to mock console methods
 */
export const mockConsole = (method: 'error' | 'warn' | 'log' | 'info') => {
  const original = console[method];
  const mock = vi.fn();
  console[method] = mock;
  return {
    mock,
    restore: () => {
      console[method] = original;
    },
  };
};

/**
 * Helper to test accessibility attributes
 */
export const testAccessibility = (container: HTMLElement) => {
  const issues: string[] = [];

  // Check for images without alt text
  const images = container.querySelectorAll('img');
  images.forEach((img, index) => {
    if (!img.alt) {
      issues.push(`Image ${index} is missing alt text`);
    }
  });

  // Check for buttons without accessible labels
  const buttons = container.querySelectorAll('button');
  buttons.forEach((button, index) => {
    const hasLabel =
      button.textContent?.trim() ||
      button.getAttribute('aria-label') ||
      button.getAttribute('aria-labelledby');
    if (!hasLabel) {
      issues.push(`Button ${index} is missing an accessible label`);
    }
  });

  // Check for inputs without labels
  const inputs = container.querySelectorAll('input');
  inputs.forEach((input, index) => {
    const hasLabel =
      input.id && document.querySelector(`label[for="${input.id}"]`) ||
      input.getAttribute('aria-label') ||
      input.getAttribute('aria-labelledby');
    if (!hasLabel) {
      issues.push(`Input ${index} is missing an associated label`);
    }
  });

  return {
    issues,
    isValid: issues.length === 0,
  };
};

/**
 * Helper to test keyboard navigation
 */
export const testKeyboardNavigation = (
  element: HTMLElement,
  key: string,
  options: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean } = {}
) => {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrlKey || false,
    shiftKey: options.shiftKey || false,
    altKey: options.altKey || false,
    metaKey: options.metaKey || false,
    bubbles: true,
  });
  element.dispatchEvent(event);
  return event;
};

/**
 * Helper to create a mock ResizeObserver that triggers immediately
 */
export const createMockResizeObserver = () => {
  let callbacks: Array<() => void> = [];

  return {
    observe: vi.fn((target: Element, callback: () => void) => {
      callbacks.push(callback);
      // Trigger immediately
      setTimeout(() => {
        if (callback) callback();
      }, 0);
    }),
    unobserve: vi.fn((target: Element) => {
      callbacks = callbacks.filter(cb => cb !== target);
    }),
    disconnect: vi.fn(() => {
      callbacks = [];
    }),
    triggerAll: () => {
      callbacks.forEach(cb => cb());
    },
  };
};

/**
 * Helper to check if an element is visible to the user
 * Uses Testing Library's approach - checks if element is in the DOM and accessible
 * Note: This is a simplified check. For robust visibility testing, use user-centric queries instead.
 */
export const isVisible = (element: HTMLElement) => {
  // Element must be connected to DOM
  if (!element.isConnected) return false;

  // Element should not be hidden (most common cases)
  // This is intentionally simple - avoid CSS inspection when possible
  return element.offsetWidth > 0 && element.offsetHeight > 0;
};

/**
 * Helper to wait for an element to appear in the DOM
 */
export const waitForElement = (
  selector: string,
  options: { timeout?: number; container?: HTMLElement } = {}
) => {
  const { timeout = 1000, container = document.body } = options;

  return new Promise<HTMLElement>((resolve, reject) => {
    const element = container.querySelector(selector);
    if (element) {
      resolve(element as HTMLElement);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = container.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element as HTMLElement);
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
};

// Re-export renderWithProviders
export { renderWithProviders };
