import { TranscriptSegment } from '../../types';
import { OpenRouterClient } from './openrouter';

export class TranscriptionService {
  /**
   * Converts Blob to Base64 string
   */
  static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip data:audio/xyz;base64, prefix
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Transcribes audio using OpenRouter multimodal model with speaker diarization
   */
  static async transcribeAudio(
    audioBlob: Blob,
    mimeType: string,
    client: OpenRouterClient
  ): Promise<TranscriptSegment[]> {
    // 1. Convert any audio (WebM, OGG, MP4) to 16kHz mono WAV for 100% reliable API acceptance
    let processedBlob = audioBlob;
    let finalMime = 'audio/wav';
    try {
      const { convertBlobToWav } = await import('../audio/wavConverter');
      processedBlob = await convertBlobToWav(audioBlob, 16000);
    } catch (err) {
      console.warn('Browser WAV conversion error, falling back to original blob:', err);
      finalMime = mimeType;
    }

    const base64Audio = await this.blobToBase64(processedBlob);

    const prompt = `Transkribiere diese Audioaufnahme eines Meetings.
Aufgaben:
1. Erkenne unterschiedliche Sprecher und weise ihnen fortlaufende Kennungen zu (z.B. speaker_1, speaker_2, speaker_3).
2. Erfasse präzise Zeitstempel für Start- und Endzeit jedes Sprechbeitrags in Sekunden.
3. Transkribiere den tatsächlich gesprochenen Text im genauen Originalwortlaut (KEINE erfundenen Dialoge!).

Antworte ausschließlich mit einem validen JSON-Array in folgendem Format:
[
  {
    "speakerId": "speaker_1",
    "speakerLabel": "Sprecher 1",
    "startTime": 0.0,
    "endTime": 5.2,
    "text": "Tatsächlich gesprochener Satz..."
  }
]`;

    const audioModel = client.getConfig().audioModel || 'google/gemini-2.0-flash-001';

    const response = await client.chatCompletion({
      prompt,
      model: audioModel,
      system: 'Du bist ein hochpräziser Transkriptions- und Diarisierungs-Assistent. Transkribiere exakt das, was in der Audiodatei gesagt wird.',
      audioData: {
        base64: base64Audio,
        mimeType: finalMime
      },
      temperature: 0.1,
      jsonResponse: true
    });

    try {
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
      }

      let parsed = JSON.parse(cleanResponse);
      // If response is wrapped in an object like { segments: [...] } or { transcript: [...] }
      if (!Array.isArray(parsed)) {
        if (parsed.segments && Array.isArray(parsed.segments)) {
          parsed = parsed.segments;
        } else if (parsed.transcript && Array.isArray(parsed.transcript)) {
          parsed = parsed.transcript;
        } else if (parsed.speakers && Array.isArray(parsed.speakers)) {
          parsed = parsed.speakers;
        }
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Kein Sprachinhalt im Audio erkannt oder ungültige Struktur.');
      }

      return (parsed as Array<Record<string, unknown>>).map((item, index) => ({
        id: `seg_${Date.now()}_${index}`,
        speakerId: String(item.speakerId || `speaker_${(index % 3) + 1}`),
        speakerLabel: String(item.speakerLabel || `Sprecher ${item.speakerId || index + 1}`),
        startTime: Number(item.startTime || index * 5),
        endTime: Number(item.endTime || (index + 1) * 5),
        text: String(item.text || item.content || '')
      }));
    } catch (e) {
      console.error('Failed to parse transcription response:', e, response);
      throw new Error(`Die KI-Transkription konnte nicht verarbeitet werden (${e instanceof Error ? e.message : String(e)}). Rohantwort: ${response.slice(0, 150)}...`);
    }
  }

  /**
   * Generates a realistic sample meeting with 3 speakers to demonstrate:
   * - Automatic name detection (Florian is addressed by name and responds)
   * - Unidentified speaker (Sarah speaks without initial name tag -> triggers audio snippet clarification modal)
   * - Clear actionable tasks with assignees and due dates
   */
  static getSampleDemoMeeting(): {
    title: string;
    durationSeconds: number;
    segments: TranscriptSegment[];
  } {
    return {
      title: 'Sprint Planning: Voice-to-Kanban PWA & Cloudflare Launch',
      durationSeconds: 145,
      segments: [
        {
          id: 'seg_1',
          speakerId: 'speaker_1',
          speakerLabel: 'Sprecher 1',
          startTime: 0.0,
          endTime: 8.5,
          text: 'Guten Morgen zusammen! Willkommen zu unserem Sprint Planning. Wir wollen heute die Aufgaben für die Voice-to-Kanban App festzurren.'
        },
        {
          id: 'seg_2',
          speakerId: 'speaker_1',
          speakerLabel: 'Sprecher 1',
          startTime: 9.0,
          endTime: 18.2,
          text: 'Florian, kannst du die Cloudflare Worker Integration und das PWA Caching bis nächsten Freitag fertigstellen?'
        },
        {
          id: 'seg_3',
          speakerId: 'speaker_2',
          speakerLabel: 'Sprecher 2',
          startTime: 19.0,
          endTime: 30.5,
          text: 'Guten Morgen Alex! Ja, absolut, die Cloudflare-Architektur steht bereits im Entwurf. Ich implementiere die Worker-Routen und teste das Offline-Caching der PWA bis Freitag.'
        },
        {
          id: 'seg_4',
          speakerId: 'speaker_3',
          speakerLabel: 'Sprecher 3',
          startTime: 31.0,
          endTime: 44.0,
          text: 'Ich habe die Kanban-Board-UI in Figma finalisiert. Wir brauchen noch ein Feedback zu den Farbcodierungen der Prioritäten bis Mittwoch 18:00 Uhr.'
        },
        {
          id: 'seg_5',
          speakerId: 'speaker_2',
          speakerLabel: 'Sprecher 2',
          startTime: 44.5,
          endTime: 56.0,
          text: 'Das Design sieht klasse aus. Ich übernehme auch die Ton-Schnipsel-Wiedergabe mit dem Web Audio API Player, damit unerkannte Stimmen direkt per Klick abgespielt werden können.'
        },
        {
          id: 'seg_6',
          speakerId: 'speaker_1',
          speakerLabel: 'Sprecher 1',
          startTime: 57.0,
          endTime: 68.0,
          text: 'Perfekt! Ich werde die Dokumentation für den App-Store und die Cloudflare Pages Domain-Konfiguration bis Montag abschließen.'
        },
        {
          id: 'seg_7',
          speakerId: 'speaker_3',
          speakerLabel: 'Sprecher 3',
          startTime: 68.5,
          endTime: 82.0,
          text: 'Alles klar. Ich erstelle dann auch noch die Icons für den Mobile-Homescreen und teste die Touch-Gesten auf iOS und Android.'
        }
      ]
    };
  }
}
