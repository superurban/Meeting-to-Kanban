import React, { useState } from 'react';
import { 
  Users, 
  FileText, 
  Volume2, 
  Play, 
  Square, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Edit3, 
  Clock, 
  MessageSquare,
  ArrowRight
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
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Sub-Tabs Switcher: Transkript & Sprecher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('transcript')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Transkript ({meeting.segments.length})</span>
          </button>
          <button
            onClick={() => onNavigateTab('speakers')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
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

      {/* Overview Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span>Erkannte Stimmen & Sprecher</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Hier kannst du alle Personen des Meetings einsehen, Stimmen per 5s-Audio-Schnipsel anhören und Namen anpassen.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-700">
              {meeting.speakers.length} {meeting.speakers.length === 1 ? 'Person' : 'Personen'} erfasst
            </span>
          </div>
        </div>
      </div>

      {/* Speaker Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              className={`bg-slate-900/90 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                is5sPlaying || isFullPlaying
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xl shadow-blue-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Speaker Identity Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar with color */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shadow-md shrink-0"
                      style={{
                        backgroundColor: `${speaker.color}25`,
                        color: speaker.color,
                        border: `2px solid ${speaker.color}60`
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
                            className="bg-slate-950 border border-blue-500 rounded-lg px-2.5 py-1 text-xs sm:text-sm text-white focus:outline-none w-36"
                          />
                          <button
                            onClick={() => handleSaveEdit(speaker.id)}
                            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                            title="Speichern"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                            {displayName}
                          </h3>
                          <button
                            onClick={() => handleStartEdit(speaker)}
                            className="text-slate-400 hover:text-slate-200 transition-colors p-1 cursor-pointer"
                            title="Namen bearbeiten"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <span className="text-[11px] text-slate-500 font-mono">
                        {speaker.label}
                      </span>
                    </div>
                  </div>

                  {/* Recognition Status Badge */}
                  <div>
                    {isAutoRecognized ? (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"
                        title={speaker.evidence || 'Im Gesprächsfluss automatisch erkannt'}
                      >
                        <Check className="w-3 h-3" />
                        <span>Erkannt</span>
                      </span>
                    ) : isIdentified ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        Zugeordnet
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Unklar</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Evidence / Reason Note */}
                {speaker.evidence && (
                  <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 mb-3">
                    <span className="text-slate-500 font-semibold">Hinweis:</span> {speaker.evidence}
                  </p>
                )}

                {/* Spoken Quote Preview */}
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 mb-3">
                  <p className="text-xs text-slate-300 italic line-clamp-2 leading-relaxed">
                    "{bestSegment.text}"
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
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
                  <div className="mb-3">
                    <span className="text-[10px] text-slate-500 block mb-1">
                      Vorschläge aus dem Meeting:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedNames.map((name) => (
                        <button
                          key={name}
                          onClick={() => onUpdateSpeakerName(speaker.id, name)}
                          className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-blue-600/30 hover:border-blue-500/50 border border-slate-700 text-slate-300 hover:text-blue-300 text-[11px] transition-colors cursor-pointer"
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Audio Snippet Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                {/* 5-second Audio Snippet Player */}
                <button
                  onClick={() => handlePlay5sSnippet(speaker, bestSegment)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    is5sPlaying
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                  }`}
                  title="Spielt exakt 5 Sekunden aus dem Sprachabschnitt ab"
                >
                  {is5sPlaying ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>5s Stopp</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>5s Hörprobe</span>
                    </>
                  )}
                </button>

                {/* Full playback fallback */}
                <button
                  onClick={() => handlePlayFullSegment(speaker, bestSegment)}
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer border ${
                    isFullPlaying
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title="Ganzen Abschnitt ohne 5s-Limit abspielen"
                >
                  {isFullPlaying ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
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
