import React, { useState } from 'react';
import { Play, Square, UserCheck, AlertTriangle, Sparkles, Volume2, Edit2, ArrowRight, FileText, Users } from 'lucide-react';
import { Meeting, TranscriptSegment, Speaker } from '../../types';
import { AudioSnippetPlayer } from '../../services/audio/AudioSnippetPlayer';
import { formatTimestamp } from '../../utils/dateUtils';
import { AppTab } from '../layout/Navigation';

interface TranscriptViewerProps {
  meeting: Meeting;
  onUpdateSpeakerName: (speakerId: string, newName: string) => void;
  onRequestClarification: (speakerId: string) => void;
  onExtractTasks: () => void;
  isExtractingTasks: boolean;
  onNavigateTab?: (tab: AppTab) => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  meeting,
  onUpdateSpeakerName,
  onRequestClarification,
  onExtractTasks,
  isExtractingTasks,
  onNavigateTab
}) => {
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);

  const speakerMap = new Map<string, Speaker>();
  meeting.speakers.forEach((s) => speakerMap.set(s.id, s));

  // Find unassigned speakers
  const unassignedSpeakers = meeting.speakers.filter(
    (s) => !s.assignedName || s.confidence < 0.8
  );

  const handlePlaySegment = (seg: TranscriptSegment) => {
    if (playingSegmentId === seg.id) {
      AudioSnippetPlayer.stopCurrent();
      setPlayingSegmentId(null);
    } else {
      setPlayingSegmentId(seg.id);
      AudioSnippetPlayer.playSnippet(
        meeting.audioBlob,
        seg.startTime,
        seg.endTime,
        seg.text,
        (isPlaying) => {
          if (!isPlaying) {
            setPlayingSegmentId(null);
          }
        }
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Sub-Tabs Switcher: Transkript & Sprecher */}
      {onNavigateTab && (
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('transcript')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Transkript ({meeting.segments.length})</span>
            </button>
            <button
              onClick={() => onNavigateTab('speakers')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Sprecher ({meeting.speakers.length})</span>
            </button>
          </div>

          <button
            onClick={() => onNavigateTab('kanban')}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
          >
            <span>Zum Kanban Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Action & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {meeting.title || 'Meeting-Transkript'}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
            <span>{meeting.segments.length} Abschnitte</span>
            <span>•</span>
            <span>{meeting.speakers.length} erkannte Sprecher</span>
            <span>•</span>
            <span>{new Date(meeting.date).toLocaleDateString('de-DE')}</span>
          </div>
        </div>

        {/* Action to trigger Kanban extraction */}
        <button
          onClick={onExtractTasks}
          disabled={isExtractingTasks || meeting.segments.length === 0}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isExtractingTasks ? 'Analysiere Next Steps...' : 'Kanban-Tasks generieren'}</span>
        </button>
      </div>

      {/* Unassigned Speakers Clarification Banner */}
      {unassignedSpeakers.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-200">
                {unassignedSpeakers.length} Sprecher ohne Klarnamen
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Spiele einen Tonschnipsel ab, um die Stimmen zuzuordnen:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {unassignedSpeakers.map((spk) => (
                  <button
                    key={spk.id}
                    onClick={() => onRequestClarification(spk.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-200 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{spk.assignedName || spk.label} zuweisen</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Segments Transcript Timeline */}
      <div className="space-y-3">
        {meeting.segments.map((seg, idx) => {
          const speaker = speakerMap.get(seg.speakerId);
          const isPlaying = playingSegmentId === seg.id;
          const speakerName = speaker?.assignedName || speaker?.label || seg.speakerLabel;
          const isHighConfidence = speaker && speaker.confidence >= 0.8;

          return (
            <div
              key={seg.id}
              className={`bg-slate-900/90 border rounded-2xl p-4 transition-all ${
                isPlaying
                  ? 'border-blue-500/80 ring-1 ring-blue-500/40 bg-slate-900 shadow-lg'
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Segment Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Speaker Tag / Badge */}
                  <button
                    onClick={() => onRequestClarification(seg.speakerId)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-transform hover:scale-105 cursor-pointer"
                    style={{
                      backgroundColor: `${speaker?.color || '#3b82f6'}20`,
                      color: speaker?.color || '#60a5fa',
                      border: `1px solid ${speaker?.color || '#3b82f6'}40`
                    }}
                    title="Klicken, um Sprecher umzubenennen oder anzuhören"
                  >
                    <span>{speakerName}</span>
                    <Edit2 className="w-3 h-3 opacity-70" />
                  </button>

                  {/* Recognition Source / Confidence */}
                  {speaker?.assignedName && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        isHighConfidence
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title={speaker.evidence || 'Automatisch im Gesprächsverlauf zugeordnet'}
                    >
                      {isHighConfidence ? '✓ Automatisch erkannt' : 'Manuell zugeordnet'}
                    </span>
                  )}

                  {/* Addressed To Note */}
                  {seg.addressedTo && (
                    <span className="text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
                      Spricht <strong>{seg.addressedTo}</strong> an
                    </span>
                  )}
                </div>

                {/* Snippet Playback Button & Time */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                    {formatTimestamp(seg.startTime)}
                  </span>
                  <button
                    onClick={() => handlePlaySegment(seg)}
                    className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                      isPlaying
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                    title="Diesen Abschnitt anhören"
                  >
                    {isPlaying ? (
                      <Square className="w-3.5 h-3.5 fill-white" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                  </button>
                </div>
              </div>

              {/* Segment Text Content */}
              <p className="text-sm text-slate-200 leading-relaxed font-normal">
                {seg.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
