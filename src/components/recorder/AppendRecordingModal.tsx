import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, Square, AlertCircle } from 'lucide-react';
import { AudioRecorder } from '../../services/audio/AudioRecorder';
import { formatDuration } from '../../utils/dateUtils';
import { Meeting } from '../../types';
import { ProcessingProgressBar } from './ProcessingProgressBar';

interface AppendRecordingModalProps {
  isOpen: boolean;
  meeting: Meeting;
  onClose: () => void;
  onAppendRecording: (audioBlob: Blob, mimeType: string, durationSeconds: number) => Promise<void>;
  isProcessing: boolean;
  processingStep?: string;
  hasApiKey: boolean;
  onOpenSettings: () => void;
}

export const AppendRecordingModal: React.FC<AppendRecordingModalProps> = ({
  isOpen,
  meeting,
  onClose,
  onAppendRecording,
  isProcessing,
  processingStep = '',
  hasApiKey,
  onOpenSettings
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasStartedRef = useRef(false);

  // Draw audio waveform on canvas
  const drawWaveform = (frequencyData: Uint8Array) => {
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

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }
  };

  const startRecordingImmediate = async () => {
    setErrorMsg(null);
    try {
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      await recorder.start(
        (freqData) => {
          drawWaveform(freqData);
        },
        (elapsedSecs) => {
          setDuration(elapsedSecs);
        }
      );

      setIsRecording(true);
    } catch (err) {
      console.error('Mikrofonfehler:', err);
      setErrorMsg('Mikrofonzugriff wurde verweigert oder ist nicht verfügbar.');
      setIsRecording(false);
    }
  };

  // Start recording IMMEDIATELY with timer as soon as modal opens
  useEffect(() => {
    if (isOpen && !isProcessing && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setDuration(0);
      startRecordingImmediate();
    }
    if (!isOpen) {
      hasStartedRef.current = false;
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
      setIsRecording(false);
      setDuration(0);
      setErrorMsg(null);
    }
  }, [isOpen, isProcessing]);

  // Stop recording and directly trigger background append & transcription
  const handleStopAndAppend = async () => {
    if (!recorderRef.current) return;
    try {
      const { blob, mimeType, durationSeconds } = await recorderRef.current.stop();
      setIsRecording(false);
      recorderRef.current = null;
      // Close modal immediately so the user can continue viewing the meeting
      onClose();
      // Start background processing
      onAppendRecording(blob, mimeType, Math.max(1, durationSeconds));
    } catch (err) {
      console.error('Fehler beim Beenden der Aufnahme:', err);
      setErrorMsg('Fehler beim Beenden der Aufnahme.');
      setIsRecording(false);
    }
  };

  const handleCancel = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsRecording(false);
    setDuration(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md p-5 sm:p-6 rounded-xl border shadow-2xl relative"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--shadow-modal)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Aufnahme an Meeting anhängen
              </h2>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-[260px] sm:max-w-xs">
                Ziel: <span className="font-medium text-[var(--text-secondary)]">{meeting.title}</span>
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* API-Key Warning if missing */}
        {!hasApiKey && (
          <div className="mb-4 p-3 rounded-lg border flex items-start gap-2.5 text-xs badge-at-risk">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">OpenRouter API-Key erforderlich</span>
              <p className="mt-0.5 opacity-90">
                Zum Transkribieren wird ein API-Key benötigt.
              </p>
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                Key in Einstellungen eintragen →
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-lg border text-xs flex items-center gap-2 badge-off-track">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Processing State with Progress Bar */}
        {isProcessing ? (
          <div className="py-3">
            <ProcessingProgressBar currentStep={processingStep || 'Neuer Gesprächsabschnitt wird verarbeitet...'} />
          </div>
        ) : (
          /* Live Recording with running Timer and Waveform */
          <div className="space-y-4 py-2 text-center">
            {/* Live Waveform Canvas */}
            <div className="h-16 flex items-center justify-center bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-color)] overflow-hidden px-4">
              <canvas ref={canvasRef} width={280} height={48} className="w-full h-12" />
            </div>

            {/* Running Live Timer */}
            <div>
              <div className="font-mono text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                {formatDuration(duration)}
              </div>
              <p className="text-xs text-red-500 dark:text-red-400 mt-1 font-medium animate-pulse flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>Aufnahme läuft...</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary text-xs py-2.5 px-4"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleStopAndAppend}
                className="py-2.5 px-5 rounded-lg text-xs font-semibold flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-md transition-all active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Aufnahme beenden & anhängen</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
