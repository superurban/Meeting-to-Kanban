import React, { useState } from 'react';
import { Play, Square, AlertTriangle, Sparkles, Volume2, Edit2, ArrowRight, FileText, Users } from 'lucide-react';
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
    <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Sub-Tabs Switcher: Transkript & Sprecher */}
      {onNavigateTab && (
        <div 
          className="flex items-center justify-between pb-3 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('transcript')}
              className="btn-primary text-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Transkript ({meeting.segments.length})</span>
            </button>
            <button
              onClick={() => onNavigateTab('speakers')}
              className="btn-secondary text-xs"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Sprecher ({meeting.speakers.length})</span>
            </button>
          </div>

          <button
            onClick={() => onNavigateTab('kanban')}
            className="btn-secondary text-xs py-1"
          >
            <span>Zum Kanban Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Action & Status Header */}
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border shadow-[var(--shadow-subtle)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {meeting.title || 'Meeting-Transkript'}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
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
          className="btn-primary text-xs shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isExtractingTasks ? 'Analysiere Next Steps...' : 'Kanban-Tasks generieren'}</span>
        </button>
      </div>

      {/* Unassigned Speakers Clarification Banner */}
      {unassignedSpeakers.length > 0 && (
        <div 
          className="p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--status-at-risk-bg)',
            borderColor: 'var(--status-at-risk-border)'
          }}
        >
          <div className="flex items-start gap-3">
            <div 
              className="p-1.5 rounded-md shrink-0"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--status-at-risk-text)'
              }}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 
                className="text-xs font-semibold"
                style={{ color: 'var(--status-at-risk-text)' }}
              >
                {unassignedSpeakers.length} Sprecher ohne Klarnamen
              </h3>
              <p 
                className="text-[11px] opacity-80 mt-0.5"
                style={{ color: 'var(--status-at-risk-text)' }}
              >
                Spiele einen Tonschnipsel ab, um die Stimmen zuzuordnen:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {unassignedSpeakers.map((spk) => (
                  <button
                    key={spk.id}
                    onClick={() => onRequestClarification(spk.id)}
                    className="btn-secondary text-[11px] py-0.5 px-2"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{spk.assignedName || spk.label} zuweisen</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Segments Transcript Timeline */}
      <div className="space-y-2.5">
        {meeting.segments.map((seg) => {
          const speaker = speakerMap.get(seg.speakerId);
          const isPlaying = playingSegmentId === seg.id;
          const speakerName = speaker?.assignedName || speaker?.label || seg.speakerLabel;
          const isHighConfidence = speaker && speaker.confidence >= 0.8;

          return (
            <div
              key={seg.id}
              className={`p-3.5 rounded-lg border transition-all duration-150 ${
                isPlaying ? 'ring-2 ring-blue-500/30' : ''
              }`}
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: isPlaying ? 'var(--text-primary)' : 'var(--border-color)'
              }}
            >
              {/* Segment Header */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Speaker Tag / Badge */}
                  <button
                    onClick={() => onRequestClarification(seg.speakerId)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-transform hover:scale-102 cursor-pointer border"
                    style={{
                      backgroundColor: `${speaker?.color || '#3b82f6'}15`,
                      color: speaker?.color || '#3b82f6',
                      borderColor: `${speaker?.color || '#3b82f6'}30`
                    }}
                    title="Klicken, um Sprecher umzubenennen oder anzuhören"
                  >
                    <span>{speakerName}</span>
                    <Edit2 className="w-2.5 h-2.5 opacity-60" />
                  </button>

                  {/* Recognition Source / Confidence */}
                  {speaker?.assignedName && (
                    <span className={isHighConfidence ? 'badge-on-track text-[10px]' : 'badge-neutral text-[10px]'}>
                      {isHighConfidence ? '✓ Erkannt' : 'Zugeordnet'}
                    </span>
                  )}

                  {/* Addressed To Note */}
                  {seg.addressedTo && (
                    <span className="badge-neutral text-[10px]">
                      Spricht <strong>{seg.addressedTo}</strong> an
                    </span>
                  )}
                </div>

                {/* Snippet Playback Button & Time */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[var(--text-muted)] hidden sm:inline">
                    {formatTimestamp(seg.startTime)}
                  </span>
                  <button
                    onClick={() => handlePlaySegment(seg)}
                    className="p-1 rounded border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                    style={{ borderColor: 'var(--border-color)' }}
                    title="Diesen Abschnitt anhören"
                    aria-label="Abschnitt anhören"
                  >
                    {isPlaying ? (
                      <Square className="w-3 h-3 text-red-600 fill-current" />
                    ) : (
                      <Play className="w-3 h-3 fill-current" />
                    )}
                  </button>
                </div>
              </div>

              {/* Segment Text Content */}
              <p className="text-sm text-[var(--text-primary)] leading-relaxed font-normal">
                {seg.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
