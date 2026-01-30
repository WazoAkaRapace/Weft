import { Outlet, useLocation } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { NotesProvider } from '../../contexts/NotesContext';

export function MainAppLayout() {
  const location = useLocation();
  const isNotesRoute = location.pathname.startsWith('/notes');

  // Extract noteId from URL if on notes route
  let noteId: string | undefined;
  if (isNotesRoute) {
    const match = location.pathname.match(/^\/notes\/([^/]+)$/);
    noteId = match?.[1];
  }

  const appLayout = <AppLayout><Outlet /></AppLayout>;

  return isNotesRoute ? <NotesProvider initialNoteId={noteId}>{appLayout}</NotesProvider> : appLayout;
}
