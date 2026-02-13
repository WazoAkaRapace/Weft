import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useNotesContext } from '../../contexts/NotesContext';
import { useNavigationContext } from '../../contexts/NavigationContext';
import { NotesEditor, type NotesEditorRef } from './NotesEditor';
import { JournalLinker } from '../journal/JournalLinker';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { UpdateNoteData } from '../../hooks/useNotes';
import type { Journal } from '@weft/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function NoteEditorPanel() {
  const { getSelectedNote, updateNote } = useNotesContext();
  const { registerUnsavedChangesChecker } = useNavigationContext();
  const navigate = useNavigate();
  const selectedNote = getSelectedNote();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; right: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const notesEditorRef = useRef<NotesEditorRef>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);

  // Linked journals state
  const [linkedJournals, setLinkedJournals] = useState<Journal[]>([]);
  const [isJournalsLoading, setIsJournalsLoading] = useState(false);
  const [pendingJournalId, setPendingJournalId] = useState<string | null>(null);

  // Note icons
  const NOTE_ICONS = ['📝', '📁', '💡', '📌', '🎯', '🔖', '📋', '✨', '🚀', '💼', '📚', '🎨', '🔧', '💻', '📊', '🗂️'];

  // Note colors
  const NOTE_COLORS = [
    { name: 'Default', value: null },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
  ];

  useEffect(() => {
    if (selectedNote) {
      setTitleInput(selectedNote.note.title);
    }
  }, [selectedNote]);

  // Warn user when leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if there are unsaved changes
      const hasUnsaved = notesEditorRef.current?.hasUnsavedChanges();
      if (hasUnsaved) {
        // Show a warning dialog (browser-specific, can't be customized)
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Register a synchronous checker function for navigation warnings
  useEffect(() => {
    registerUnsavedChangesChecker(() => {
      return notesEditorRef.current?.hasUnsavedChanges() || false;
    });
  }, [registerUnsavedChangesChecker]);

  // Fetch linked journals
  const fetchLinkedJournals = useCallback(async () => {
    if (!selectedNote) return;
    setIsJournalsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/notes/${selectedNote.note.id}/journals`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLinkedJournals(data.journals);
      }
    } catch (err) {
      console.error('Failed to fetch linked journals:', err);
    } finally {
      setIsJournalsLoading(false);
    }
  }, [selectedNote]);

  // Link a journal to the note
  const handleLinkJournal = useCallback(async (journalId: string) => {
    if (!selectedNote) return;
    try {
      const response = await fetch(`${API_BASE}/api/notes/${selectedNote.note.id}/journals/${journalId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        await fetchLinkedJournals();
      }
    } catch (err) {
      console.error('Failed to link journal:', err);
    }
  }, [selectedNote, fetchLinkedJournals]);

  // Unlink a journal from the note
  const handleUnlinkJournal = useCallback(async (journalId: string) => {
    if (!selectedNote) return;
    try {
      const response = await fetch(`${API_BASE}/api/notes/${selectedNote.note.id}/journals/${journalId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        setLinkedJournals(prev => prev.filter(j => j.id !== journalId));
      }
    } catch (err) {
      console.error('Failed to unlink journal:', err);
    }
  }, [selectedNote]);

  // Handle journal click - check for unsaved changes before navigating
  const handleJournalClick = useCallback((journalId: string) => {
    const hasUnsavedChanges = notesEditorRef.current?.hasUnsavedChanges();
    if (hasUnsavedChanges) {
      setPendingJournalId(journalId);
    } else {
      navigate(`/journal/${journalId}`);
    }
  }, [navigate]);

  const confirmNavigate = useCallback(() => {
    if (pendingJournalId) {
      navigate(`/journal/${pendingJournalId}`);
      setPendingJournalId(null);
    }
  }, [pendingJournalId, navigate]);

  // Fetch linked journals when note changes
  useEffect(() => {
    fetchLinkedJournals();
  }, [fetchLinkedJournals]);

  const handleTitleSubmit = async () => {
    if (!selectedNote || !titleInput.trim()) return;

    setIsEditingTitle(false);

    const updateData: UpdateNoteData = {
      title: titleInput.trim(),
    };

    await updateNote(selectedNote.note.id, updateData);
  };

  const handleIconSelect = async (icon: string) => {
    if (!selectedNote) return;

    const updateData: UpdateNoteData = {
      icon,
    };

    await updateNote(selectedNote.note.id, updateData);
    setShowIconPicker(false);
  };

  const handleColorSelect = async (color: string | null) => {
    if (!selectedNote) return;

    const updateData: UpdateNoteData = {
      color,
    };

    await updateNote(selectedNote.note.id, updateData);
    setShowColorPicker(false);
    setColorPickerPosition(null);
  };

  const handleToggleColorPicker = () => {
    if (showColorPicker) {
      setShowColorPicker(false);
      setColorPickerPosition(null);
    } else if (colorButtonRef.current) {
      const rect = colorButtonRef.current.getBoundingClientRect();
      setColorPickerPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
      setShowColorPicker(true);
    }
  };

  const handleSaveClick = async () => {
    if (!selectedNote || isSaving) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      if (notesEditorRef.current) {
        await notesEditorRef.current.save();
      }
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }
  };

  const handleSaveContent = useCallback(
    async (content: string) => {
      if (!selectedNote) return;

      const updateData: UpdateNoteData = {
        content,
      };

      await updateNote(selectedNote.note.id, updateData);
    },
    [selectedNote, updateNote]
  );

  if (!selectedNote) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center text-neutral-500 dark:text-dark-400">
          <p>Select a note to edit</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col bg-white dark:bg-dark-800">
      {/* Header */}
      <div
        className="p-1.5 pt-5 sm:p-3 md:p-4 lg:p-6 border-b flex-shrink-0 relative"
        style={
          selectedNote.note.color
            ? {
                borderBottomColor: `${selectedNote.note.color}08`,
                background: `linear-gradient(to bottom, ${selectedNote.note.color}20 0%, ${selectedNote.note.color}08 100%)`,
              }
            : undefined
        }
      >

        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 md:gap-4 sm:overflow-hidden sm:min-w-0 relative z-50">
          {/* Top row on mobile: Icon, Title, Color, Edit/Save buttons */}
          <div className="flex items-center justify-between w-full sm:w-auto sm:hidden gap-1 pl-14">
            {/* Icon */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="text-2xl p-1 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                {selectedNote.note.icon}
              </button>

              {showIconPicker && (
                <div className="absolute z-50 mt-2 p-2 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg grid grid-cols-4 sm:grid-cols-8 gap-1 left-0 max-w-[calc(100vw-4rem)]">
                  {NOTE_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => handleIconSelect(icon)}
                      className={`p-1 text-lg rounded hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors ${
                        selectedNote.note.icon === icon ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title inline with buttons on mobile */}
            <div className="flex-1 min-w-0 px-2">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleTitleSubmit();
                    } else if (e.key === 'Escape') {
                      setTitleInput(selectedNote.note.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="w-full min-w-0 px-1 py-1 text-xl font-bold border border-neutral-200 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-900 text-neutral-900 dark:text-dark-50"
                  autoFocus
                />
              ) : (
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xl font-bold text-neutral-900 dark:text-dark-50 cursor-pointer hover:bg-neutral-50 dark:hover:bg-dark-700 px-1 py-1 rounded-lg transition-colors truncate"
                >
                  {selectedNote.note.title}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Color */}
              <div className="relative flex-shrink-0">
              <button
                ref={colorButtonRef}
                onClick={handleToggleColorPicker}
                className={`w-8 h-8 rounded border-2 border-neutral-200 dark:border-dark-600 transition-colors ${
                  selectedNote.note.color ? '' : 'bg-neutral-200 dark:bg-dark-700'
                }`}
                style={selectedNote.note.color ? { backgroundColor: selectedNote.note.color } : undefined}
              />

              {showColorPicker && colorPickerPosition && createPortal(
                <div className="fixed z-50 p-2 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg space-y-1 max-h-60 overflow-y-auto"
                     style={{ top: `${colorPickerPosition.top}px`, right: `${colorPickerPosition.right}px` }}>
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color.name}
                      onClick={() => handleColorSelect(color.value)}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors w-full"
                    >
                      {color.value ? (
                        <span
                          className="w-3 h-3 rounded border border-neutral-200 dark:border-dark-600 flex-shrink-0"
                          style={{ backgroundColor: color.value }}
                        />
                      ) : (
                        <span className="w-3 h-3 rounded border border-dashed border-neutral-200 dark:border-dark-600 flex-shrink-0" />
                      )}
                      <span className="text-neutral-700 dark:text-dark-200 truncate">{color.name}</span>
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>

            {/* Edit/View toggle */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 dark:border-dark-600 hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors flex-shrink-0"
              title={isEditing ? 'View mode' : 'Edit mode'}
            >
              {isEditing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              )}
            </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                    saveStatus === 'saved'
                      ? 'bg-success text-white'
                      : saveStatus === 'error'
                      ? 'bg-error text-white'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  title={saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Failed' : 'Save'}
                >
                  {saveStatus === 'saved' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : saveStatus === 'saving' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                      <circle cx="12" cy="12" r="10" opacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                  ) : saveStatus === 'error' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Desktop: Icon and Title side by side */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 overflow-hidden">
            {/* Icon */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="text-2xl sm:text-3xl md:text-4xl p-1 sm:p-2 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                {selectedNote.note.icon}
              </button>

              {showIconPicker && (
                <div className="absolute z-50 mt-2 p-2 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg grid grid-cols-4 sm:grid-cols-8 gap-1 left-0 max-w-[calc(100vw-4rem)]">
                  {NOTE_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => handleIconSelect(icon)}
                      className={`p-1 sm:p-2 text-lg sm:text-xl rounded hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors ${
                        selectedNote.note.icon === icon ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title */}
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleTitleSubmit();
                    } else if (e.key === 'Escape') {
                      setTitleInput(selectedNote.note.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="w-full min-w-0 px-2 sm:px-3 py-1 sm:py-2 text-xl sm:text-2xl font-bold border border-neutral-200 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-900 text-neutral-900 dark:text-dark-50"
                  autoFocus
                />
              ) : (
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-dark-50 cursor-pointer hover:bg-neutral-50 dark:hover:bg-dark-700 px-2 sm:px-3 py-1 sm:py-2 -ml-2 sm:-ml-3 rounded-lg transition-colors truncate"
                >
                  {selectedNote.note.title}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Color - desktop only */}
              <div className="relative flex-shrink-0 hidden sm:block">
              <button
                ref={colorButtonRef}
                onClick={handleToggleColorPicker}
                className={`w-8 h-8 rounded border-2 border-neutral-200 dark:border-dark-600 transition-colors ${
                  selectedNote.note.color ? '' : 'bg-neutral-200 dark:bg-dark-700'
                }`}
                style={selectedNote.note.color ? { backgroundColor: selectedNote.note.color } : undefined}
              />

              {showColorPicker && colorPickerPosition && createPortal(
                <div className="fixed z-50 p-2 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg space-y-1 max-h-60 overflow-y-auto"
                     style={{ top: `${colorPickerPosition.top}px`, right: `${colorPickerPosition.right}px` }}>
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color.name}
                      onClick={() => handleColorSelect(color.value)}
                      className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors w-full"
                    >
                      {color.value ? (
                        <span
                          className="w-3 h-3 sm:w-4 sm:h-4 rounded border border-neutral-200 dark:border-dark-600 flex-shrink-0"
                          style={{ backgroundColor: color.value }}
                        />
                      ) : (
                        <span className="w-3 h-3 sm:w-4 sm:h-4 rounded border border-dashed border-neutral-200 dark:border-dark-600 flex-shrink-0" />
                      )}
                      <span className="text-neutral-700 dark:text-dark-200 truncate">{color.name}</span>
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>

            {/* Edit/View toggle and Save buttons - desktop */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 dark:border-dark-600 hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors"
                title={isEditing ? 'View mode' : 'Edit mode'}
              >
                {isEditing ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                )}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  className={`h-8 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    saveStatus === 'saved'
                      ? 'bg-success text-white'
                      : saveStatus === 'error'
                      ? 'bg-error text-white'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  title={saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Failed' : 'Save'}
                >
                  {saveStatus === 'saved' ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Saved
                    </>
                  ) : saveStatus === 'saving' ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                        <circle cx="12" cy="12" r="10" opacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Saving...
                    </>
                  ) : saveStatus === 'error' ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Failed
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      Save
                    </>
                  )}
                </button>
              )}
            </div>
            </div>
          </div>
        </div>

      </div>

      {/* Content Editor */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <NotesEditor
          key={selectedNote.note.id}
          ref={notesEditorRef}
          notes={selectedNote.note.content}
          onSave={handleSaveContent}
          isEditing={isEditing}
          isSaving={isSaving}
        />
      </div>

      {/* Linked Journals */}
      <div className="border-t border-neutral-200 dark:border-dark-600 pt-4 px-4 sm:px-6 pb-4">
        <JournalLinker
          noteId={selectedNote.note.id}
          linkedJournals={linkedJournals}
          onLink={handleLinkJournal}
          onUnlink={handleUnlinkJournal}
          onJournalClick={handleJournalClick}
          isLoading={isJournalsLoading}
        />
      </div>
    </div>

    {pendingJournalId && (
      <ConfirmDialog
        isOpen={!!pendingJournalId}
        title="Unsaved Changes"
        message="You have unsaved changes. Do you want to leave anyway?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={confirmNavigate}
        onCancel={() => setPendingJournalId(null)}
      />
    )}
    </>
  );
}
