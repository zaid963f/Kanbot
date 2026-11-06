import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../context/I18nContext';
import { useFadeOut } from '../hooks/useFadeOut';
import Icon from './Icon';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

// Uses the browser's <dialog>. showModal() keeps the keyboard focus inside
// the dialog, and the Esc key fires the "cancel" event.
// Fades in with CSS, and fades out with useFadeOut when it is removed.
export default function Modal({ title, onClose, children, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useFadeOut(dialogRef, true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={wide ? 'modal modal-wide' : 'modal'}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault(); // let onClose decide (e.g. "Discard changes?")
        onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button type="button" className="icon-button ghost" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
