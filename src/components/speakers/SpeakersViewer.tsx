import React, { useState } from 'react';
import { 
  Users, 
  Volume2, 
  Play, 
  Square, 
  Check, 
  AlertCircle, 
  Edit3, 
  Clock, 
  MessageSquare
} from 'lucide-react';
import { Meeting, Speaker, TranscriptSegment } from '../../types';
import { AudioSnippetPlayer } from '../../services/audio/AudioSnippetPlayer';
import { formatTimestamp } from '../../utils/dateUtils';
import { AppTab } from '../layout/Navigation';

interface SpeakersViewerProps {
  meeting: Meeting;
  onUpdateSpeakerName: (speakerId: string, newName: string) => void;
  onRequestClarification: (speakerId: string) => void;
  onNavigateTab: (tab: AppTab) => void;
}

export const SpeakersViewer: React.FC<SpeakersViewerProps> = ({
  meeting,
  onUpdateSpeakerName,
  onRequestClarification,
  onNavigateTab
}) => {
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [activePlayback, setActivePlayback] = useState<{ id: string; type: '5s' | 'full' } | null>(null);

  // Extract all suggested names mentioned in the meeting
  const suggestedNames = Array.from(
    new Set(
      meeting.segments
        .map((s) => s.addressedTo)
        .filter(Boolean) as string[]
    )
  );

  const handleStartEdit = (speaker: Speaker) => {
    setEditingSpeakerId(speaker.id);
    setEditNameValue(speaker.assignedName || speaker.label);
  };

  const handleSaveEdit = (speakerId: string) => {
    const trimmed = editNameValue.trim();
    if (trimmed) {
      onUpdateSpeakerName(speakerId, trimmed);
    }
    setEditingSpeakerId(null);
  };

  const handlePlay5sSnippet = (speaker: Speaker, bestSegment: TranscriptSegment) => {
    if (activePlayback?.id === speaker.id && activePlayback.type === '5s') {
      AudioSnippetPlayer.stopCurrent();
      setActivePlayback(null);
      return;
    }

    setActivePlayback({ id: speaker.id, type: '5s' });
    const startTime = bestSegment.startTime;
    const naturalDur = Math.max(0.5, bestSegment.endTime - bestSegment.startTime);
    const endTime = startTime + Math.min(5.0, naturalDur);

    AudioSnippetPlayer.playSnippet(
      meeting.audioBlob,
      startTime,
      endTime,
      bestSegment.text,
      (isPlaying) => {
        if (!isPlaying) setActivePlayback(null);
      },
      5.0
    );
  };

  const handlePlayFullSegment = (speaker: Speaker, bestSegment: TranscriptSegment) => {
    if (activePlayback?.id === speaker.id && activePlayback.type === 'full') {
      AudioSnippetPlayer.stopCurrent();
      setActivePlayback(null);
      return;
    }

    setActivePlayback({ id: speaker.id, type: 'full' });
    AudioSnippetPlayer.playSnippet(
      meeting.audioBlob,
      bestSegment.startTime,
      bestSegment.endTime,
      bestSegment.text,
      (isPlaying) => {
        if (!isPlaying) setActivePlayback(null);
      },
      undefined
    );
  };

  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Overview Header */}
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border shadow-[var(--shadow-subtle)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Erkannte Stimmen & Sprecher</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Sprecher einsehen, Stimmen per 5s-Audio-Schnipsel anhören und Namen anpassen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge-neutral text-xs">
            {meeting.speakers.length} {meeting.speakers.length === 1 ? 'Person' : 'Personen'} erfasst
          </span>
        </div>
      </div>

      {/* Speaker Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {meeting.speakers.map((speaker) => {
          const speakerSegments = meeting.segments.filter((s) => s.speakerId === speaker.id);
          const bestSegment = speakerSegments[0] || {
            id: 'dummy',
            speakerId: speaker.id,
            speakerLabel: speaker.label,
            startTime: 0,
            endTime: 5,
            text: 'Kein Audio-Segment vorhanden'
          };

          const is5sPlaying = activePlayback?.id === speaker.id && activePlayback.type === '5s';
          const isFullPlaying = activePlayback?.id === speaker.id && activePlayback.type === 'full';
          const isIdentified = Boolean(speaker.assignedName);
          const isAutoRecognized = speaker.confidence >= 0.8 && speaker.assignedName;
          const displayName = speaker.assignedName || speaker.label;

          // Calculate total speech duration
          const totalDuration = speakerSegments.reduce(
            (acc, s) => acc + Math.max(0, s.endTime - s.startTime),
            0
          );

          return (
            <div
              key={speaker.id}
              className={`p-4 rounded-lg border flex flex-col justify-between transition-all duration-150 ${
                is5sPlaying || isFullPlaying ? 'ring-2 ring-blue-500/30' : ''
              }`}
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: is5sPlaying || isFullPlaying ? 'var(--text-primary)' : 'var(--border-color)',
                boxShadow: 'var(--shadow-subtle)'
              }}
            >
              <div>
                {/* Speaker Identity Header */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border"
                      style={{
                        backgroundColor: `${speaker.color}15`,
                        color: speaker.color,
                        borderColor: `${speaker.color}40`
                      }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      {editingSpeakerId === speaker.id ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(speaker.id)}
                            autoFocus
                            placeholder="Name eingeben..."
                            className="input-saas text-xs w-32 py-1"
                          />
                          <button
                            onClick={() => handleSaveEdit(speaker.id)}
                            className="btn-primary text-xs py-1 px-2"
                            title="Speichern"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            {displayName}
                          </h3>
                          <button
                            onClick={() => handleStartEdit(speaker)}
                            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5 cursor-pointer"
                            title="Namen bearbeiten"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recognition Status Badge */}
                  <div>
                    {isAutoRecognized ? (
                      <span className="badge-on-track text-[10px]">
                        <Check className="w-2.5 h-2.5" />
                        <span>Erkannt</span>
                      </span>
                    ) : isIdentified ? (
                      <span className="badge-neutral text-[10px]">
                        Zugeordnet
                      </span>
                    ) : (
                      <span className="badge-at-risk text-[10px]">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span>Unklar</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Evidence / Reason Note */}
                {speaker.evidence && (
                  <p 
                    className="text-[11px] p-2 rounded-md border mb-2.5 leading-snug"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span className="font-semibold text-[var(--text-primary)]">Hinweis:</span> {speaker.evidence}
                  </p>
                )}

                {/* Spoken Quote Preview */}
                <div 
                  className="p-2.5 rounded-md border mb-2.5"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: 'var(--border-color)'
                  }}
                >
                  <p className="text-xs text-[var(--text-secondary)] italic line-clamp-2 leading-relaxed">
                    "{bestSegment.text}"
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {speakerSegments.length} Beiträge
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ca. {Math.round(totalDuration)}s Sprechzeit
                    </span>
                  </div>
                </div>

                {/* Quick Name Suggestions */}
                {!isIdentified && suggestedNames.length > 0 && (
                  <div className="mb-2.5">
                    <span className="text-[10px] text-[var(--text-muted)] block mb-1">
                      Vorschläge aus dem Meeting:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {suggestedNames.map((name) => (
                        <button
                          key={name}
                          onClick={() => onUpdateSpeakerName(speaker.id, name)}
                          className="btn-secondary text-[10px] py-0.5 px-1.5"
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Audio Snippet Action Buttons */}
              <div 
                className="pt-2.5 border-t flex items-center justify-between gap-2 mt-2"
                style={{ borderColor: 'var(--border-color)' }}
              >
                {/* 5-second Audio Snippet Player */}
                <button
                  onClick={() => handlePlay5sSnippet(speaker, bestSegment)}
                  className="btn-primary text-xs py-1 px-3"
                  title="Spielt exakt 5 Sekunden aus dem Sprachabschnitt ab"
                >
                  {is5sPlaying ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>5s Stopp</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>5s Hörprobe</span>
                    </>
                  )}
                </button>

                {/* Full playback fallback */}
                <button
                  onClick={() => handlePlayFullSegment(speaker, bestSegment)}
                  className="btn-secondary text-xs py-1 px-2.5"
                  title="Ganzen Abschnitt ohne 5s-Limit abspielen"
                >
                  {isFullPlaying ? (
                    <>
                      <Square className="w-3 h-3 fill-current text-red-500" />
                      <span>Stopp</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3 h-3" />
                      <span>Ganze Sequenz</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
