import React from 'react';
import { Mic, FileText, Kanban, HelpCircle } from 'lucide-react';

export type AppTab = 'record' | 'transcript' | 'kanban';

interface NavigationProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  pendingClarificationCount: number;
  taskCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  pendingClarificationCount,
  taskCount
}) => {
  const tabs = [
    {
      id: 'record' as AppTab,
      label: 'Aufnahme',
      icon: Mic,
      badge: null
    },
    {
      id: 'transcript' as AppTab,
      label: 'Transkript & Sprecher',
      icon: FileText,
      badge: pendingClarificationCount > 0 ? `${pendingClarificationCount} unklar` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    },
    {
      id: 'kanban' as AppTab,
      label: 'Kanban Board',
      icon: Kanban,
      badge: taskCount > 0 ? `${taskCount}` : null,
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
    }
  ];

  return (
    <>
      {/* Desktop Tabs */}
      <div className="hidden md:flex border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm px-4">
        <div className="max-w-7xl mx-auto flex gap-6 w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-3 py-2">
        <div className="grid grid-cols-3 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'text-blue-400 bg-blue-500/10 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 active:bg-slate-800/50'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {tab.badge && (
                    <span className="absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] flex items-center justify-center">
                      !
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {tab.id === 'transcript' ? 'Transkript' : tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
