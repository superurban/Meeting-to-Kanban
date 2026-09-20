import React from 'react';
import { FileText, Users, Kanban, FolderOpen, Trash2, Plus } from 'lucide-react';
import { Meeting } from '../../types';

export type AppTab = 'record' | 'transcript' | 'speakers' | 'kanban' | 'meetings';

interface NavigationProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  pendingClarificationCount: number;
  speakerCount?: number;
  segmentCount?: number;
  taskCount: number;
  meetings?: Meeting[];
  currentMeeting?: Meeting | null;
  onSelectMeeting?: (id: string) => void;
  onNewMeeting?: () => void;
  onOpenMeetingsManager?: () => void;
  onRequestDeleteCurrentMeeting?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  pendingClarificationCount,
  speakerCount = 0,
  segmentCount = 0,
  taskCount,
  meetings = [],
  currentMeeting = null,
  onSelectMeeting,
  onNewMeeting,
  onOpenMeetingsManager,
  onRequestDeleteCurrentMeeting
}) => {
  const tabs = [
    {
      id: 'transcript' as AppTab,
      label: 'Transkript',
      icon: FileText,
      badge: segmentCount > 0 ? `${segmentCount}` : null,
      badgeClass: 'badge-neutral'
    },
    {
      id: 'speakers' as AppTab,
      label: 'Sprecher',
      icon: Users,
      badge:
        pendingClarificationCount > 0
          ? `${pendingClarificationCount} unklar`
          : speakerCount > 0
          ? `${speakerCount}`
          : null,
      badgeClass: pendingClarificationCount > 0 ? 'badge-at-risk' : 'badge-neutral'
    },
    {
      id: 'kanban' as AppTab,
      label: 'Kanban Board',
      icon: Kanban,
      badge: taskCount > 0 ? `${taskCount}` : null,
      badgeClass: 'badge-on-track'
    }
  ];

  return (
    <>
      {/* Desktop Tabs: Dropdown der bisherigen Aufnahmen links + Transkript, Sprecher, Kanban */}
      <div 
        className="hidden md:block border-b transition-colors duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Dropdown mit bisherigen Aufnahmen */}
            <div className="flex items-center gap-1.5 py-1.5">
              <FolderOpen className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <select
                aria-label="Bisherige Aufnahme auswählen"
                className="input-saas text-xs py-1.5 px-2.5 w-[200px] sm:w-[260px] md:w-[320px] truncate font-medium cursor-pointer"
                value={currentMeeting?.id || ''}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    if (onNewMeeting) onNewMeeting();
                  } else if (e.target.value === '__manage__') {
                    if (onOpenMeetingsManager) onOpenMeetingsManager();
                  } else if (onSelectMeeting) {
                    onSelectMeeting(e.target.value);
                  }
                }}
              >
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title || 'Unbenannte Aufnahme'}
                  </option>
                ))}
                <option disabled value="">──────────</option>
                <option value="__new__">+ Neue Aufnahme starten</option>
                <option value="__manage__">📁 Alle Aufnahmen verwalten...</option>
              </select>

              {/* Schnelles Löschen der aktuellen Aufnahme */}
              {currentMeeting && onRequestDeleteCurrentMeeting && (
                <button
                  type="button"
                  onClick={onRequestDeleteCurrentMeeting}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-600 hover:bg-[var(--status-off-track-bg)] transition-colors cursor-pointer"
                  title={`"${currentMeeting.title}" löschen`}
                  aria-label="Aktuelle Aufnahme löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Vertikaler Trennstrich */}
            <div className="h-5 w-[1px] bg-[var(--border-color)] mx-1" />

            {/* Die Tabs: Transkript, Sprecher, Kanban */}
            <div className="flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelectTab(tab.id)}
                    className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium text-xs sm:text-sm transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'border-[var(--text-primary)] text-[var(--text-primary)] font-semibold'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className={`${tab.badgeClass} text-[11px] py-0 px-1.5 leading-tight`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t px-2 py-1 transition-colors duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="grid grid-cols-4 gap-0.5">
          {/* Mobile Aufnahmen / Manager Button */}
          <button
            type="button"
            onClick={() => {
              if (onOpenMeetingsManager) onOpenMeetingsManager();
            }}
            className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-md transition-all duration-150 cursor-pointer ${
              currentTab === 'meetings'
                ? 'text-[var(--text-primary)] font-semibold bg-[var(--bg-hover)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
              Aufnahmen
            </span>
          </button>

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-md transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'text-[var(--text-primary)] font-semibold bg-[var(--bg-hover)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="relative">
                  <Icon className="w-4 h-4" />
                  {tab.id === 'speakers' && pendingClarificationCount > 0 && (
                    <span 
                      className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--status-at-risk-text)' }}
                    />
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
