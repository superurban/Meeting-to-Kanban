import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Sparkles, Volume2, Edit2, Users, GitMerge, Clock, MessageSquare, RefreshCw, Check, Mic, Plus } from 'lucide-react';
import { Meeting, TranscriptSegment, Speaker, MeetingJob } from '../../types';
import { AudioSnippetPlayer } from '../../services/audio/AudioSnippetPlayer';
import { formatTimestamp, formatDuration } from '../../utils/dateUtils';
import { AppTab } from '../layout/Navigation';
import { AppendRecordingModal } from '../recorder/AppendRecordingModal';
import { MeetingJobsList } from '../meetings/MeetingJobsList';

interface TranscriptViewerProps {
  meeting: Meeting;
  jobs?: MeetingJob[];
  onUpdateSpeakerName: (speakerId: string, newName: string) => void;
  onRequestClarification: (speakerId: string) => void;
  onExtractTasks: () => void;
  isExtractingTasks: boolean;
  onRetranscribe?: () => void;
  isRetranscribing?: boolean;
  onAppendRecording?: (audioBlob: Blob, mimeType: string, durationSeconds: number) => Promise<void>;
  isAppending?: boolean;
  hasApiKey?: boolean;
  onOpenSettings?: () => void;
  onNavigateTab?: (tab: AppTab) => void;
  onMergeSpeakers?: (sourceSpeakerId: string, targetSpeakerId: string) => void;
  onUpdateMeetingTitle?: (meetingId: string, newTitle: string) => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  meeting,
  jobs = [],
  onUpdateSpeakerName,
  onRequestClarification,
  onExtractTasks,
  isExtractingTasks,
  onRetranscribe,
  isRetranscribing,
  onAppendRecording,
  isAppending,
  hasApiKey = false,
  onOpenSettings,
  onNavigateTab,
  onMergeSpeakers,
  onUpdateMeetingTitle
}) => {
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [playingSpeakerId, setPlayingSpeakerId] = useState<string | null>(null);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [isAppendModalOpen, setIsAppendModalOpen] = useState(false);

  // Meeting Title Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(meeting.title || '');

  useEffect(() => {
    setTitleInput(meeting.title || '');
    setIsEditingTitle(false);
  }, [meeting.id, meeting.title]);

  const handleSaveTitle = () => {
    const trimmed = titleInput.trim();
    if (trimmed && onUpdateMeetingTitle) {
      onUpdateMeetingTitle(meeting.id, trimmed);
    }
    setIsEditingTitle(false);
  };

  // Interactive Timeline Scrubber & Sync State
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const [timelineHoveredSegment, setTimelineHoveredSegment] = useState<TranscriptSegment | null>(null);
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
      setTimelineHoveredSegment(matchingSeg);
      setHoveredSegmentId(matchingSeg.id);
      setTooltipX(pct * 100);
    } else {
      const closeSeg = meeting.segments.find(
        (s) => Math.abs(s.startTime - timeAtCursor) < 2 || Math.abs(s.endTime - timeAtCursor) < 2
      );
      if (closeSeg) {
        setTimelineHoveredSegment(closeSeg);
        setHoveredSegmentId(closeSeg.id);
        setTooltipX(((closeSeg.startTime + closeSeg.endTime) / 2 / totalDuration) * 100);
      } else {
        setTimelineHoveredSegment(null);
        setHoveredSegmentId(null);
      }
    }
  };

  const handleTimelineMouseLeave = () => {
    setTimelineHoveredSegment(null);
    setHoveredSegmentId(null);
  };



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
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="text"
                  autoFocus
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTitle();
                    } else if (e.key === 'Escape') {
                      setTitleInput(meeting.title || '');
                      setIsEditingTitle(false);
                    }
                  }}
                  className="input-saas py-1 px-2.5 text-sm font-semibold w-72 sm:w-96"
                  placeholder="Meeting-Titel eingeben..."
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="btn-primary py-1 px-2 text-xs"
                  title="Speichern"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleInput(meeting.title || '');
                    setIsEditingTitle(false);
                  }}
                  className="btn-secondary py-1 px-2 text-xs"
                  title="Abbrechen"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 
                  className="text-base font-semibold text-[var(--text-primary)] cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => {
                    setTitleInput(meeting.title || '');
                    setIsEditingTitle(true);
                  }}
                  title="Klicken zum Umbenennen"
                >
                  {meeting.title || 'Meeting-Transkript'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setTitleInput(meeting.title || '');
                    setIsEditingTitle(true);
                  }}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                  title="Meeting umbenennen"
                  aria-label="Meeting umbenennen"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
              <span>{meeting.segments.length} Abschnitte</span>
              <span>•</span>
              <span>{meeting.speakers.length} Sprecher</span>
              <span>•</span>
              <span>{new Date(meeting.date).toLocaleDateString('de-DE')}</span>
            </div>
          </div>

          {/* Action buttons: Append Recording, AI Retranscription & Task Extraction */}
          <div className="flex items-center gap-2 flex-wrap">
            {onAppendRecording && (
              <button
                type="button"
                onClick={() => setIsAppendModalOpen(true)}
                disabled={isAppending || isExtractingTasks || isRetranscribing}
                className="btn-secondary text-xs shrink-0 flex items-center gap-1.5 hover:border-blue-500/50 cursor-pointer"
                title="Weiteren Audioabschnitt aufnehmen oder hochladen und an dieses Meeting anhängen"
              >
                <Mic className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{isAppending ? 'Wird angehängt...' : 'Aufnahme hinzufügen'}</span>
              </button>
            )}

            {onRetranscribe && (
              <button
                type="button"
                onClick={onRetranscribe}
                disabled={isRetranscribing || isAppending || !meeting.audioBlob}
                className="btn-secondary text-xs shrink-0 flex items-center gap-1.5"
                title="Das Meeting noch einmal mit dem KI-Sprachmodell analysieren"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetranscribing ? 'animate-spin text-blue-600' : ''}`} />
                <span>{isRetranscribing ? 'Transkribiere neu...' : 'Erneute AI-Transkription'}</span>
              </button>
            )}

            <button
              onClick={onExtractTasks}
              disabled={isExtractingTasks || isAppending || meeting.segments.length === 0}
              className="btn-primary text-xs shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isExtractingTasks ? 'Analysiere' : 'Tasks erstellen'}</span>
            </button>
          </div>
        </div>

        {/* Hintergrund-Verarbeitungs-Jobs für dieses Meeting */}
        <MeetingJobsList jobs={jobs.filter((j) => j.meetingId === meeting.id)} />

        {/* Sprecher erscheinen als Liste direkt unter Meeting */}
        {meeting.speakers.length > 0 && (
          <div 
            className="pt-3 border-t space-y-2"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Sprecher</span>
              </span>
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
              const isSegHovered = hoveredSegmentId === seg.id;

              return (
                <div
                  key={seg.id}
                  className={`absolute top-1 bottom-1 rounded transition-all duration-100 ${
                    isSegActive ? 'ring-2 ring-blue-500 z-10' : ''
                  } ${isSegPlaying ? 'animate-pulse z-10 ring-2 ring-red-500' : ''} ${
                    isSegHovered ? 'scale-y-125 brightness-125 z-20 shadow-lg ring-2 ring-blue-400 dark:ring-blue-300' : 'opacity-85 hover:opacity-100'
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
                    setTimelineHoveredSegment(seg);
                    setHoveredSegmentId(seg.id);
                    setTooltipX(leftPct + widthPct / 2);
                  }}
                />
              );
            })}
          </div>

          {/* Hover Tooltip showing speaker, time & spoken text - ONLY when hovering directly on timeline */}
          {timelineHoveredSegment && (
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
                      style={{ backgroundColor: speakerMap.get(timelineHoveredSegment.speakerId)?.color || '#3b82f6' }}
                    />
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {speakerMap.get(timelineHoveredSegment.speakerId)?.assignedName || speakerMap.get(timelineHoveredSegment.speakerId)?.label || timelineHoveredSegment.speakerLabel}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">
                    {formatTimestamp(timelineHoveredSegment.startTime)} – {formatTimestamp(timelineHoveredSegment.endTime)}
                  </span>
                </div>

                {/* Spoken Text Preview */}
                <p className="text-[11px] text-[var(--text-secondary)] italic line-clamp-3 leading-relaxed">
                  "{timelineHoveredSegment.text}"
                </p>
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

      {/* 2. EIN Kasten mit der Transkription (Leichter Textkasten im Dialogformat) */}
      <div 
        className="rounded-xl border shadow-[var(--shadow-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {/* Header: 'Transkription' */}
        <div 
          className="px-4 py-3 border-b flex items-center justify-between bg-[var(--bg-subtle)]"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Transkription
            </h3>
          </div>
          {activeSegmentId && (
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium animate-pulse">
              Stelle fokussiert
            </span>
          )}
        </div>

        {/* Leichter Textkasten im Dialogstil: Name: Transkription */}
        <div 
          ref={chatContainerRef}
          className="max-h-[580px] overflow-y-auto p-4 sm:p-5 space-y-2 scroll-smooth font-normal"
        >
          {meeting.segments.map((seg) => {
            const speaker = speakerMap.get(seg.speakerId);
            const isPlaying = playingSegmentId === seg.id;
            const isActive = activeSegmentId === seg.id;
            const isHovered = hoveredSegmentId === seg.id;
            const speakerName = speaker?.assignedName || speaker?.label || seg.speakerLabel;

            return (
              <div
                key={seg.id}
                id={`transcript-seg-${seg.id}`}
                className={`group flex items-start gap-2.5 py-1 px-2.5 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-blue-500/50' 
                    : isPlaying 
                      ? 'bg-amber-50/60 dark:bg-amber-950/30 ring-1 ring-amber-500/40'
                      : isHovered
                        ? 'bg-[var(--bg-subtle)] ring-1 ring-[var(--border-color)]'
                        : 'hover:bg-[var(--bg-subtle)]'
                }`}
                onMouseEnter={() => {
                  setHoveredSegmentId(seg.id);
                }}
                onMouseLeave={() => {
                  setHoveredSegmentId((prev) => (prev === seg.id ? null : prev));
                }}
              >
                {/* Audio Snippet Playback Button (subtle, shows on hover or when playing) */}
                <button
                  type="button"
                  onClick={() => handlePlaySegment(seg)}
                  className={`mt-0.5 p-1 rounded transition-all cursor-pointer shrink-0 ${
                    isPlaying 
                      ? 'opacity-100 text-red-600 bg-red-100 dark:bg-red-950/50' 
                      : 'opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                  title={isPlaying ? 'Wiedergabe stoppen' : `Originalton abspielen (${formatTimestamp(seg.startTime)})`}
                  aria-label="Originalton abspielen"
                >
                  {isPlaying ? (
                    <Square className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                </button>

                {/* Dialog: Name: Transkription */}
                <div className="flex-1 min-w-0 text-sm leading-relaxed">
                  <span
                    className="font-semibold mr-1.5 select-none cursor-pointer hover:underline"
                    style={{ color: speaker?.color || '#3b82f6' }}
                    onClick={() => onRequestClarification(seg.speakerId)}
                    title="Klicken, um Sprecher anzupassen"
                  >
                    {speakerName}:
                  </span>
                  <span className="text-[var(--text-primary)] select-text font-normal">
                    {seg.text}
                  </span>
                  <span className="ml-2 text-[10px] font-mono text-[var(--text-muted)] opacity-0 group-hover:opacity-75 transition-opacity select-none inline-block">
                    {formatTimestamp(seg.startTime)}
                  </span>
                </div>
              </div>
            );
          })}

        </div>
      </div>

      {/* Modal to record or upload additional audio */}
      {isAppendModalOpen && onAppendRecording && (
        <AppendRecordingModal
          isOpen={isAppendModalOpen}
          meeting={meeting}
          onClose={() => setIsAppendModalOpen(false)}
          onAppendRecording={async (blob, mime, dur) => {
            await onAppendRecording(blob, mime, dur);
            setIsAppendModalOpen(false);
          }}
          isProcessing={Boolean(isAppending)}
          hasApiKey={Boolean(hasApiKey)}
          onOpenSettings={onOpenSettings || (() => {})}
        />
      )}
    </div>
  );
};
