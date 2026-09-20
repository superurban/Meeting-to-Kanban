import React, { useState } from 'react';
import { X, Key, CheckCircle, AlertCircle, RefreshCw, ExternalLink, Trash2 } from 'lucide-react';
import { OpenRouterConfig } from '../../types';
import { OpenRouterClient } from '../../services/ai/openrouter';

interface SettingsModalProps {
  isOpen: boolean;
  config: OpenRouterConfig;
  onSave: (config: OpenRouterConfig) => void;
  onClose: () => void;
  onResetData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  config,
  onSave,
  onClose,
  onResetData
}) => {
  const [apiKey, setApiKey] = useState(config.apiKey);
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
        model: config.summaryModel || 'deepseek/deepseek-chat',
        summaryModel: config.summaryModel || 'deepseek/deepseek-chat'
      });

      const res = await client.chatCompletion({
        prompt: 'Antworte mit genau einem Wort: OK',
        temperature: 0.1
      });

      if (res.includes('OK') || res.length > 0) {
        setTestResult({ success: true, message: 'Verbindung zu OpenRouter erfolgreich!' });
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
      audioModel: config.audioModel || 'google/gemini-3.8-flash',
      summaryModel: config.summaryModel || 'deepseek/deepseek-chat'
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
              OpenRouter API-Einstellungen
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
                <span>API-Key testen</span>
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
