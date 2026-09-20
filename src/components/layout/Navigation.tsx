import React from 'react';
import { Mic, FileText, Users, Kanban, TableProperties } from 'lucide-react';

export type AppTab = 'record' | 'transcript' | 'speakers' | 'kanban' | 'meetings';

interface NavigationProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  pendingClarificationCount: number;
  speakerCount?: number;
  segmentCount?: number;
  taskCount: number;
  meetingCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  pendingClarificationCount,
  speakerCount = 0,
  segmentCount = 0,
  taskCount,
  meetingCount = 0
}) => {
  const tabs = [
    {
      id: 'record' as AppTab,
      label: 'Aufnahme',
      icon: Mic,
      badge: null,
      badgeClass: ''
    },
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
    },
    {
      id: 'meetings' as AppTab,
      label: 'Meetings',
      icon: TableProperties,
      badge: meetingCount > 0 ? `${meetingCount}` : null,
      badgeClass: 'badge-neutral'
    }
  ];

  return (
    <>
      {/* Desktop Tabs: Executive Minimalist Border Bottom Navigation */}
      <div 
        className="hidden md:block border-b transition-colors duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 flex items-center gap-1">
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

      {/* Mobile Bottom Navigation Bar */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t px-2 py-1 transition-colors duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="grid grid-cols-5 gap-0.5">
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
