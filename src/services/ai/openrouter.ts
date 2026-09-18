import { OpenRouterConfig } from '../../types';

export class OpenRouterClient {
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = config;
  }

  hasApiKey(): boolean {
    return Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0);
  }

  getConfig(): OpenRouterConfig {
    return this.config;
  }

  /**
   * Send a prompt with optional system instructions, JSON schema enforcement,
   * audio data, and live streaming of reasoning/content tokens.
   */
  async chatCompletion(options: {
    prompt: string;
    system?: string;
    model?: string;
    temperature?: number;
    jsonResponse?: boolean;
    audioData?: { base64: string; mimeType: string };
    stream?: boolean;
    onReasoning?: (chunk: string) => void;
    onContent?: (chunk: string) => void;
  }): Promise<string> {
    if (!this.hasApiKey()) {
      throw new Error('Kein OpenRouter API-Key konfiguriert. Bitte in den Einstellungen hinterlegen.');
    }

    const model = options.model || this.config.model || 'google/gemini-3.8-flash';

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
              format: options.audioData.mimeType.includes('mp3') ? 'mp3' : 'wav'
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

    const isStreaming = Boolean(options.stream || options.onReasoning || options.onContent);

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.2
    };

    if (options.jsonResponse && !isStreaming) {
      payload.response_format = { type: 'json_object' };
    }

    if (isStreaming) {
      payload.stream = true;

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
          // fallback to statusText
        }
        throw new Error(`OpenRouter API Fehler (${response.status}): ${errDetail}`);
      }

      if (!response.body) {
        throw new Error('Streaming-Verbindung enthält keinen Body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta) {
              // Capture reasoning if emitted by models (Gemini 2.5/3.8, DeepSeek R1/V3, etc.)
              if (delta.reasoning && options.onReasoning) {
                options.onReasoning(delta.reasoning);
              }
              if (delta.content) {
                fullContent += delta.content;
                if (options.onContent) {
                  options.onContent(delta.content);
                }
              }
            }
          } catch {
            // Ignore incomplete stream chunk
          }
        }
      }

      return fullContent;
    }

    // Standard non-streaming fetch
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
