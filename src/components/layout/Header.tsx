import React from 'react';
import { Mic, Kanban, Settings, Plus, Sparkles, FolderOpen } from 'lucide-react';
import { Meeting } from '../../types';

interface HeaderProps {
  currentMeeting: Meeting | null;
  meetings: Meeting[];
  onSelectMeeting: (id: string) => void;
  onNewMeeting: () => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentMeeting,
  meetings,
  onSelectMeeting,
  onNewMeeting,
  onOpenSettings,
  hasApiKey
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                VoiceToKanban
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Meeting-Protokoll & Sprechererkennung
            </p>
          </div>
        </div>

        {/* Meeting Switcher & Actions */}
        <div className="flex items-center gap-2">
          {meetings.length > 0 && (
            <div className="relative flex items-center">
              <FolderOpen className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none hidden sm:block" />
              <select
                className="bg-slate-800 text-slate-200 text-xs sm:text-sm rounded-lg pl-2 sm:pl-8 pr-6 py-1.5 border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[160px] sm:max-w-[240px] truncate"
                value={currentMeeting?.id || ''}
                onChange={(e) => onSelectMeeting(e.target.value)}
              >
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title || 'Unbenanntes Meeting'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onNewMeeting}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-blue-600/30 cursor-pointer"
            title="Neues Meeting aufnehmen"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Neues Meeting</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
            title="Einstellungen (OpenRouter)"
          >
            <Settings className="w-4 h-4" />
            {/* Status indicator dot */}
            <span
              className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                hasApiKey ? 'bg-emerald-500 ring-2 ring-slate-900' : 'bg-amber-500 animate-pulse ring-2 ring-slate-900'
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
