import React, { useState } from 'react';
import { Plus, Search, Filter, Download, CheckCircle2, User, Sparkles, Copy, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Task, TaskStatus, Meeting, Speaker } from '../../types';
import { KanbanCard } from './KanbanCard';
import { TaskModal } from './TaskModal';

interface KanbanBoardProps {
  meeting: Meeting;
  tasks: Task[];
  speakers: Speaker[];
  onUpdateTasks: (tasks: Task[]) => void;
  onExtractTasksAgain: () => void;
  isExtracting: boolean;
}

const COLUMNS: Array<{ id: TaskStatus; label: string; color: string; badgeBg: string }> = [
  { id: 'backlog', label: 'Backlog', color: 'border-slate-700', badgeBg: 'bg-slate-800 text-slate-300' },
  { id: 'todo', label: 'Zu erledigen', color: 'border-blue-500/40', badgeBg: 'bg-blue-500/10 text-blue-300' },
  { id: 'in_progress', label: 'In Bearbeitung', color: 'border-amber-500/40', badgeBg: 'bg-amber-500/10 text-amber-300' },
  { id: 'done', label: 'Erledigt', color: 'border-emerald-500/40', badgeBg: 'bg-emerald-500/10 text-emerald-300' }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  meeting,
  tasks,
  speakers,
  onUpdateTasks,
  onExtractTasksAgain,
  isExtracting
}) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [mobileActiveColumn, setMobileActiveColumn] = useState<TaskStatus>('todo');

  // Collect unique assignees for filter
  const assignees = Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean)));

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: TaskStatus) => {
    if (!draggedTaskId) return;

    const task = tasks.find((t) => t.id === draggedTaskId);
    if (task && task.status !== status) {
      handleMoveStatus(draggedTaskId, status);
    }
    setDraggedTaskId(null);
  };

  const handleMoveStatus = (taskId: string, newStatus: TaskStatus) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, status: newStatus, updatedAt: new Date().toISOString() };
      }
      return t;
    });

    onUpdateTasks(updated);

    // Fire celebratory confetti when completing a task
    if (newStatus === 'done') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch {
        // fallback
      }
    }
  };

  const handleSaveTask = (savedTask: Task) => {
    const exists = tasks.some((t) => t.id === savedTask.id);
    let updated: Task[];
    if (exists) {
      updated = tasks.map((t) => (t.id === savedTask.id ? savedTask : t));
    } else {
      updated = [savedTask, ...tasks];
    }
    onUpdateTasks(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    onUpdateTasks(updated);
  };

  // Export as Markdown Protocol
  const handleExportMarkdown = () => {
    let md = `# Meeting-Protokoll & Aufgabenliste\n\n`;
    md += `**Meeting:** ${meeting.title}\n`;
    md += `**Datum:** ${new Date(meeting.date).toLocaleDateString('de-DE')}\n`;
    md += `**Teilnehmer:** ${speakers.map((s) => s.assignedName || s.label).join(', ')}\n\n`;
    md += `## Aufgaben & Next Steps (Kanban)\n\n`;

    COLUMNS.forEach((col) => {
      const colTasks = tasks.filter((t) => t.status === col.id);
      md += `### ${col.label} (${colTasks.length})\n`;
      if (colTasks.length === 0) {
        md += `*Keine Aufgaben*\n\n`;
      } else {
        colTasks.forEach((t) => {
          md += `- [${t.status === 'done' ? 'x' : ' '}] **${t.title}**\n`;
          md += `  - **Zuständig:** ${t.assignee}\n`;
          if (t.dueDate) md += `  - **Fällig:** ${t.dueDate}\n`;
          if (t.description) md += `  - **Kontext:** ${t.description}\n`;
        });
        md += `\n`;
      }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Meeting_${meeting.title.replace(/\s+/g, '_')}_Tasks.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesAssignee = filterAssignee === 'all' || t.assignee === filterAssignee;
    const matchesSearch =
      searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAssignee && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 pb-24 md:pb-8">
      {/* Control Bar: Filter, Search, New Task, Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Aufgaben durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Assignee Filter Dropdown */}
          <div className="relative flex items-center">
            <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs sm:text-sm rounded-xl pl-8 pr-6 py-1.5 border border-slate-700/80 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle Zuständigen ({tasks.length})</option>
              {assignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setSelectedTask(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-md shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Task anlegen</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            disabled={tasks.length === 0}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-xl border border-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
            title="Aufgabenliste als Markdown exportieren"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Mobile Column Tab Selector (< md breakpoint) */}
      <div className="md:hidden flex rounded-xl bg-slate-900 border border-slate-800 p-1">
        {COLUMNS.map((col) => {
          const count = filteredTasks.filter((t) => t.status === col.id).length;
          const isActive = mobileActiveColumn === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setMobileActiveColumn(col.id)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg text-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {col.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          const isHiddenOnMobile = mobileActiveColumn !== col.id;

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.id)}
              className={`bg-slate-900/60 border ${col.color} rounded-2xl p-3 sm:p-4 flex flex-col min-h-[480px] transition-colors ${
                draggedTaskId ? 'border-dashed' : ''
              } ${isHiddenOnMobile ? 'hidden md:flex' : 'flex'}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    {col.label}
                  </h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedTask({
                      id: `task_${Date.now()}`,
                      meetingId: meeting.id,
                      title: '',
                      assignee: speakers[0]?.assignedName || speakers[0]?.label || '',
                      dueDate: null,
                      description: '',
                      status: col.id,
                      priority: 'medium',
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    });
                    setIsModalOpen(true);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Aufgabe zu dieser Spalte hinzufügen"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-slate-800/60 rounded-xl flex items-center justify-center text-xs text-slate-500 italic">
                    Keine Aufgaben
                  </div>
                ) : (
                  colTasks.map((t) => (
                    <KanbanCard
                      key={t.id}
                      task={t}
                      onEdit={(task) => {
                        setSelectedTask(task);
                        setIsModalOpen(true);
                      }}
                      onMoveStatus={handleMoveStatus}
                      onDragStart={handleDragStart}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Edit/Create Modal */}
      <TaskModal
        isOpen={isModalOpen}
        task={selectedTask}
        meetingId={meeting.id}
        speakers={speakers}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
