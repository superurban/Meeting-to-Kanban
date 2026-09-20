import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, Square, Play, Pause, Upload, AlertCircle, FileAudio, Sparkles, RefreshCw } from 'lucide-react';
import { AudioRecorder } from '../../services/audio/AudioRecorder';
import { formatDuration } from '../../utils/dateUtils';
import { Meeting } from '../../types';

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
  const [tab, setTab] = useState<'mic' | 'upload'>('mic');
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prepared audio ready for appending
  const [pendingAudio, setPendingAudio] = useState<{
    blob: Blob;
    mimeType: string;
    durationSeconds: number;
    filename?: string;
  } | null>(null);

  // Audio preview playback
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // Reset state when modal is opened / closed
  useEffect(() => {
    if (!isOpen) {
      if (isRecording && recorderRef.current) {
        recorderRef.current.stop();
        setIsRecording(false);
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      }
      setPendingAudio(null);
      setDuration(0);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const drawWaveform = (frequencyData: Uint8Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barCount = 32;
    const barWidth = width / barCount - 2;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * frequencyData.length);
      const val = frequencyData[dataIndex] || 0;
      const percent = val / 255;
      const barHeight = Math.max(3, percent * height * 0.85);

      const x = i * (barWidth + 2);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }
  };

  const handleStartRecording = async () => {
    setErrorMsg(null);
    setPendingAudio(null);
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
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current) return;
    try {
      const { blob, mimeType, durationSeconds } = await recorderRef.current.stop();
      setIsRecording(false);
      setDuration(durationSeconds);

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewUrlRef.current = URL.createObjectURL(blob);

      setPendingAudio({
        blob,
        mimeType,
        durationSeconds: Math.max(1, durationSeconds)
      });
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
    try {
      // Decode file duration via AudioContext
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const ab = await file.arrayBuffer();
      let durationSeconds = 10;
      try {
        const audioBuffer = await ctx.decodeAudioData(ab.slice(0));
        durationSeconds = audioBuffer.duration;
      } catch {
        // fallback duration approximation
      } finally {
        ctx.close();
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewUrlRef.current = URL.createObjectURL(file);

      setPendingAudio({
        blob: file,
        mimeType: file.type || 'audio/wav',
        durationSeconds,
        filename: file.name
      });
    } catch (err) {
      console.error('Fehler beim Laden der Audiodatei:', err);
      setErrorMsg('Die Audiodatei konnte nicht dekodiert werden.');
    }
  };

  const togglePreviewPlayback = () => {
    if (!previewAudioRef.current && previewUrlRef.current) {
      previewAudioRef.current = new Audio(previewUrlRef.current);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
      previewAudioRef.current.onerror = () => setIsPlayingPreview(false);
    }

    if (!previewAudioRef.current) return;

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play().catch(() => setIsPlayingPreview(false));
      setIsPlayingPreview(true);
    }
  };

  const handleConfirmAppend = async () => {
    if (!pendingAudio || isProcessing) return;
    await onAppendRecording(pendingAudio.blob, pendingAudio.mimeType, pendingAudio.durationSeconds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg p-5 sm:p-6 rounded-xl border shadow-2xl relative max-h-[92vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--shadow-modal)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Aufnahme an Meeting anhängen
              </h2>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-[280px] sm:max-w-sm">
                Ziel: <span className="font-medium text-[var(--text-secondary)]">{meeting.title}</span>
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* API-Key Status Warning if missing */}
        {!hasApiKey && (
          <div className="mb-4 p-3 rounded-lg border flex items-start gap-2.5 text-xs badge-at-risk">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">OpenRouter API-Key erforderlich</span>
              <p className="mt-0.5 opacity-90">
                Zum Transkribieren und Diarisieren des neuen Audioabschnitts wird ein API-Key benötigt.
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

        {/* Mode Selector (Microphone vs File Upload) */}
        {!isProcessing && !pendingAudio && (
          <div className="flex rounded-lg p-1 bg-[var(--bg-subtle)] border border-[var(--border-color)] mb-4">
            <button
              type="button"
              onClick={() => { setTab('mic'); setErrorMsg(null); }}
              disabled={isRecording}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'mic'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Mikrofon aufnehmen</span>
            </button>
            <button
              type="button"
              onClick={() => { setTab('upload'); setErrorMsg(null); }}
              disabled={isRecording}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'upload'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Audiodatei hochladen</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-lg border text-xs flex items-center gap-2 badge-off-track">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Processing State (Transcription & Diarization running) */}
        {isProcessing ? (
          <div className="py-8 px-4 text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-600 animate-spin" />
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 absolute" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Neuen Abschnitt transkribieren & integrieren...
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1 animate-pulse">
                {processingStep || 'KI-Diarisierung und Zeitanpassung laufen...'}
              </p>
            </div>
          </div>
        ) : pendingAudio ? (
          /* Preview State (Recording or Upload complete, ready to submit) */
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl border bg-[var(--bg-subtle)] space-y-3" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <FileAudio className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{pendingAudio.filename || 'Neue Aufnahme'}</span>
                </span>
                <span className="badge-neutral text-xs font-mono py-0.5 px-2">
                  Dauer: {formatDuration(pendingAudio.durationSeconds)}
                </span>
              </div>

              {/* Audio Playback Preview */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={togglePreviewPlayback}
                  className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer shrink-0"
                  title={isPlayingPreview ? 'Vorschau pausieren' : 'Vorschau anhören'}
                >
                  {isPlayingPreview ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
                <div className="flex-1 text-xs text-[var(--text-muted)]">
                  <span>{isPlayingPreview ? 'Audio wird abgespielt...' : 'Klicken zum Vorhören der neuen Aufnahme'}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              💡 Dieser neue Abschnitt wird an das bestehende Meeting angehängt, die Zeitleiste wird nahtlos erweitert und neue Aufgaben werden automatisch ergänzt.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingAudio(null);
                  if (previewAudioRef.current) previewAudioRef.current.pause();
                  setIsPlayingPreview(false);
                }}
                className="btn-secondary text-xs"
              >
                Neu aufnehmen
              </button>
              <button
                type="button"
                onClick={handleConfirmAppend}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Transkribieren & Anhang speichern</span>
              </button>
            </div>
          </div>
        ) : tab === 'mic' ? (
          /* Microphone Recording State */
          <div className="space-y-4 py-3 text-center">
            {/* Visualizer Canvas */}
            <div className="h-16 flex items-center justify-center bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-color)] overflow-hidden px-4">
              {isRecording ? (
                <canvas ref={canvasRef} width={280} height={48} className="w-full h-12" />
              ) : (
                <span className="text-xs text-[var(--text-muted)]">
                  Bereit zur Aufnahme über das Mikrofon
                </span>
              )}
            </div>

            {/* Timer */}
            <div className="font-mono text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {formatDuration(duration)}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="btn-primary py-2.5 px-5 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Mic className="w-4 h-4 text-red-400" />
                  <span>Aufnahme starten</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="py-2.5 px-5 rounded-lg text-xs font-semibold flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-md transition-all animate-pulse"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Aufnahme beenden & prüfen</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* File Upload State */
          <div className="space-y-4 py-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border-color)] hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-[var(--bg-subtle)]/50 space-y-2"
            >
              <Upload className="w-8 h-8 mx-auto text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Audiodatei auswählen oder hierher ziehen
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  WAV, MP3, M4A, WebM, OGG (max. 100 MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
