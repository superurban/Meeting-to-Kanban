import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Check, X } from 'lucide-react';

interface MeetingTitleSuggestModalProps {
  isOpen: boolean;
  meetingId: string;
  initialTitle: string;
  onSaveTitle: (meetingId: string, title: string) => void;
  onClose: () => void;
}

export const MeetingTitleSuggestModal: React.FC<MeetingTitleSuggestModalProps> = ({
  isOpen,
  meetingId,
  initialTitle,
  onSaveTitle,
  onClose
}) => {
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(initialTitle);
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, initialTitle]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = title.trim();
    if (trimmed) {
      onSaveTitle(meetingId, trimmed);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md p-5 rounded-xl border shadow-[var(--shadow-modal)] animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
        onKeyDown={handleKeyDown}
      >
        <div 
          className="flex items-center justify-between pb-3 mb-3.5 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Vorgeschlagener Meeting-Titel
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Du kannst den KI-Vorschlag übernehmen oder anpassen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Titel des Meetings:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting-Titel eingeben..."
              className="input-saas w-full text-sm py-2 px-3 font-medium"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
              Tipp: Drücke <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded">Enter</kbd> zum Übernehmen oder tippe direkt einen neuen Namen ein.
            </p>
          </div>

          <div 
            className="flex items-center justify-end gap-2 pt-3 border-t"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Titel speichern</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
