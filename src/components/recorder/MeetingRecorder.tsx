import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { AudioRecorder } from '../../services/audio/AudioRecorder';
import { formatDuration } from '../../utils/dateUtils';
import { ModelReasoningBox } from './ModelReasoningBox';

interface MeetingRecorderProps {
  onRecordingComplete: (audioBlob: Blob, mimeType: string, durationSeconds: number, title: string) => Promise<void>;
  onLoadDemo?: () => Promise<void>;
  onOpenSettings: () => void;
  hasApiKey: boolean;
  isProcessing: boolean;
  processingStep: string;
  reasoningLogs?: string[];
  liveReasoningText?: string;
  currentModelName?: string;
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({
  onRecordingComplete,
  onOpenSettings,
  hasApiKey,
  isProcessing,
  processingStep,
  reasoningLogs = [],
  liveReasoningText = '',
  currentModelName = 'Gemini 3.8 Flash'
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Query title after recording
  const [pendingAudio, setPendingAudio] = useState<{
    blob: Blob;
    mimeType: string;
    durationSeconds: number;
  } | null>(null);
  const [showTitleModal, setShowTitleModal] = useState(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
    };
  }, []);

  const drawWaveform = (frequencyData: Uint8Array, _volume: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const barCount = 36;
    const barWidth = width / barCount - 2;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * frequencyData.length);
      const val = frequencyData[dataIndex] || 0;
      const percent = val / 255;
      const barHeight = Math.max(3, percent * height * 0.85);

      const x = i * (barWidth + 2);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }
  };

  const handleStartRecording = async () => {
    setErrorMsg(null);
    try {
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      await recorder.start(
        (freqData, vol) => {
          drawWaveform(freqData, vol);
        },
        (elapsedSecs) => {
          setDuration(elapsedSecs);
        }
      );

      setIsRecording(true);
    } catch (err: unknown) {
      console.error('Mikrofonfehler:', err);
      setErrorMsg('Mikrofonzugriff wurde verweigert oder ist nicht verfügbar.');
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current) return;

    try {
      const { blob, mimeType, durationSeconds } = await recorderRef.current.stop();
      setIsRecording(false);
      setDuration(0);

      const now = new Date();
      const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const defaultTitle = `Meeting vom ${dateStr}, ${timeStr}`;

      setMeetingTitle(defaultTitle);
      setPendingAudio({ blob, mimeType, durationSeconds });
      setShowTitleModal(true);
    } catch (err) {
      console.error('Fehler beim Stoppen:', err);
      setErrorMsg('Fehler beim Beenden der Aufnahme.');
      setIsRecording(false);
    }
  };

  const handleConfirmTitle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingAudio) return;

    const title = meetingTitle.trim() || `Meeting vom ${new Date().toLocaleDateString('de-DE')}`;
    const audio = pendingAudio;
    setPendingAudio(null);
    setShowTitleModal(false);
    setMeetingTitle('');

    await onRecordingComplete(audio.blob, audio.mimeType, audio.durationSeconds, title);
  };

  const handleCancelTitle = () => {
    setPendingAudio(null);
    setShowTitleModal(false);
    setMeetingTitle('');
  };

  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4">
      {/* API Key Status Notice if Missing */}
      {!hasApiKey && (
        <div 
          className="p-3.5 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: 'var(--status-at-risk-bg)',
            borderColor: 'var(--status-at-risk-border)',
            color: 'var(--status-at-risk-text)'
          }}
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div>
              <p className="font-semibold text-xs">OpenRouter API-Key erforderlich für echte KI-Transkription</p>
              <p className="opacity-80 mt-0.5">
                Ohne API-Key kann dein gesprochenes Audio nicht verarbeitet werden. Bitte trage deinen Key ein.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="btn-primary text-xs py-1 px-3 shrink-0"
          >
            Key eintragen
          </button>
        </div>
      )}

      {/* Main Recording Console */}
      <div 
        className="p-6 sm:p-10 rounded-lg border shadow-[var(--shadow-subtle)] flex flex-col items-center justify-center text-center relative overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        {/* Live Audio Visualizer Canvas */}
        <div 
          className="w-full max-w-sm h-14 mb-4 rounded-md border p-1.5 flex items-center justify-center"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderColor: 'var(--border-color)'
          }}
        >
          <canvas
            ref={canvasRef}
            width={320}
            height={50}
            className="w-full h-full"
          />
        </div>

        {/* Duration Timer */}
        <div className="text-3xl sm:text-4xl font-mono font-semibold tracking-tight text-[var(--text-primary)] mb-5">
          {formatDuration(duration)}
        </div>

        {/* Recording Toggle Button */}
        {!isProcessing ? (
          <div>
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="btn-primary text-sm py-3 px-6 rounded-md shadow-sm hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center gap-2"
                title="Aufnahme starten"
              >
                <Mic className="w-4 h-4" />
                <span>Aufnahme starten</span>
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                className="btn-danger text-sm py-3 px-6 rounded-md shadow-sm active:scale-98 transition-all cursor-pointer flex items-center gap-2 animate-pulse"
                title="Aufnahme stoppen & verarbeiten"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Aufnahme stoppen</span>
              </button>
            )}
            {isRecording && (
              <p className="mt-3 text-xs text-[var(--text-muted)] animate-pulse">
                Aufnahme läuft – Klicke zum Beenden
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2 space-y-2.5 w-full max-w-xl">
            <RefreshCw className="w-6 h-6 text-[var(--text-primary)] animate-spin" />
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{processingStep}</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Sprecher-Diarisierung & KI-Aufgabenextraktion aktiv</p>
            </div>

            {/* Live Model Reasoning & Progress Log Box */}
            <ModelReasoningBox
              modelName={currentModelName}
              currentStep={processingStep}
              reasoningLogs={reasoningLogs}
              liveReasoningText={liveReasoningText}
              isProcessing={isProcessing}
            />
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 text-xs text-left max-w-md badge-off-track">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Query Meeting Title Modal after Recording */}
      {showTitleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="w-full max-w-md p-5 rounded-xl border shadow-[var(--shadow-modal)] animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)'
            }}
          >
            <div 
              className="flex items-center justify-between pb-3 mb-3 border-b"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Meeting-Bezeichnung festlegen
                </h3>
              </div>
            </div>

            <form onSubmit={handleConfirmTitle} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Wie soll dieses Meeting heißen?
                </label>
                <input
                  type="text"
                  autoFocus
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="z.B. Sprint Planning, Strategie-Meeting, Review..."
                  className="input-saas w-full text-sm py-2"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                  Anschließend analysiert die KI die Sprachaufnahme und extrahiert Aufgaben für dein Kanban Board.
                </p>
              </div>

              <div 
                className="flex items-center justify-end gap-2 pt-3 border-t"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <button
                  type="button"
                  onClick={handleCancelTitle}
                  className="btn-secondary text-xs"
                >
                  Aufnahme verwerfen
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                >
                  Weiter zur KI-Verarbeitung
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
