import { OpenRouterConfig } from '../../types';

export class OpenRouterClient {
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = config;
  }

  hasApiKey(): boolean {
    return Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0);
  }

  /**
   * Send a prompt with optional system instructions and JSON schema enforcement
   */
  async chatCompletion(options: {
    prompt: string;
    system?: string;
    model?: string;
    temperature?: number;
    jsonResponse?: boolean;
    audioData?: { base64: string; mimeType: string };
  }): Promise<string> {
    if (!this.hasApiKey()) {
      throw new Error('Kein OpenRouter API-Key konfiguriert. Bitte in den Einstellungen hinterlegen.');
    }

    const model = options.model || this.config.model || 'google/gemini-2.0-flash-001';

    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string | Array<Record<string, unknown>>;
    }> = [];

    if (options.system) {
      messages.push({
        role: 'system',
        content: options.system
      });
    }

    if (options.audioData) {
      // Multimodal audio content format
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: options.prompt
          },
          {
            type: 'input_audio',
            input_audio: {
              data: options.audioData.base64,
              format: options.audioData.mimeType.includes('wav')
                ? 'wav'
                : options.audioData.mimeType.includes('mp4')
                ? 'mp4'
                : 'webm'
            }
          }
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: options.prompt
      });
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.2
    };

    if (options.jsonResponse) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey.trim()}`,
        'HTTP-Referer': this.config.siteUrl || window.location.origin,
        'X-Title': this.config.appName || 'VoiceToKanban'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errDetail = response.statusText;
      try {
        const errorJson = await response.json();
        errDetail = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        // use statusText
      }
      throw new Error(`OpenRouter API Fehler (${response.status}): ${errDetail}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('Keine Antwort von OpenRouter erhalten.');
    }

    return reply;
  }
}
