import React from 'react';
import { Calendar, User, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
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

  const priorityConfig = {
    low: { bg: 'bg-slate-800 text-slate-400 border-slate-700', label: 'Niedrig' },
    medium: { bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30', label: 'Mittel' },
    high: { bg: 'bg-red-500/10 text-red-300 border-red-500/30', label: 'Hoch' }
  }[task.priority || 'medium'];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="group bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing relative flex flex-col justify-between gap-3 select-none"
    >
      <div>
        {/* Header: Priority & Quick Move Buttons */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${priorityConfig.bg}`}
          >
            {priorityConfig.label}
          </span>

          {/* Quick status mover (especially convenient for mobile touch screens) */}
          <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            {prevStatus && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveStatus(task.id, prevStatus);
                }}
                className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Eine Spalte nach links verschieben"
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
                className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Eine Spalte nach rechts verschieben"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Task Title (Clickable) */}
        <h4
          onClick={() => onEdit(task)}
          className="text-sm font-semibold text-slate-100 hover:text-blue-400 transition-colors cursor-pointer leading-snug"
        >
          {task.title}
        </h4>

        {/* Description / Next Steps Context */}
        {task.description && (
          <p
            onClick={() => onEdit(task)}
            className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed cursor-pointer"
          >
            {task.description}
          </p>
        )}
      </div>

      {/* Footer: Assignee & Due Date */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs flex-wrap">
        {/* Assignee */}
        <div className="flex items-center gap-1.5 text-slate-300 bg-slate-950/80 border border-slate-800 px-2 py-0.5 rounded-lg max-w-[140px] truncate">
          <User className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="font-medium truncate">{task.assignee}</span>
        </div>

        {/* Due Date */}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
            <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
            <span>{formatDate(task.dueDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
