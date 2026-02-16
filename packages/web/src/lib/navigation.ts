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
  { path: '/dashboard', label: 'Dashboard', icon: 'home', description: 'Home' },
  { path: '/notes', label: 'Notes', icon: 'note', description: 'Your notes' },
  { path: '/ai-chat', label: 'AI Chat', icon: 'ai', description: 'Chat with AI assistant' },

  // Journal group
  {
    title: 'Journal',
    items: [
      { path: '/record', label: 'New Recording', icon: 'recording', description: 'Create a new journal entry' },
      { path: '/history', label: 'History', icon: 'journal', description: 'View past entries' },
      { path: '/mood-calendar', label: 'Mood Calendar', icon: 'calendar', description: 'Track your mood over time' },
    ],
  },
];
