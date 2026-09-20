import React from 'react';
import { Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Task, TaskStatus } from '../../types';
import { formatDate } from '../../utils/dateUtils';

interface KanbanCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onMoveStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}

const STATUS_ORDER: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'done'];

export const KanbanCard: React.FC<KanbanCardProps> = ({
  task,
  onEdit,
  onMoveStatus,
  onDragStart
}) => {
  const currentStatusIndex = STATUS_ORDER.indexOf(task.status);
  const prevStatus = currentStatusIndex > 0 ? STATUS_ORDER[currentStatusIndex - 1] : null;
  const nextStatus = currentStatusIndex < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentStatusIndex + 1] : null;

  const priorityBadge = {
    low: { className: 'badge-neutral', label: 'Niedrig' },
    medium: { className: 'badge-at-risk', label: 'Mittel' },
    high: { className: 'badge-off-track', label: 'Hoch' }
  }[task.priority || 'medium'];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="group card-saas p-3.5 hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing relative flex flex-col justify-between gap-2.5 select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)'
      }}
    >
      <div>
        {/* Header: Priority & Quick Move Buttons */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className={`${priorityBadge.className} text-[10px] py-0 px-1.5`}>
            {priorityBadge.label}
          </span>

          {/* Quick status mover */}
          <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            {prevStatus && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveStatus(task.id, prevStatus);
                }}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                title="Nach links verschieben"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {nextStatus && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveStatus(task.id, nextStatus);
                }}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                title="Nach rechts verschieben"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Task Title (Clickable) */}
        <h4
          onClick={() => onEdit(task)}
          className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer leading-snug"
        >
          {task.title}
        </h4>

        {/* Description / Next Steps Context */}
        {task.description && (
          <p
            onClick={() => onEdit(task)}
            className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed cursor-pointer"
          >
            {task.description}
          </p>
        )}
      </div>

      {/* Footer: Assignee & Due Date */}
      <div 
        className="pt-2 border-t flex items-center justify-between gap-2 text-xs flex-wrap"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {/* Assignee */}
        <div 
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md max-w-[130px] truncate border"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)'
          }}
        >
          <User className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
          <span className="font-medium text-[11px] truncate">{task.assignee}</span>
        </div>

        {/* Due Date */}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-[var(--text-muted)] font-mono text-[11px]">
            <Calendar className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
            <span>{formatDate(task.dueDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
