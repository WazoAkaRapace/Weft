import { useCallback, useEffect } from 'react';
import { NotePickerModal, type NotePickerSelection } from './shared';

interface NoteSelectorProps {
  selectedNoteIds: string[];
  onSelectionChange: (noteIds: string[]) => void;
  excludeIds?: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function NoteSelector({
  selectedNoteIds,
  onSelectionChange,
  excludeIds = [],
  isOpen,
  onClose,
}: NoteSelectorProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleConfirm = useCallback((selection: NotePickerSelection) => {
    // Filter out excluded IDs from the selection
    const filteredIds = selection.noteIds.filter(id => !excludeIds.includes(id));
    onSelectionChange(filteredIds);
    onClose();
  }, [excludeIds, onSelectionChange, onClose]);

  if (!isOpen) return null;

  return (
    <NotePickerModal
      isOpen={isOpen}
      onClose={onClose}
      selectedNoteIds={new Set(selectedNoteIds.filter(id => !excludeIds.includes(id)))}
      onConfirm={handleConfirm}
      mode="notes-only"
      variant="default"
      enableSearch={true}
      showAddedBadge={true}
      lazyLoad={true}
    />
  );
}
