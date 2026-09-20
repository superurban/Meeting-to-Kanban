import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Download, 
  User, 
  Sparkles, 
  FileText, 
  AlertCircle, 
  Volume2, 
  ArrowRight,
  CheckCircle2 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Task, TaskStatus, Meeting, Speaker, MeetingJob } from '../../types';
import { KanbanCard } from './KanbanCard';
import { TaskModal } from './TaskModal';
import { MeetingJobsList } from '../meetings/MeetingJobsList';

interface KanbanBoardProps {
  meeting: Meeting;
  tasks: Task[];
  speakers: Speaker[];
  jobs?: MeetingJob[];
  onUpdateTasks: (tasks: Task[]) => void;
  onExtractTasksAgain: () => void;
  isExtracting: boolean;
  taskAlertMessage?: string | null;
  onNavigateTab?: (tab: 'record' | 'transcript' | 'speakers' | 'kanban' | 'meetings') => void;
  onRequestClarification?: (speakerId: string) => void;
}

const COLUMNS: Array<{ id: TaskStatus; label: string; badgeClass: string }> = [
  { id: 'backlog', label: 'Backlog', badgeClass: 'badge-neutral' },
  { id: 'todo', label: 'Zu erledigen', badgeClass: 'badge-neutral' },
  { id: 'in_progress', label: 'In Bearbeitung', badgeClass: 'badge-at-risk' },
  { id: 'done', label: 'Erledigt', badgeClass: 'badge-on-track' }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  meeting,
  tasks,
  speakers,
  jobs = [],
  onUpdateTasks,
  onExtractTasksAgain,
  isExtracting,
  taskAlertMessage,
  onNavigateTab,
  onRequestClarification
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

    // Confetti on completing a task
    if (newStatus === 'done') {
      try {
        confetti({
          particleCount: 40,
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
    <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 py-5 space-y-4 pb-24 md:pb-8">
      {/* Background Processing Job List */}
      <MeetingJobsList jobs={jobs.filter((j) => j.meetingId === meeting.id)} />

      {/* Control Bar: Filter, Search, New Task, Export */}
      <div 
        className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-lg border shadow-[var(--shadow-subtle)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input (spacious & clean alignment) */}
          <div className="relative flex-1 min-w-[240px] sm:min-w-[300px] max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <input
              type="text"
              placeholder="Aufgaben filtern..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px' }}
              className="input-saas text-xs w-full h-9"
            />
          </div>

          {/* Assignee Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              aria-label="Nach Zuständigen filtern"
              className="input-saas text-xs py-1.5 px-3 min-w-[200px] sm:min-w-[240px] cursor-pointer font-medium"
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
            className="btn-primary text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Task anlegen</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            disabled={tasks.length === 0}
            className="btn-secondary text-xs"
            title="Aufgabenliste als Markdown exportieren"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>



      {/* Task Alert Message (e.g. from pipeline extraction) */}
      {taskAlertMessage && (
        <div 
          className="p-3.5 rounded-lg border flex items-start gap-3 animate-in fade-in"
          style={{
            backgroundColor: 'var(--status-neutral-bg)',
            borderColor: 'var(--status-neutral-border)'
          }}
        >
          <AlertCircle className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-medium text-[var(--text-primary)]">
              {taskAlertMessage}
            </p>
          </div>
        </div>
      )}



      {/* Mobile Column Tab Selector (< md breakpoint) */}
      <div 
        className="md:hidden flex rounded-lg border p-1"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        {COLUMNS.map((col) => {
          const count = filteredTasks.filter((t) => t.status === col.id).length;
          const isActive = mobileActiveColumn === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setMobileActiveColumn(col.id)}
              className={`flex-1 py-1.5 text-xs font-medium rounded text-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-[var(--text-primary)] text-[var(--bg-surface)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {col.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          const isHiddenOnMobile = mobileActiveColumn !== col.id;

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.id)}
              className={`rounded-lg p-3 sm:p-3.5 flex flex-col min-h-[480px] border transition-colors ${
                draggedTaskId ? 'border-dashed' : ''
              } ${isHiddenOnMobile ? 'hidden md:flex' : 'flex'}`}
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-color)'
              }}
            >
              {/* Column Header */}
              <div 
                className="flex items-center justify-between pb-2.5 mb-2.5 border-b"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                    {col.label}
                  </h3>
                  <span className={`${col.badgeClass} text-[11px] py-0 px-1.5 leading-tight`}>
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
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                  title="Aufgabe zu dieser Spalte hinzufügen"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-2.5 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div 
                    className="h-28 border border-dashed rounded-lg flex items-center justify-center text-xs italic"
                    style={{
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-muted)'
                    }}
                  >
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
