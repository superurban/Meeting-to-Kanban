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
  { id: 'google/gemini-3.8-flash', name: 'Google: Gemini 3.8 Flash (Empfohlen: Neueste Generation & präzise Sprechertrennung)', provider: 'Google' },
  { id: 'google/gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash (Schnell & sehr günstig: $0.30/1M Token)', provider: 'Google' },
  { id: 'google/gemini-flash-latest', name: 'Google: Gemini Flash Latest (Verweist automatisch auf das neueste Modell)', provider: 'Google' },
  { id: 'google/gemini-2.5-pro', name: 'Google: Gemini 2.5 Pro (Für Konferenzräume mit hoher Halligkeit)', provider: 'Google' }
];

const SUMMARY_MODELS = [
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek-V3 / Flash (Empfohlen: Extrem präzise Aufgaben & kostengünstig)', provider: 'DeepSeek' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek-R1 (Tiefes Reasoning bei komplexen Next Steps)', provider: 'DeepSeek' },
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
  const [audioModel, setAudioModel] = useState(config.audioModel || 'google/gemini-3.8-flash');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="container-large max-w-lg w-full p-5 relative max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--shadow-modal)'
        }}
      >
        <div 
          className="flex items-center justify-between pb-3 mb-3.5 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              OpenRouter & KI-Einstellungen
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                OpenRouter API Key
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
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
              className="input-saas w-full font-mono text-xs"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Wird sicher lokal in deinem Browser (IndexedDB / LocalStorage) gespeichert.
            </p>
          </div>

          {/* Audio Diarization Model Selection */}
          <div 
            className="p-3 rounded-lg border space-y-1.5"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-color)'
            }}
          >
            <label className="block text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>1. Modell für Audio & Multi-Speaker Erkennung</span>
            </label>
            <select
              value={audioModel}
              onChange={(e) => setAudioModel(e.target.value)}
              className="input-saas w-full text-xs"
            >
              {AUDIO_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--text-muted)]">
              Verarbeitet Roh-Audio und trennt Stimmen anhand von Timbre und Pausen.
            </p>
          </div>

          {/* Semantic Summarization & Kanban Model Selection */}
          <div 
            className="p-3 rounded-lg border space-y-1.5"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-color)'
            }}
          >
            <label className="block text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>2. Modell für Aufgabenextraktion & Kanban</span>
            </label>
            <select
              value={summaryModel}
              onChange={(e) => setSummaryModel(e.target.value)}
              className="input-saas w-full text-xs"
            >
              {SUMMARY_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--text-muted)]">
              Analysiert das Transkript und extrahiert Aufgaben, Zuständige und Fälligkeiten.
            </p>
          </div>

          {/* Test connection */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isTesting || !apiKey.trim()}
              className="btn-secondary w-full text-xs"
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
                className={`mt-2 p-2.5 rounded-md text-xs flex items-center gap-2 border ${
                  testResult.success
                    ? 'badge-on-track'
                    : 'badge-off-track'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Danger Zone: Reset Data */}
          <div 
            className="pt-2.5 border-t flex items-center justify-between"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="text-[11px] text-[var(--text-muted)]">Gesamte Datenbank zurücksetzen</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Möchtest du wirklich alle lokalen Meetings und Audiodaten löschen?')) {
                  onResetData();
                  onClose();
                }
              }}
              className="text-red-600 dark:text-red-400 hover:underline text-xs flex items-center gap-1 cursor-pointer font-medium"
            >
              <Trash2 className="w-3 h-3" />
              <span>Alle Daten leeren</span>
            </button>
          </div>

          {/* Buttons */}
          <div 
            className="flex items-center justify-end gap-2 pt-3 border-t"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
            >
              Schließen
            </button>
            <button
              type="submit"
              className="btn-primary text-xs"
            >
              Einstellungen speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
