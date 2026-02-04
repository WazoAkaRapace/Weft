// DropdownMenu component - fixed menu item click handling
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
}

export function DropdownMenu({ trigger, items, align = 'left' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Prevent clicks on menu from propagating to elements underneath
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is on a menu item (by role attribute)
      const isClickOnMenuItem = (target as Element)?.closest?.('[role="menuitem"]');
      if (isClickOnMenuItem) {
        return; // Don't close the menu, let the menu item click handler run
      }

      // Check if click is outside trigger AND outside menu
      const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(target);
      const isOutsideMenu = menuRef.current && !menuRef.current.contains(target);

      if (isOpen && isOutsideTrigger && isOutsideMenu) {
        setIsOpen(false);
        setPosition(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setPosition(null);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isOpen) {
      setIsOpen(false);
      setPosition(null);
    } else if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (align === 'right') {
        setPosition({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      } else {
        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }
      setIsOpen(true);
    }
  };

  const handleItemClick = (item: DropdownMenuItem) => {
    item.onClick();
    setIsOpen(false);
    setPosition(null);
  };

  return (
    <div ref={triggerRef} className="relative">
      <div
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        role="button"
        tabIndex={0}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      {isOpen && position && createPortal(
        <div
          ref={(node) => {
            if (node) menuRef.current = node;
          }}
          onClick={handleMenuClick}
          className="fixed z-50 w-48 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg py-1"
          style={{
            top: `${position.top}px`,
            left: align === 'left' ? `${position.left}px` : undefined,
            right: align === 'right' ? `${position.right}px` : undefined,
          }}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                item.variant === 'danger'
                  ? 'text-error hover:bg-error-light dark:hover:bg-error-dark-light/30'
                  : 'text-neutral-700 dark:text-dark-200 hover:bg-neutral-100 dark:hover:bg-dark-700'
              }`}
              role="menuitem"
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
