import type { ContextItem } from '../../hooks/useAIChat';
import type { Journal } from '@weft/shared';
import { NotePickerModal, type NotePickerSelection } from '../notes/shared';

interface ContextPickerModalProps {
  journals: Journal[];
  selected: ContextItem[];
  onSelect: (items: ContextItem[]) => void;
  onClose: () => void;
}

export function ContextPickerModal({
  journals,
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
      journals={journals}
      selectedNoteIds={selectedNoteIds}
      selectedJournalIds={selectedJournalIds}
      onConfirm={handleConfirm}
      mode="full"
      variant="default"
      enableShiftSelect={true}
      showAddedBadge={true}
      lazyLoad={true}
    />
  );
}
