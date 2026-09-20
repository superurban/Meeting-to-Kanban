import React, { useState, useEffect } from 'react';
import { X, Calendar, User, AlignLeft, CheckSquare, Trash2, Tag } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, Speaker } from '../../types';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  meetingId: string;
  speakers: Speaker[];
  onSave: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  isOpen,
  meetingId,
  speakers,
  onSave,
  onDelete,
  onClose
}) => {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setAssignee(task.assignee);
      setDueDate(task.dueDate || '');
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
    } else {
      setTitle('');
      setAssignee(speakers[0]?.assignedName || speakers[0]?.label || '');
      setDueDate('');
      setDescription('');
      setStatus('todo');
      setPriority('medium');
    }
  }, [task, speakers, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const updatedTask: Task = {
      id: task?.id || `task_${Date.now()}`,
      meetingId,
      title: title.trim(),
      assignee: assignee.trim() || 'Unzugewiesen',
      dueDate: dueDate ? dueDate : null,
      description: description.trim(),
      status,
      priority,
      transcriptQuote: task?.transcriptQuote,
      createdAt: task?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(updatedTask);
    onClose();
  };

  const participantNames = speakers
    .map((s) => s.assignedName || s.label)
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="container-large max-w-lg w-full p-5 relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--shadow-modal)'
        }}
      >
        <div 
          className="flex items-center justify-between pb-3 mb-4 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe anlegen'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Titel der Aufgabe *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Cloudflare Pages Deployment konfigurieren"
              className="input-saas w-full"
            />
          </div>

          {/* Assignee & Due Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Zuständige Person</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Name eintragen"
                  list="participant-suggestions"
                  className="input-saas w-full"
                />
                <datalist id="participant-suggestions">
                  {participantNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Fälligkeitsdatum</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input-saas w-full"
              />
            </div>
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Status (Spalte)</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="input-saas w-full"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">Zu erledigen (To Do)</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="done">Erledigt (Done)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Priorität</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="input-saas w-full"
              >
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Beschreibung & Kontext der besprochenen Next Steps</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Welche konkreten Schritte wurden im Meeting vereinbart?"
              className="input-saas w-full resize-none"
            />
          </div>

          {/* Transcript quote reference if present */}
          {task?.transcriptQuote && (
            <div 
              className="p-3 rounded-lg border text-xs"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-color)'
              }}
            >
              <span className="font-medium text-[var(--text-muted)] block mb-1">
                Auszug aus dem Transkript:
              </span>
              <p className="italic text-[var(--text-secondary)]">"{task.transcriptQuote}"</p>
            </div>
          )}

          {/* Actions */}
          <div 
            className="flex items-center justify-between pt-3.5 border-t"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {task && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(task.id);
                  onClose();
                }}
                className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Task löschen</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn-primary text-xs"
              >
                Speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
