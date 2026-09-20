import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Meeting } from '../../types';
import { formatTimestamp } from '../../utils/dateUtils';

interface DeleteConfirmModalProps {
  meeting: Meeting | null;
  isOpen: boolean;
  onConfirm: (meetingId: string) => void;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  meeting,
  isOpen,
  onConfirm,
  onClose
}) => {
  if (!isOpen || !meeting) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md p-6 container-large relative animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--shadow-modal)'
        }}
      >
        {/* Close icon button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          aria-label="Schließen"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'var(--status-off-track-bg)',
              color: 'var(--status-off-track-text)',
              border: '1px solid var(--status-off-track-border)'
            }}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Meeting unwiderruflich löschen?
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </div>
        </div>

        {/* Meeting Details Card */}
        <div 
          className="p-3.5 rounded-lg border mb-5 space-y-1.5"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-[var(--text-primary)] truncate">
              {meeting.title || 'Unbenanntes Meeting'}
            </span>
            <span className="badge-neutral text-[11px] shrink-0">
              {formatTimestamp(meeting.durationSeconds || 0)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{new Date(meeting.date).toLocaleDateString('de-DE')}</span>
            <span>•</span>
            <span>{meeting.speakers?.length || 0} Sprecher</span>
            <span>•</span>
            <span>{meeting.tasks?.length || 0} Aufgaben</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] pt-1 border-t border-[var(--border-color)]">
            Die Audio-Aufnahme, alle Segmente im Transkript sowie die zugeordneten Kanban-Tasks werden dauerhaft aus dem lokalen Speicher gelöscht.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(meeting.id);
              onClose();
            }}
            className="btn-danger"
          >
            <Trash2 className="w-4 h-4" />
            <span>Meeting löschen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
