import React, { useState } from 'react';
import { 
  FolderOpen, 
  Search, 
  Trash2, 
  Plus, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { Meeting } from '../../types';
import { formatTimestamp } from '../../utils/dateUtils';
import { AppTab } from '../layout/Navigation';

interface MeetingsManagerViewProps {
  meetings: Meeting[];
  currentMeetingId: string | null;
  onSelectMeeting: (id: string) => void;
  onRequestDeleteMeeting: (meeting: Meeting) => void;
  onNewMeeting: () => void;
  onNavigateTab: (tab: AppTab) => void;
}

export const MeetingsManagerView: React.FC<MeetingsManagerViewProps> = ({
  meetings,
  currentMeetingId,
  onSelectMeeting,
  onRequestDeleteMeeting,
  onNewMeeting,
  onNavigateTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMeetings = meetings.filter((m) => {
    const titleMatch = (m.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const speakerMatch = (m.speakers || []).some((s) =>
      (s.assignedName || s.label).toLowerCase().includes(searchQuery.toLowerCase())
    );
    return titleMatch || speakerMatch;
  });

  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)] p-4 rounded-lg border border-[var(--border-color)] shadow-[var(--shadow-subtle)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Meeting-Verwaltung
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Alle lokal in IndexedDB gespeicherten Sitzungen einsehen, öffnen oder löschen.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[240px] sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <input
              type="text"
              placeholder="Meetings durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px' }}
              className="input-saas text-xs w-full h-9"
            />
          </div>

          <button
            onClick={onNewMeeting}
            className="btn-primary shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Meeting</span>
          </button>
        </div>
      </div>

      {/* Meetings Data Table Container */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-[var(--shadow-subtle)] overflow-hidden">
        {filteredMeetings.length === 0 ? (
          <div className="p-12 text-center">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)'
              }}
            >
              <FolderOpen className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {searchQuery ? 'Keine Meetings gefunden' : 'Noch keine Meetings vorhanden'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Versuche einen anderen Suchbegriff für Titel oder Teilnehmer.'
                : 'Starte eine Aufnahme oder lade ein Demo-Meeting, um dein erstes Protokoll zu erstellen.'}
            </p>
            {!searchQuery && (
              <button
                onClick={onNewMeeting}
                className="btn-primary mt-4 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Erstes Meeting aufnehmen</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-saas">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Meeting & Datum</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ width: '13%' }}>Dauer</th>
                  <th style={{ width: '16%' }}>Teilnehmer</th>
                  <th style={{ width: '12%' }}>Aufgaben</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeetings.map((meeting) => {
                  const isActive = meeting.id === currentMeetingId;
                  const totalTasks = meeting.tasks?.length || 0;
                  const completedTasks = (meeting.tasks || []).filter((t) => t.status === 'done').length;
                  const hasUnassignedSpeakers = (meeting.speakers || []).some(
                    (s) => !s.assignedName || s.confidence < 0.8
                  );

                  let statusBadgeClass = 'badge-neutral';
                  let statusText = 'Bereit';

                  if (hasUnassignedSpeakers) {
                    statusBadgeClass = 'badge-at-risk';
                    statusText = 'Klärung nötig';
                  } else if (totalTasks > 0 && completedTasks === totalTasks) {
                    statusBadgeClass = 'badge-on-track';
                    statusText = 'Abgeschlossen';
                  } else if (totalTasks > 0) {
                    statusBadgeClass = 'badge-on-track';
                    statusText = 'In Arbeit';
                  }

                  return (
                    <tr 
                      key={meeting.id}
                      className={isActive ? 'bg-[var(--bg-hover)]' : ''}
                    >
                      {/* Meeting Title & Date */}
                      <td>
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span 
                              className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" 
                              title="Aktuell ausgewähltes Meeting"
                            />
                          )}
                          <div className="min-w-0">
                            <span className="font-medium text-sm text-[var(--text-primary)] block truncate">
                              {meeting.title || 'Unbenanntes Meeting'}
                            </span>
                            <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                              {new Date(meeting.date).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={statusBadgeClass}>
                          {statusText}
                        </span>
                      </td>

                      {/* Duration */}
                      <td>
                        <span className="text-xs font-mono text-[var(--text-secondary)]">
                          {formatTimestamp(meeting.durationSeconds || 0)}
                        </span>
                      </td>

                      {/* Speakers */}
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {(meeting.speakers || []).slice(0, 3).map((spk, idx) => (
                              <div
                                key={idx}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ring-1 ring-[var(--bg-surface)] text-white shrink-0"
                                style={{ backgroundColor: spk.color || '#3b82f6' }}
                                title={spk.assignedName || spk.label}
                              >
                                {(spk.assignedName || spk.label).charAt(0).toUpperCase()}
                              </div>
                            ))}
                          </div>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {meeting.speakers?.length || 0}
                          </span>
                        </div>
                      </td>

                      {/* Tasks */}
                      <td>
                        <div className="text-xs text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--text-primary)]">{totalTasks}</span> Tasks
                          {totalTasks > 0 && (
                            <span className="text-[var(--text-muted)] block text-[11px]">
                              ({completedTasks} erledigt)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              onSelectMeeting(meeting.id);
                              onNavigateTab('transcript');
                            }}
                            className="btn-secondary text-xs py-1 px-2.5"
                            title="Meeting öffnen und zur Transkription wechseln"
                          >
                            <span>Öffnen</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => onRequestDeleteMeeting(meeting)}
                            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-600 hover:bg-[var(--status-off-track-bg)] transition-colors cursor-pointer border border-transparent hover:border-[var(--status-off-track-border)]"
                            title={`Meeting "${meeting.title}" löschen`}
                            aria-label={`Meeting ${meeting.title} löschen`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
