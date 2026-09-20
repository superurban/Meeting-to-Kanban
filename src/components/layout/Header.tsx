import React from 'react';
import { 
  Mic, 
  Settings, 
  Plus, 
  Sun, 
  Moon 
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
            </div>
            <p className="text-[11px] text-[var(--text-muted)] hidden sm:block leading-tight mt-0.5">
              Executive Meeting Protocol & Task Extraction
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* New Meeting Primary Button */}
          <button
            type="button"
            onClick={onNewMeeting}
            className="btn-primary text-xs flex items-center gap-1.5"
            title="Neues Meeting aufnehmen"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Neues Meeting</span>
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
