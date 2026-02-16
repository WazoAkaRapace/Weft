import { useTheme } from '../../contexts/ThemeContext';

export type IconName =
  | 'home' | 'note' | 'ai' | 'recording' | 'journal'
  | 'calendar' | 'search' | 'settings' | 'theme'
  | 'theme-system' | 'user' | 'logout';

interface ThemeIconProps {
  name: IconName;
  alt?: string;
  className?: string;
  size?: number;
}

export function ThemeIcon({ name, alt = '', className = '', size = 34 }: ThemeIconProps) {
  const { effectiveTheme } = useTheme();
  const variant = effectiveTheme === 'dark' ? 'dark' : 'light';
  const src = `/icons/${name}-${variant}.svg`;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={size}
      height={size}
    />
  );
}
