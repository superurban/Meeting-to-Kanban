import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Sparkles, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { AudioRecorder } from '../../services/audio/AudioRecorder';
import { formatDuration } from '../../utils/dateUtils';
import { ModelReasoningBox } from './ModelReasoningBox';

interface MeetingRecorderProps {
  onRecordingComplete: (audioBlob: Blob, mimeType: string, durationSeconds: number, title: string) => Promise<void>;
  onLoadDemo: () => Promise<void>;
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
  onLoadDemo,
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

  const recorderRef = useRef<AudioRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
    };
  }, []);

  const drawWaveform = (frequencyData: Uint8Array, volume: number) => {
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

      const title = meetingTitle.trim() || `Meeting vom ${new Date().toLocaleDateString('de-DE')}`;
      await onRecordingComplete(blob, mimeType, durationSeconds, title);
    } catch (err) {
      console.error('Fehler beim Stoppen:', err);
      setErrorMsg('Fehler beim Beenden der Aufnahme.');
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const title = meetingTitle.trim() || file.name.replace(/\.[^/.]+$/, '');

    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;

    audio.onloadedmetadata = async () => {
      const durationSeconds = audio.duration || 60;
      URL.revokeObjectURL(objectUrl);
      await onRecordingComplete(file, file.type || 'audio/webm', durationSeconds, title);
    };

    audio.onerror = async () => {
      URL.revokeObjectURL(objectUrl);
      await onRecordingComplete(file, file.type || 'audio/webm', 60, title);
    };
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

      {/* Title Input Card */}
      <div 
        className="p-4 rounded-lg border shadow-[var(--shadow-subtle)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          Meeting-Bezeichnung
        </label>
        <input
          type="text"
          placeholder="z.B. Sprint Planning, Projekt-Sync, Board Meeting..."
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          disabled={isRecording || isProcessing}
          className="input-saas w-full"
        />
      </div>

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
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              {isRecording ? 'Aufnahme läuft – Klicke zum Beenden' : 'HTML5 MediaRecorder & 16kHz PCM WAV'}
            </p>
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

      {/* Alternative Options: Upload & Demo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Upload Audio File */}
        <div 
          className="p-4 rounded-lg border shadow-[var(--shadow-subtle)] flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="flex items-start gap-3 mb-3">
            <div 
              className="p-2 rounded-md shrink-0"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}
            >
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">Audio-Datei importieren</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                WebM, MP3, WAV, M4A & AAC
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isRecording || isProcessing}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording || isProcessing}
            className="btn-secondary text-xs w-full"
          >
            Datei auswählen
          </button>
        </div>

        {/* Demo Meeting Loader */}
        <div 
          className="p-4 rounded-lg border shadow-[var(--shadow-subtle)] flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="flex items-start gap-3 mb-3">
            <div 
              className="p-2 rounded-md shrink-0"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">Beispiel-Meeting laden</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Sprint Planning mit Florian, Sarah & Alex
              </p>
            </div>
          </div>
          <button
            onClick={onLoadDemo}
            disabled={isRecording || isProcessing}
            className="btn-primary text-xs w-full"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Demo-Meeting laden</span>
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div 
        className="flex items-start gap-2.5 p-3 rounded-md border text-xs"
        style={{
          backgroundColor: 'var(--bg-subtle)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-secondary)'
        }}
      >
        <Info className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
        <p>
          <strong>Executive Diarisierung:</strong> Personen, die namentlich angesprochen werden und antworten, werden automatisch im Transkript identifiziert. Bei unklaren Stimmen fragt die App dich mit einem präzisen 5s-Tonschnipsel.
        </p>
      </div>
    </div>
  );
};
