import type { ContextItem } from '../../hooks/useAIChat';
import type { Journal } from '@weft/shared';
import type { Note } from '@weft/shared';
import type { NoteTreeNode } from '../../hooks/useNotes';
import { NotePickerModal, type NotePickerSelection } from '../notes/shared';

interface ContextPickerModalProps {
  journals: Journal[];
  notes: Note[];
  noteTree: NoteTreeNode[];
  selected: ContextItem[];
  onSelect: (items: ContextItem[]) => void;
  onClose: () => void;
}

export function ContextPickerModal({
  journals,
  notes,
  noteTree,
  selected,
  onSelect,
  onClose,
}: ContextPickerModalProps) {
  const selectedNoteIds = new Set(selected.filter((item) => item.type === 'note').map((item) => item.id));
  const selectedJournalIds = new Set(
    selected.filter((item) => item.type === 'journal').map((item) => item.id)
  );

  const handleConfirm = (selection: NotePickerSelection) => {
    if (selection.contextItems && selection.contextItems.length > 0) {
      onSelect(selection.contextItems);
    }
    onClose();
  };

  return (
    <NotePickerModal
      isOpen={true}
      onClose={onClose}
      noteTree={noteTree}
      notes={notes}
      journals={journals}
      selectedNoteIds={selectedNoteIds}
      selectedJournalIds={selectedJournalIds}
      onConfirm={handleConfirm}
      mode="full"
      variant="default"
      enableShiftSelect={true}
      showAddedBadge={true}
    />
  );
}
