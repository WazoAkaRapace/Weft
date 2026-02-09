export interface NavItem {
  path: string;
  label: string;
  icon: string;
  description?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navigationStructure: (NavItem | NavGroup)[] = [
  // Top-level items
  { path: '/dashboard', label: 'Dashboard', icon: '🏠', description: 'Home' },
  { path: '/notes', label: 'Notes', icon: '📝', description: 'Your notes' },

  // Journal group
  {
    title: 'Journal',
    items: [
      { path: '/record', label: 'New Recording', icon: '🎥', description: 'Create a new journal entry' },
      { path: '/history', label: 'History', icon: '📚', description: 'View past entries' },
      { path: '/mood-calendar', label: 'Mood Calendar', icon: '📅', description: 'Track your mood over time' },
    ],
  },
];
