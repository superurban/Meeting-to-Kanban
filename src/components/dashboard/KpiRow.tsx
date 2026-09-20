import React from 'react';
import { Layers, CheckCircle2, Users, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Meeting } from '../../types';

interface KpiRowProps {
  meetings: Meeting[];
  currentMeeting: Meeting | null;
}

export const KpiRow: React.FC<KpiRowProps> = ({ meetings, currentMeeting }) => {
  // Aggregate stats across meetings or focus on active meeting if available
  const totalMeetings = meetings.length;
  
  const allTasks = meetings.flatMap((m) => m.tasks || []);
  const openTasks = allTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').length;
  const completedTasks = allTasks.filter((t) => t.status === 'done').length;
  const totalTasks = allTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Total recorded seconds across meetings
  const totalSeconds = meetings.reduce((acc, m) => acc + (m.durationSeconds || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  // Unique identified speakers across all meetings
  const uniqueSpeakers = new Set(
    meetings.flatMap((m) => (m.speakers || []).map((s) => s.assignedName || s.label))
  ).size;

  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 pt-5 pb-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Meetings */}
        <div className="kpi-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="kpi-label">Meetings Gesamt</span>
            <span className="badge-neutral text-[11px]">
              {totalMeetings === 1 ? '1 Sitzung' : `${totalMeetings} Sitzungen`}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="kpi-value">{totalMeetings}</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Lokal gesichert</span>
            </span>
          </div>
        </div>

        {/* KPI 2: Open Action Items */}
        <div className="kpi-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="kpi-label">Offene Aufgaben</span>
            <span className={openTasks > 0 ? 'badge-on-track' : 'badge-neutral'}>
              {openTasks > 0 ? 'In Bearbeitung' : 'Alles erledigt'}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="kpi-value">{openTasks}</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--status-on-track-text)]" />
              <span>von {totalTasks} Tasks</span>
            </span>
          </div>
        </div>

        {/* KPI 3: Completed Tasks & Rate */}
        <div className="kpi-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="kpi-label">Erledigungsquote</span>
            <span className="badge-on-track">
              {completionRate}% Fertig
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="kpi-value">{completedTasks}</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-on-track-text)]" />
              <span>Erledigt</span>
            </span>
          </div>
        </div>

        {/* KPI 4: Total Audio Minutes & Speakers */}
        <div className="kpi-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="kpi-label">Gesprächszeit & Stimmen</span>
            <span className="badge-neutral">
              {uniqueSpeakers} {uniqueSpeakers === 1 ? 'Sprecher' : 'Sprecher'}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="kpi-value">{totalMinutes} <span className="text-sm font-normal text-[var(--text-muted)]">Min.</span></span>
            <span className="text-xs text-[var(--text-secondary)] font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Audio erfasst</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
