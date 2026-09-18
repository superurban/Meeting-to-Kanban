import React, { useState } from 'react';
import { X, Key, CheckCircle, AlertCircle, RefreshCw, ExternalLink, Trash2, Mic, Sparkles } from 'lucide-react';
import { OpenRouterConfig } from '../../types';
import { OpenRouterClient } from '../../services/ai/openrouter';

interface SettingsModalProps {
  isOpen: boolean;
  config: OpenRouterConfig;
  onSave: (config: OpenRouterConfig) => void;
  onClose: () => void;
  onResetData: () => void;
}

const AUDIO_MODELS = [
  { id: 'google/gemini-3.8-flash', name: 'Google: Gemini 3.8 Flash (Beste Empfehlung: Neueste Generation & präziseste Sprechertrennung)', provider: 'Google' },
  { id: 'google/gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash (Schnell & sehr günstig: $0.30/1M Token)', provider: 'Google' },
  { id: 'google/gemini-flash-latest', name: 'Google: Gemini Flash Latest (Verweist automatisch immer auf das neueste Modell)', provider: 'Google' },
  { id: 'google/gemini-2.5-pro', name: 'Google: Gemini 2.5 Pro (Für hallige Konferenzräume & schwere Akustik)', provider: 'Google' }
];

const SUMMARY_MODELS = [
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek-V3 / Flash (Favorit: Extrem präzise Aufgaben & kostengünstig)', provider: 'DeepSeek' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek-R1 (Tiefes Reasoning bei unklaren Aufgaben)', provider: 'DeepSeek' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (Ultra-schnell, 1M+ Token Kontext)', provider: 'Google' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Höchste Sprach- & Analyse-Qualität)', provider: 'Anthropic' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (Omni)', provider: 'OpenAI' }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  config,
  onSave,
  onClose,
  onResetData
}) => {
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [audioModel, setAudioModel] = useState(config.audioModel || 'google/gemini-2.0-flash-001');
  const [summaryModel, setSummaryModel] = useState(config.summaryModel || 'deepseek/deepseek-chat');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Bitte gib zuerst einen API-Key ein.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const client = new OpenRouterClient({
        ...config,
        apiKey: apiKey.trim(),
        model: summaryModel,
        summaryModel
      });

      const res = await client.chatCompletion({
        prompt: 'Antworte mit genau einem Wort: OK',
        temperature: 0.1
      });

      if (res.includes('OK') || res.length > 0) {
        setTestResult({ success: true, message: `Verbindung zu OpenRouter erfolgreich (${summaryModel})!` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verbindungsfehler';
      setTestResult({ success: false, message: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...config,
      apiKey: apiKey.trim(),
      model: summaryModel,
      audioModel,
      summaryModel
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">OpenRouter & KI-Modell Einstellungen</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                OpenRouter API Key
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <span>Key generieren</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Wird sicher lokal in deinem Browser (LocalStorage / IndexedDB) gespeichert.
            </p>
          </div>

          {/* Audio Diarization Model Selection */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-blue-400" />
              1. Modell für Audio & Multi-Speaker Erkennung
            </label>
            <select
              value={audioModel}
              onChange={(e) => setAudioModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AUDIO_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Verarbeitet das Roh-Audio direkt und trennt Stimmen anhand von Timbre, Pausen und Tonhöhe.
            </p>
          </div>

          {/* Semantic Summarization & Kanban Model Selection */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              2. Modell für semantische Zusammenfassung & Kanban
            </label>
            <select
              value={summaryModel}
              onChange={(e) => setSummaryModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SUMMARY_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Analysiert das Transkript, leitet Fälligkeiten ab und extrahiert saubere Action Items.
            </p>
          </div>

          {/* Test connection */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isTesting || !apiKey.trim()}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verbindung wird getestet...</span>
                </>
              ) : (
                <span>API-Key & Modell testen</span>
              )}
            </button>

            {testResult && (
              <div
                className={`mt-2 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Danger Zone: Reset Data */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Lokale Meetings & Cache</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Möchtest du wirklich alle lokalen Meetings und Audiodaten löschen?')) {
                  onResetData();
                  onClose();
                }
              }}
              className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 p-1 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Daten leeren</span>
            </button>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Schließen
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              Einstellungen speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
