import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { MeetingJob } from '../../types';

interface MeetingJobsListProps {
  jobs: MeetingJob[];
  onOpenTranscript?: (meetingId: string) => void;
}

export const MeetingJobsList: React.FC<MeetingJobsListProps> = ({ jobs, onOpenTranscript }) => {
  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="space-y-2.5 my-3 animate-in fade-in duration-200">
      {jobs.map((job) => {
        const isRunning = job.status === 'running';
        const isCompleted = job.status === 'completed';
        const isFailed = job.status === 'failed';

        return (
          <div
            key={job.id}
            onClick={() => {
              if (onOpenTranscript) {
                onOpenTranscript(job.meetingId);
              }
            }}
            className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
              onOpenTranscript ? 'cursor-pointer hover:shadow-sm' : ''
            } ${
              isRunning
                ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/50 shadow-xs hover:border-blue-300'
                : isCompleted
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-300'
                  : 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
            }`}
          >
            {/* Header with Title & Percentage */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {isRunning ? (
                  <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                )}
                <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {job.title}
                </span>
              </div>

              <span className={`font-mono text-xs font-semibold shrink-0 ${
                isCompleted 
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isFailed
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-blue-600 dark:text-blue-400'
              }`}>
                {isCompleted ? 'Fertig ✓' : `${job.progress}%`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[var(--bg-subtle)] border border-[var(--border-color)] h-2 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  isCompleted
                    ? 'bg-emerald-600'
                    : isFailed
                      ? 'bg-red-600'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500'
                }`}
                style={{ width: `${Math.max(4, Math.min(100, job.progress))}%` }}
              />
            </div>

            {/* Subtitle / Step Status */}
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-2">
              <span className="truncate">
                {job.step}
              </span>
              {onOpenTranscript && (
                <span className="text-blue-600 dark:text-blue-400 font-medium shrink-0 ml-2 hover:underline">
                  Zur Transkription →
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
