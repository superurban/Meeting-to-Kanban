import React, { useState, useRef } from 'react';
import { Play, Square, AlertTriangle, Sparkles, Volume2, Edit2, Users, GitMerge, Clock, MessageSquare } from 'lucide-react';
import { Meeting, TranscriptSegment, Speaker } from '../../types';
import { AudioSnippetPlayer } from '../../services/audio/AudioSnippetPlayer';
import { formatTimestamp, formatDuration } from '../../utils/dateUtils';
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

  // Interactive Timeline Scrubber & Sync State
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<TranscriptSegment | null>(null);
  const [tooltipX, setTooltipX] = useState<number>(50);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speakerMap = new Map<string, Speaker>();
  meeting.speakers.forEach((s) => speakerMap.set(s.id, s));

  // Compute total duration in seconds from segments and meeting duration
  const maxSegmentEnd = meeting.segments.reduce((max, s) => Math.max(max, s.endTime || 0), 0);
  const totalDuration = Math.max(meeting.durationSeconds || 0, maxSegmentEnd, 10);

  // Compute scale minute ticks
  let tickInterval = 60; // 1 minute default
  if (totalDuration <= 60) tickInterval = 15;
  else if (totalDuration <= 180) tickInterval = 30;
  else if (totalDuration <= 600) tickInterval = 60;
  else if (totalDuration <= 1800) tickInterval = 120;
  else tickInterval = 300;

  const ticks: number[] = [];
  for (let t = 0; t <= totalDuration; t += tickInterval) {
    ticks.push(t);
  }

  // Smooth jump to segment inside unified chat box
  const handleJumpToSegment = (segId: string) => {
    setActiveSegmentId(segId);

    const targetEl = document.getElementById(`transcript-seg-${segId}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setActiveSegmentId(null);
    }, 4500);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, relX / rect.width));
    const clickTime = pct * totalDuration;

    // Find segment covering clickTime or closest segment
    let bestSeg: TranscriptSegment | null = null;
    let minDiff = Infinity;
    for (const seg of meeting.segments) {
      if (clickTime >= seg.startTime && clickTime <= seg.endTime) {
        bestSeg = seg;
        break;
      }
      const diff = Math.min(Math.abs(seg.startTime - clickTime), Math.abs(seg.endTime - clickTime));
      if (diff < minDiff) {
        minDiff = diff;
        bestSeg = seg;
      }
    }

    if (bestSeg) {
      handleJumpToSegment(bestSeg.id);
    }
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, relX / rect.width));
    const timeAtCursor = pct * totalDuration;

    const matchingSeg = meeting.segments.find(
      (s) => timeAtCursor >= s.startTime && timeAtCursor <= s.endTime
    );

    if (matchingSeg) {
      setHoveredSegment(matchingSeg);
      setTooltipX(pct * 100);
    } else {
      const closeSeg = meeting.segments.find(
        (s) => Math.abs(s.startTime - timeAtCursor) < 2 || Math.abs(s.endTime - timeAtCursor) < 2
      );
      if (closeSeg) {
        setHoveredSegment(closeSeg);
        setTooltipX(((closeSeg.startTime + closeSeg.endTime) / 2 / totalDuration) * 100);
      } else {
        setHoveredSegment(null);
      }
    }
  };

  const handleTimelineMouseLeave = () => {
    setHoveredSegment(null);
  };

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

      {/* 1. Zeitleiste der Aufnahme (Timeline Scrubber mit Minuten, Sprecher-Markern, Hover & Klick) */}
      <div 
        className="p-4 rounded-xl border shadow-[var(--shadow-subtle)] space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-[var(--text-primary)]">
              Zeitleiste der Aufnahme
            </span>
            <span className="text-[var(--text-muted)] font-mono">
              ({formatDuration(totalDuration)})
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
            Fahre über die Marker für Text-Vorschau • Klicke zum Anspringen im Chat
          </span>
        </div>

        {/* Timeline ruler & track */}
        <div className="relative pt-5 pb-1">
          {/* Minute scale markers above track */}
          <div className="absolute top-0 left-0 right-0 h-4 pointer-events-none select-none">
            {ticks.map((t) => {
              const pct = (t / totalDuration) * 100;
              return (
                <div 
                  key={t}
                  className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${pct}%` }}
                >
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">
                    {formatDuration(t)}
                  </span>
                  <div className="w-[1px] h-1.5 bg-[var(--border-color)] mt-0.5" />
                </div>
              );
            })}
          </div>

          {/* Interactive track */}
          <div 
            className="relative h-9 rounded-lg border bg-[var(--bg-subtle)] cursor-pointer select-none overflow-hidden"
            style={{ borderColor: 'var(--border-color)' }}
            onClick={handleTimelineClick}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
          >
            {/* Minute tick guide lines across track */}
            {ticks.map((t) => {
              const pct = (t / totalDuration) * 100;
              return (
                <div 
                  key={t} 
                  className="absolute top-0 bottom-0 w-[1px] bg-[var(--border-color)] opacity-40 pointer-events-none"
                  style={{ left: `${pct}%` }}
                />
              );
            })}

            {/* Colored Speaker speech segments on the timeline */}
            {meeting.segments.map((seg) => {
              const spk = speakerMap.get(seg.speakerId);
              const leftPct = (seg.startTime / totalDuration) * 100;
              const widthPct = Math.max(0.7, ((seg.endTime - seg.startTime) / totalDuration) * 100);
              const isSegActive = activeSegmentId === seg.id;
              const isSegPlaying = playingSegmentId === seg.id;
              const isSegHovered = hoveredSegment?.id === seg.id;

              return (
                <div
                  key={seg.id}
                  className={`absolute top-1 bottom-1 rounded transition-all duration-100 ${
                    isSegActive ? 'ring-2 ring-blue-500 z-10' : ''
                  } ${isSegPlaying ? 'animate-pulse z-10 ring-2 ring-red-500' : ''} ${
                    isSegHovered ? 'scale-y-110 brightness-110 z-20 shadow-md' : 'opacity-85 hover:opacity-100'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: spk?.color || '#3b82f6'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJumpToSegment(seg.id);
                  }}
                  onMouseEnter={() => {
                    setHoveredSegment(seg);
                    setTooltipX(leftPct + widthPct / 2);
                  }}
                />
              );
            })}
          </div>

          {/* Hover Tooltip showing speaker, time & spoken text */}
          {hoveredSegment && (
            <div 
              className="absolute z-30 pointer-events-none transition-all duration-75"
              style={{
                left: `${Math.min(Math.max(tooltipX, 15), 85)}%`,
                bottom: 'calc(100% + 12px)',
                transform: 'translateX(-50%)'
              }}
            >
              <div 
                className="w-72 max-w-[90vw] p-3 rounded-lg border shadow-xl text-xs space-y-2 backdrop-blur-md"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  boxShadow: 'var(--shadow-modal)'
                }}
              >
                {/* Tooltip Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: speakerMap.get(hoveredSegment.speakerId)?.color || '#3b82f6' }}
                    />
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {speakerMap.get(hoveredSegment.speakerId)?.assignedName || speakerMap.get(hoveredSegment.speakerId)?.label || hoveredSegment.speakerLabel}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">
                    {formatTimestamp(hoveredSegment.startTime)} – {formatTimestamp(hoveredSegment.endTime)}
                  </span>
                </div>

                {/* Spoken Text Preview */}
                <p className="text-[11px] text-[var(--text-secondary)] italic line-clamp-3 leading-relaxed">
                  "{hoveredSegment.text}"
                </p>

                {/* Tooltip Hint */}
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 pt-1.5 border-t border-[var(--border-color)]">
                  <span>Klicken zum Anspringen im Chat</span>
                </div>
              </div>

              {/* Little downward indicator arrow */}
              <div 
                className="w-2.5 h-2.5 mx-auto rotate-45 -mt-1.5 border-r border-b"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. EIN Kasten mit dem gesamten Chat (Unified Chat Box mit sanftem Scrollen) */}
      <div 
        className="rounded-xl border shadow-[var(--shadow-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {/* Chat Box Header */}
        <div 
          className="px-4 py-3 border-b flex items-center justify-between bg-[var(--bg-subtle)]"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">
              Gesamter Chatverlauf ({meeting.segments.length} Beiträge)
            </h3>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            {activeSegmentId && (
              <span className="text-blue-600 dark:text-blue-400 font-medium animate-pulse">
                Stelle fokussiert
              </span>
            )}
            <span>Scrollbare Ansicht</span>
          </div>
        </div>

        {/* Scrollable Chat Container */}
        <div 
          ref={chatContainerRef}
          className="max-h-[580px] overflow-y-auto divide-y divide-[var(--border-color)] scroll-smooth"
        >
          {meeting.segments.map((seg) => {
            const speaker = speakerMap.get(seg.speakerId);
            const isPlaying = playingSegmentId === seg.id;
            const isActive = activeSegmentId === seg.id;
            const speakerName = speaker?.assignedName || speaker?.label || seg.speakerLabel;

            return (
              <div
                key={seg.id}
                id={`transcript-seg-${seg.id}`}
                className={`p-3.5 transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-blue-500 pl-3' 
                    : isPlaying 
                      ? 'bg-amber-50/50 dark:bg-amber-950/30 border-l-4 border-amber-500 pl-3'
                      : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                {/* Segment Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Speaker Avatar Dot & Name Button */}
                    <button
                      type="button"
                      onClick={() => onRequestClarification(seg.speakerId)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-transform hover:scale-102 cursor-pointer border"
                      style={{
                        backgroundColor: `${speaker?.color || '#3b82f6'}15`,
                        color: speaker?.color || '#3b82f6',
                        borderColor: `${speaker?.color || '#3b82f6'}30`
                      }}
                      title="Klicken, um Sprecher umzubenennen oder anzuhören"
                    >
                      <span 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: speaker?.color || '#3b82f6' }}
                      />
                      <span>{speakerName}</span>
                      <Edit2 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                    </button>
                  </div>

                  {/* Audio Snippet Playback & Time */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {formatTimestamp(seg.startTime)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePlaySegment(seg)}
                      className={`p-1 rounded border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${
                        isPlaying ? 'text-red-600 border-red-400 bg-red-50 dark:bg-red-950/30' : ''
                      }`}
                      style={{ borderColor: isPlaying ? undefined : 'var(--border-color)' }}
                      title={isPlaying ? 'Wiedergabe stoppen' : 'Diesen Abschnitt anhören'}
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

                {/* Spoken Text */}
                <p className="text-sm text-[var(--text-primary)] leading-relaxed font-normal pl-0.5">
                  {seg.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
