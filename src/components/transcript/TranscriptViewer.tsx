import React, { useState } from 'react';
import { Play, Square, AlertTriangle, Sparkles, Volume2, Edit2, Users, GitMerge } from 'lucide-react';
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
  onMergeSpeakers?: (sourceSpeakerId: string, targetSpeakerId: string) => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  meeting,
  onUpdateSpeakerName,
  onRequestClarification,
  onExtractTasks,
  isExtractingTasks,
  onNavigateTab,
  onMergeSpeakers
}) => {
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [playingSpeakerId, setPlayingSpeakerId] = useState<string | null>(null);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState('');

  const speakerMap = new Map<string, Speaker>();
  meeting.speakers.forEach((s) => speakerMap.set(s.id, s));

  // Find unassigned speakers
  const unassignedSpeakers = meeting.speakers.filter(
    (s) => !s.assignedName || s.confidence < 0.8
  );

  const handlePlaySpeaker5s = (spk: Speaker) => {
    if (playingSpeakerId === spk.id) {
      AudioSnippetPlayer.stopCurrent();
      setPlayingSpeakerId(null);
      return;
    }

    const bestSeg = meeting.segments.find((s) => s.speakerId === spk.id);
    if (!bestSeg) return;

    setPlayingSpeakerId(spk.id);
    const startTime = bestSeg.startTime;
    const dur = Math.max(0.5, bestSeg.endTime - bestSeg.startTime);
    const endTime = startTime + Math.min(5.0, dur);

    AudioSnippetPlayer.playSnippet(
      meeting.audioBlob,
      startTime,
      endTime,
      bestSeg.text,
      (isPlaying) => {
        if (!isPlaying) setPlayingSpeakerId(null);
      },
      5.0
    );
  };

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
      {/* Action & Status Header with Speakers List */}
      <div 
        className="p-4 rounded-lg border shadow-[var(--shadow-subtle)] space-y-3.5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
            <span>{isExtractingTasks ? 'Analysiere Next Steps...' : 'Tasks erstellen'}</span>
          </button>
        </div>

        {/* Sprecher erscheinen als Liste direkt unter Meeting */}
        {meeting.speakers.length > 0 && (
          <div 
            className="pt-3 border-t space-y-2"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Erkannte Sprecher ({meeting.speakers.length})</span>
              </span>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('speakers')}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Alle Details & Hörproben
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {meeting.speakers.map((spk) => {
                const segCount = meeting.segments.filter((s) => s.speakerId === spk.id).length;
                const isPlaying = playingSpeakerId === spk.id;
                const isEditing = editingSpeakerId === spk.id;

                return (
                  <div
                    key={spk.id}
                    className="p-2 rounded-md border flex items-center justify-between gap-2 text-xs transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      borderColor: 'var(--border-color)'
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Avatar */}
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                        style={{ backgroundColor: spk.color || '#3b82f6' }}
                      >
                        {(spk.assignedName || spk.label).slice(0, 1).toUpperCase()}
                      </div>

                      {/* Name / Inline Edit */}
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <input
                            type="text"
                            autoFocus
                            list={`speaker-options-${spk.id}`}
                            value={editNameVal}
                            onChange={(e) => setEditNameVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (editNameVal.trim()) onUpdateSpeakerName(spk.id, editNameVal.trim());
                                setEditingSpeakerId(null);
                              } else if (e.key === 'Escape') {
                                setEditingSpeakerId(null);
                              }
                            }}
                            placeholder="Name..."
                            className="input-saas py-0.5 px-1.5 text-xs w-full"
                          />
                          <datalist id={`speaker-options-${spk.id}`}>
                            {meeting.speakers
                              .filter((o) => o.id !== spk.id)
                              .map((o) => (
                                <option key={o.id} value={o.assignedName || o.label} />
                              ))}
                          </datalist>
                          <button
                            type="button"
                            onClick={() => {
                              if (editNameVal.trim()) onUpdateSpeakerName(spk.id, editNameVal.trim());
                              setEditingSpeakerId(null);
                            }}
                            className="btn-primary py-0.5 px-1.5 text-[11px]"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-medium text-[var(--text-primary)] truncate">
                              {spk.assignedName || spk.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSpeakerId(spk.id);
                                setEditNameVal(spk.assignedName || spk.label);
                              }}
                              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer"
                              title="Name bearbeiten (Gleicher Name führt Stimmen zusammen)"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>

                            {/* Merge option with other speakers */}
                            {meeting.speakers.filter((o) => o.id !== spk.id).length > 0 && (
                              <select
                                aria-label="Mit Sprecher zusammenführen"
                                title="Diese Stimme einer anderen Person zuordnen"
                                className="text-[10px] py-0 px-1 rounded border bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                style={{ borderColor: 'var(--border-color)' }}
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    if (onMergeSpeakers) {
                                      onMergeSpeakers(spk.id, e.target.value);
                                    } else {
                                      onUpdateSpeakerName(spk.id, e.target.value);
                                    }
                                  }
                                }}
                              >
                                <option value="" disabled>Zusammenführen...</option>
                                {meeting.speakers
                                  .filter((o) => o.id !== spk.id)
                                  .map((o) => (
                                    <option key={o.id} value={o.id}>
                                      → Mit {o.assignedName || o.label}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            <span>{segCount} {segCount === 1 ? 'Abschnitt' : 'Abschnitte'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 5s Hörprobe Audio Button */}
                    <button
                      type="button"
                      onClick={() => handlePlaySpeaker5s(spk)}
                      className={`p-1.5 rounded-md border text-xs flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                        isPlaying 
                          ? 'btn-danger animate-pulse' 
                          : 'btn-secondary text-[var(--text-secondary)]'
                      }`}
                      title={isPlaying ? 'Stoppen' : '5s-Hörprobe abspielen'}
                    >
                      {isPlaying ? (
                        <Square className="w-3 h-3 fill-current" />
                      ) : (
                        <Volume2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
