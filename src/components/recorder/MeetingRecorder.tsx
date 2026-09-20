import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle } from 'lucide-react';
import { AudioRecorder } from '../../services/audio/AudioRecorder';
import { formatDuration } from '../../utils/dateUtils';
import { ProcessingProgressBar } from './ProcessingProgressBar';

interface MeetingRecorderProps {
  onRecordingComplete: (audioBlob: Blob, mimeType: string, durationSeconds: number) => Promise<void>;
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
  processingStep
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

      // Directly start transcription and AI processing immediately
      await onRecordingComplete(blob, mimeType, durationSeconds);
    } catch (err) {
      console.error('Fehler beim Stoppen:', err);
      setErrorMsg('Fehler beim Beenden der Aufnahme.');
      setIsRecording(false);
    }
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
          <ProcessingProgressBar currentStep={processingStep} />
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 text-xs text-left max-w-md badge-off-track">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
