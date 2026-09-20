import React from 'react';
import { 
  Mic, 
  Settings, 
  Plus, 
  FolderOpen, 
  Trash2, 
  Sun, 
  Moon, 
  TableProperties 
} from 'lucide-react';
import { Meeting } from '../../types';

interface HeaderProps {
  currentMeeting: Meeting | null;
  meetings: Meeting[];
  onSelectMeeting: (id: string) => void;
  onNewMeeting: () => void;
  onOpenSettings: () => void;
  onRequestDeleteCurrentMeeting: () => void;
  onOpenMeetingsManager: () => void;
  hasApiKey: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMeeting,
  meetings,
  onSelectMeeting,
  onNewMeeting,
  onOpenSettings,
  onRequestDeleteCurrentMeeting,
  onOpenMeetingsManager,
  hasApiKey,
  theme,
  onToggleTheme
}) => {
  return (
    <header 
      className="sticky top-0 z-30 border-b transition-colors duration-150"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)'
      }}
    >
      <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand Logo & SaaS Title */}
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 shadow-xs"
            style={{
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-surface)'
            }}
          >
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-[var(--text-primary)] leading-none">
                VoiceToKanban
              </h1>
              <span className="badge-neutral text-[10px] py-0 px-1.5 leading-tight">
                Enterprise
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] hidden sm:block leading-tight mt-0.5">
              Executive Meeting Protocol & Task Extraction
            </p>
          </div>
        </div>

        {/* Meeting Switcher & Actions */}
        <div className="flex items-center gap-2">
          {meetings.length > 0 && (
            <div className="flex items-center gap-1.5">
              {/* Meeting Dropdown Selector */}
              <div className="relative flex items-center">
                <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 pointer-events-none" />
                <select
                  aria-label="Meeting auswählen"
                  className="input-saas pl-8 pr-6 text-xs max-w-[150px] sm:max-w-[220px] truncate"
                  value={currentMeeting?.id || ''}
                  onChange={(e) => {
                    if (e.target.value === '__manage__') {
                      onOpenMeetingsManager();
                    } else {
                      onSelectMeeting(e.target.value);
                    }
                  }}
                >
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title || 'Unbenanntes Meeting'}
                    </option>
                  ))}
                  <option disabled value="">──────────</option>
                  <option value="__manage__">📁 Alle Meetings verwalten...</option>
                </select>
              </div>

              {/* Direct Delete Active Meeting Button */}
              {currentMeeting && (
                <button
                  type="button"
                  onClick={onRequestDeleteCurrentMeeting}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-600 hover:bg-[var(--status-off-track-bg)] border border-transparent hover:border-[var(--status-off-track-border)] transition-colors cursor-pointer"
                  title={`Aktuelles Meeting "${currentMeeting.title}" löschen`}
                  aria-label="Aktuelles Meeting löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* New Meeting Primary Button */}
          <button
            type="button"
            onClick={onNewMeeting}
            className="btn-primary text-xs"
            title="Neues Meeting aufnehmen"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Neues Meeting</span>
          </button>

          {/* Theme Toggle Button (Light/Dark Mode) */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Zu hellem Modus wechseln' : 'Zu dunklem Modus wechseln'}
            aria-label="Theme umschalten"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Settings Modal Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="relative p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] transition-colors cursor-pointer"
            title="Einstellungen (OpenRouter)"
            aria-label="Einstellungen öffnen"
          >
            <Settings className="w-4 h-4" />
            {/* Status indicator dot */}
            <span
              className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                hasApiKey ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
