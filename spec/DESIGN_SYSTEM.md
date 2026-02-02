# WEFT Design System

**Version:** 1.0.0
**Last Updated:** 2025-02-02
**Status:** Active

This document defines the visual design language for WEFT - a video journaling application. All design and development work should follow these guidelines to maintain consistency across the application.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Dark Mode](#dark-mode)
7. [Accessibility](#accessibility)
8. [Implementation Guidelines](#implementation-guidelines)

---

## Design Philosophy

WEFT's design embodies these core principles:

- **Calm & Trustworthy**: Colors that encourage reflection without distraction
- **Privacy-Conscious**: A design that feels safe and secure for personal content
- **Focused**: Minimal visual noise to let users' content shine
- **Warm & Human**: Friendly aesthetics that feel personal, not clinical

### Visual Personality

| Trait | Description |
|-------|-------------|
| **Tone** | Gentle, supportive, non-intrusive |
| **Energy** | Calm and grounded, not high-energy or urgent |
| **Sophistication** | Modern but approachable, clean but not cold |
| **Character** | Trustworthy companion for personal reflection |

---

## Color Palette

### Primary Colors (Teal - Brand Color)

Teal represents trust, calm, and creativity - perfect for a journaling application.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary-50` | `#E6F7F7` | Lightest backgrounds, subtle highlights |
| `--color-primary-100` | `#B3E6E6` | Light hover states |
| `--color-primary-200` | `#80D4D4` | Soft borders, dividers |
| `--color-primary-300` | `#4DC2C2` | Medium UI elements |
| `--color-primary-400` | `#26B0B0` | Standard buttons, links |
| `--color-primary-500` | `#1A9E9E` | **Main brand color** (light mode) |
| `--color-primary-600` | `#178B8B` | Pressed state, hover |
| `--color-primary-700` | `#147878` | Dark accents |
| `--color-primary-800` | `#116565` | Darker variants |
| `--color-primary-900` | `#0E5252` | Darkest teal |

**Dark Mode Adjustment:** In dark mode, use `#3DC9C9` (primary-500 adjusted) as the main brand color for better visibility.

### Neutral Colors (Light Mode - Warm Gray)

Warm grays create a comfortable, inviting atmosphere for daytime journaling.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-neutral-50` | `#FAFAF9` | Page background |
| `--color-neutral-100` | `#F5F5F4` | Card background |
| `--color-neutral-200` | `#E7E5E4` | Subtle borders |
| `--color-neutral-300` | `#D6D3D1` | Dividers |
| `--color-neutral-400` | `#A8A29E` | Disabled text |
| `--color-neutral-500` | `#78716C` | Secondary text |
| `--color-neutral-600` | `#57534E` | Body text |
| `--color-neutral-700` | `#44403C` | Headings |
| `--color-neutral-800` | `#292524` | Dark text |
| `--color-neutral-900` | `#1C1917` | Darkest text |

### Dark Mode Colors (Cool Gray)

Cool grays in dark mode reduce eye strain for evening journaling sessions.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-dark-50` | `#FAFAFA` | Lightest text |
| `--color-dark-100` | `#F4F4F5` | Very light text |
| `--color-dark-200` | `#E4E4E7` | Light text |
| `--color-dark-300` | `#D4D4D8` | Secondary text |
| `--color-dark-400` | `#A1A1AA` | Muted text |
| `--color-dark-500` | `#71717A` | Disabled text |
| `--color-dark-600` | `#52525B` | Borders |
| `--color-dark-700` | `#3F3F46` | Card background |
| `--color-dark-800` | `#27272A` | Elevated surface |
| `--color-dark-900` | `#18181B` | Page background |

### Semantic Colors

#### Success (Green)
| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-success-light` | `#ECFDF5` | `#064E3B` | Background |
| `--color-success-main` | `#10B981` | `#34D399` | Main color |
| `--color-success-dark` | `#059669` | `#6EE7B7` | Hover state |
| `--color-success-text` | `#065F46` | `#A7F3D0` | Text on light bg |

#### Warning (Amber)
| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-warning-light` | `#FFFBEB` | `#78350F` | Background |
| `--color-warning-main` | `#F59E0B` | `#FBBF24` | Main color |
| `--color-warning-dark` | `#D97706` | `#FCD34D` | Hover state |
| `--color-warning-text` | `#92400E` | `#FDE68A` | Text on light bg |

#### Error (Red)
| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-error-light` | `#FEF2F2` | `#7F1D1D` | Background |
| `--color-error-main` | `#EF4444` | `#F87171` | Main color |
| `--color-error-dark` | `#DC2626` | `#FCA5A5` | Hover state |
| `--color-error-text` | `#991B1B` | `#FECACA` | Text on light bg |

#### Info (Blue)
| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-info-light` | `#EFF6FF` | `#1E3A8A` | Background |
| `--color-info-main` | `#3B82F6` | `#60A5FA` | Main color |
| `--color-info-dark` | `#2563EB` | `#93C5FD` | Hover state |
| `--color-info-text` | `#1E40AF` | `#BFDBFE` | Text on light bg |

### Emotion Colors

For journal entry mood tags and visualizations.

| Emotion | Color | Usage |
|---------|-------|-------|
| Happy | `#FDE047` | Positive, cheerful entries |
| Sad | `#60A5FA` | Melancholic, reflective entries |
| Angry | `#F87171` | Frustrated, intense entries |
| Fear | `#C084FC` | Anxious, uncertain entries |
| Surprise | `#FB923C` | Unexpected, novel entries |
| Disgust | `#86EFAC` | Averse, uncomfortable entries |
| Neutral | `#A1A1AA` | Calm, balanced entries |

### Shadow System

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | `0 4px 6px rgba(0,0,0,0.4)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | `0 10px 15px rgba(0,0,0,0.5)` | Modals, dropdowns |

---

## Typography

### Font Stack

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
```

Uses system fonts for optimal performance and native feel.

### Type Scale

| Element | Size | Weight | Line Height | Color |
|---------|------|--------|-------------|-------|
| **H1** | 2.25rem (36px) | 700 | 1.2 | `neutral-900` / `dark-50` |
| **H2** | 1.875rem (30px) | 600 | 1.3 | `neutral-900` / `dark-50` |
| **H3** | 1.5rem (24px) | 600 | 1.4 | `neutral-900` / `dark-50` |
| **H4** | 1.25rem (20px) | 600 | 1.5 | `neutral-900` / `dark-50` |
| **H5** | 1.125rem (18px) | 600 | 1.5 | `neutral-900` / `dark-50` |
| **H6** | 1rem (16px) | 600 | 1.5 | `neutral-500` / `dark-400` |
| **Body** | 1rem (16px) | 400 | 1.6 | `neutral-700` / `dark-200` |
| **Small** | 0.875rem (14px) | 400 | 1.5 | `neutral-500` / `dark-400` |
| **Caption** | 0.75rem (12px) | 400 | 1.4 | `neutral-400` / `dark-500` |

### Text Colors

| Purpose | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Primary text | `neutral-900` (`#1C1917`) | `dark-50` (`#FAFAFA`) |
| Secondary text | `neutral-500` (`#78716C`) | `dark-400` (`#A1A1AA`) |
| Tertiary text | `neutral-400` (`#A8A29E`) | `dark-500` (`#71717A`) |
| Links | `primary-500` (`#1A9E9E`) | `primary-500` adjusted (`#3DC9C9`) |

---

## Spacing & Layout

### Spacing Scale

Uses Tailwind's default spacing scale (4px base unit):

| Token | Value | Usage |
|-------|-------|-------|
| `0` | 0px | No spacing |
| `1` | 4px | Tight spacing |
| `2` | 8px | Compact spacing |
| `3` | 12px | Comfortable spacing |
| `4` | 16px | Standard spacing |
| `5` | 20px | Generous spacing |
| `6` | 24px | Section spacing |
| `8` | 32px | Large spacing |
| `10` | 40px | Extra large spacing |
| `12` | 48px | Component separation |

### Border Radius

| Size | Value | Usage |
|------|-------|-------|
| `sm` | 2px | Subtle rounding |
| `md` | 4px | Standard rounding (default) |
| `lg` | 8px | Cards, buttons |
| `xl` | 12px | Large cards |
| `2xl` | 16px | Modals, panels |
| `full` | 9999px | Pills, badges |

---

## Components

### Buttons

#### Primary Button

```tsx
<button className="px-6 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors">
  Action
</button>
```

**States:**
- Default: `primary-500` bg, white text
- Hover: `primary-600` bg
- Active: `primary-700` bg
- Disabled: 60% opacity

#### Secondary Button

```tsx
<button className="px-6 py-2 bg-neutral-100 dark:bg-dark-700 text-neutral-900 dark:text-dark-50 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-dark-600 transition-colors">
  Cancel
</button>
```

#### Danger Button

```tsx
<button className="px-6 py-2 bg-error text-white rounded-lg font-medium hover:bg-error-dark transition-colors">
  Delete
</button>
```

### Cards

```tsx
<div className="bg-white dark:bg-dark-800 rounded-lg p-6 shadow-md border border-neutral-200 dark:border-dark-600">
  {/* Card content */}
</div>
```

### Inputs

```tsx
<input
  className="w-full px-3 py-2 border border-neutral-200 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-800 text-neutral-900 dark:text-dark-50"
  placeholder="Enter text..."
/>
```

### Badges

```tsx
<span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
  Badge
</span>
```

---

## Dark Mode

### Implementation

Dark mode uses the `.dark` class on the document root. The ThemeProvider (`packages/web/src/contexts/ThemeContext.tsx`) manages theme state.

#### Theme Modes

- **Light**: Always light mode
- **Dark**: Always dark mode
- **System**: Follows OS preference

#### Switching Implementation

```tsx
const { theme, setTheme, effectiveTheme } = useTheme();

const cycleTheme = () => {
  if (theme === 'light') setTheme('dark');
  else if (theme === 'dark') setTheme('system');
  else setTheme('light');
};
```

#### Dark Mode Guidelines

1. **Always provide dark mode variants** for all new components
2. **Use semantic color tokens** rather than hardcoded values
3. **Test in both modes** during development
4. **Increase contrast** slightly in dark mode for better readability
5. **Use warmer whites** (`#FAFAFA`) instead of pure white for text

### Component Dark Mode Template

```tsx
<div className="bg-white dark:bg-dark-800 text-neutral-900 dark:text-dark-50 border border-neutral-200 dark:border-dark-600">
  {/* Content */}
</div>
```

---

## Accessibility

### Contrast Requirements

All color combinations meet WCAG 2.1 AA standards:

| Element | Minimum Ratio | Target Ratio |
|---------|---------------|--------------|
| Body text | 4.5:1 | 7:1 (AAA) |
| Large text (18px+) | 3:1 | 4.5:1 (AA) |
| UI components | 3:1 | 3:1 (AA) |

### Focus States

All interactive elements must have visible focus indicators:

```css
focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
```

### Screen Reader Support

- Use semantic HTML elements
- Provide `aria-label` for icon-only buttons
- Use `aria-live` for dynamic content updates
- Ensure keyboard navigation works throughout

### Color Independence

Never use color alone to convey meaning:
- Use icons + colors for status indicators
- Provide text labels for emotion colors
- Include borders or shapes in addition to colors

---

## Implementation Guidelines

### Tailwind Configuration

All design tokens are defined in `packages/web/tailwind.config.js`. When adding new colors:

1. Add to the appropriate color scale
2. Provide both light and dark mode variants
3. Update CSS variables if needed
4. Document in this spec

### CSS Variables

Core variables are defined in `packages/web/src/index.css`:

```css
:root {
  --color-bg-primary: var(--color-neutral-50);
  --color-text-primary: var(--color-neutral-900);
  --color-brand: var(--color-primary-500);
  /* ... */
}
```

Use these variables in custom CSS for consistency.

### Component Development

When creating new components:

1. **Use semantic colors** from the palette
2. **Support dark mode** from the start
3. **Test with real content** (long text, images, etc.)
4. **Check accessibility** with keyboard and screen reader
5. **Document props** with TypeScript interfaces

### Code Review Checklist

- [ ] Uses design system colors (no hardcoded colors)
- [ ] Supports dark mode (`dark:` classes)
- [ ] Meets contrast requirements
- [ ] Has proper focus states
- [ ] Uses semantic HTML
- [ ] Follows spacing guidelines
- [ ] Responsive design works on mobile

---

## Migration Guide

### Updating Existing Components

When updating components to use the new design system:

**Before (old colors):**
```tsx
<div className="bg-white dark:bg-background-card-dark border border-border dark:border-border-dark">
```

**After (new colors):**
```tsx
<div className="bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600">
```

### Common Color Mappings

| Old (Light) | Old (Dark) | New (Light) | New (Dark) |
|-------------|------------|-------------|------------|
| `#0066cc` | `#0066cc` | `primary-500` (`#1A9E9E`) | `primary-500` adjusted (`#3DC9C9`) |
| `#f5f5f5` | `#111827` | `neutral-50` (`#FAFAF9`) | `dark-900` (`#18181B`) |
| `#ffffff` | `#1f2937` | `neutral-100` (`#F5F5F4`) | `dark-800` (`#27272A`) |
| `#111` | `#f9fafb` | `neutral-900` (`#1C1917`) | `dark-50` (`#FAFAFA`) |
| `#666` | `#9ca3af` | `neutral-500` (`#78716C`) | `dark-400` (`#A1A1AA`) |
| `#ddd` | `#374151` | `neutral-200` (`#E7E5E4`) | `dark-600` (`#52525B`) |

---

## Design Resources

### Figma (if available)
- Link to design system file
- Component library
- Templates and examples

### Code References

- **Tailwind Config**: `packages/web/tailwind.config.js`
- **CSS Variables**: `packages/web/src/index.css`
- **Theme Context**: `packages/web/src/contexts/ThemeContext.tsx`
- **Example Components**: `packages/web/src/components/`

---

## Changelog

### Version 1.0.0 (2025-02-02)
- Initial design system release
- Defined color palette with teal brand color
- Established typography scale
- Created component guidelines
- Documented dark mode implementation
- Added accessibility standards

---

## Contributing

When proposing changes to the design system:

1. **Discuss with the team** before making changes
2. **Update this spec** alongside code changes
3. **Maintain backward compatibility** when possible
4. **Test across browsers and devices**
5. **Consider accessibility implications**

For questions about the design system, consult the team or create an issue.

---

**This design system is a living document. It should evolve as WEFT grows and changes.**
