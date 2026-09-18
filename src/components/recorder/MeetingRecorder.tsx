import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Sparkles, Play, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { AudioRecorder } from '../../services/audio/AudioRecorder';
import { formatDuration } from '../../utils/dateUtils';

interface MeetingRecorderProps {
  onRecordingComplete: (audioBlob: Blob, mimeType: string, durationSeconds: number, title: string) => Promise<void>;
  onLoadDemo: () => Promise<void>;
  onOpenSettings: () => void;
  hasApiKey: boolean;
  isProcessing: boolean;
  processingStep: string;
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({
  onRecordingComplete,
  onLoadDemo,
  onOpenSettings,
  hasApiKey,
  isProcessing,
  processingStep
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

    const barCount = 32;
    const barWidth = width / barCount - 2;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * frequencyData.length);
      const val = frequencyData[dataIndex] || 0;
      const percent = val / 255;
      const barHeight = Math.max(4, percent * height * 0.9);

      const x = i * (barWidth + 2);
      const y = (height - barHeight) / 2;

      // Dynamic gradient based on volume
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, '#60a5fa');
      gradient.addColorStop(1, '#3b82f6');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
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
    setIsRecording(false);

    try {
      const { blob, mimeType, durationSeconds } = await recorderRef.current.stop();
      recorderRef.current = null;

      const title = meetingTitle.trim() || `Meeting vom ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
      await onRecordingComplete(blob, mimeType, durationSeconds, title);
    } catch (err) {
      console.error('Fehler beim Beenden der Aufnahme:', err);
      setErrorMsg('Fehler beim Verarbeiten der Audioaufnahme.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const title = meetingTitle.trim() || file.name.replace(/\.[^/.]+$/, '');

    // Estimate duration via Audio element
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
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* API Key Status Notice if Missing */}
      {!hasApiKey && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-300 text-sm">OpenRouter API-Key erforderlich für echte Transkription</p>
              <p className="text-amber-200/80 mt-0.5">
                Ohne Key kann dein gesprochenes Audio nicht verarbeitet werden. Bitte trage deinen Key ein.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shrink-0 transition-colors cursor-pointer shadow-sm"
          >
            Key jetzt eintragen
          </button>
        </div>
      )}

      {/* Title Input Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Meeting-Bezeichnung
        </label>
        <input
          type="text"
          placeholder="z.B. Sprint Planning, Projekt-Update, Kunden-Kickoff..."
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          disabled={isRecording || isProcessing}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base disabled:opacity-50"
        />
      </div>

      {/* Main Recording Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
        {/* Glowing Background Blob */}
        {isRecording && (
          <div className="absolute inset-0 bg-blue-600/10 pointer-events-none animate-pulse" />
        )}

        {/* Live Audio Visualizer Canvas */}
        <div className="w-full max-w-md h-20 mb-6 bg-slate-950/70 rounded-2xl p-2 border border-slate-800/80 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={320}
            height={60}
            className="w-full h-full"
          />
        </div>

        {/* Duration Timer */}
        <div className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-white mb-6">
          {formatDuration(duration)}
        </div>

        {/* Recording Toggle Button */}
        {!isProcessing ? (
          <div>
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="group relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="Aufnahme starten"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-white/30 flex items-center justify-center">
                  <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-white group-hover:scale-110 transition-transform" />
                </div>
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-xl shadow-red-600/30 transition-all cursor-pointer animate-pulse"
                title="Aufnahme stoppen & verarbeiten"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-white/40 flex items-center justify-center">
                  <Square className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" />
                </div>
              </button>
            )}
            <p className="mt-4 text-sm font-medium text-slate-300">
              {isRecording ? 'Aufnahme läuft – Klicke zum Stoppen' : 'Mikrofon starten'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" />
            <div>
              <p className="text-base font-semibold text-white">{processingStep}</p>
              <p className="text-xs text-slate-400 mt-1">Sprecher werden diarisiert & analysiert...</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-xs text-left max-w-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Alternative Options: Upload & Demo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Upload Audio File */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-slate-800 text-blue-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Audio-Datei importieren</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Unterstützt WebM, MP3, WAV, M4A & AAC
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
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-xl border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Datei auswählen
          </button>
        </div>

        {/* Demo Meeting One-Click Loader */}
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-900/50 rounded-2xl p-5 hover:border-indigo-800/80 transition-colors flex flex-col justify-between">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Beispiel-Meeting laden</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Sprint Planning mit Florian, Sarah & Alex inkl. Sprecher-Klärung
              </p>
            </div>
          </div>
          <button
            onClick={onLoadDemo}
            disabled={isRecording || isProcessing}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Demo-Meeting simulieren</span>
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p>
          <strong>Diarisierungs-Garantie:</strong> Personen, die namentlich angesprochen werden und antworten, werden automatisch mit Namen im Transkript geführt. Bei unklaren Stimmen fragt die App dich mit einem kurzen Tonschnipsel.
        </p>
      </div>
    </div>
  );
};
