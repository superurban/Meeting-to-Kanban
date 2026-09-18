import { Speaker, TranscriptSegment, SpeakerClarificationRequest } from '../../types';
import { OpenRouterClient } from './openrouter';

const SPEAKER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316'  // orange
];

export class SpeakerDeductionService {
  /**
   * Detects speaker names based on direct address patterns in the conversation:
   * e.g. Speaker 1: "Florian, kannst du..." -> Speaker 2: "Ja, mache ich..." => Speaker 2 = Florian
   */
  static analyzeHeuristics(segments: TranscriptSegment[]): {
    speakers: Map<string, Partial<Speaker>>;
  } {
    const speakerMap = new Map<string, Partial<Speaker>>();

    // Common German address patterns
    // e.g. "Florian, kannst du", "Hallo Florian, ...", "Danke Sarah", "Was denkst du, Alex?"
    const addressPatterns = [
      /(?:hallo|hey|hi|sag mal|sag bitte|frage an)\s+([A-ZÄÖÜ][a-zäöüß]+)/i,
      /([A-ZÄÖÜ][a-zäöüß]+),\s*(?:kannst|könntest|hast|machst|übernimmst|wirst|wie|was|denkst|meinst|bist)/i,
      /(?:danke|vielen dank|super),?\s+([A-ZÄÖÜ][a-zäöüß]+)/i,
      /(?:was meinst du|was sagst du|wie sieht es aus bei dir),?\s+([A-ZÄÖÜ][a-zäöüß]+)/i
    ];

    // Non-name words that might be capitalized after comma or at start
    const blacklistWords = new Set([
      'aber', 'also', 'alles', 'bitte', 'danke', 'genau', 'hallo', 'hier', 'heute', 'immer',
      'jetzt', 'klar', 'nein', 'nicht', 'oder', 'prima', 'richtig', 'super', 'tatsächlich',
      'und', 'vielleicht', 'wirklich', 'ja', 'okay', 'ok', 'gut', 'team', 'alle', 'zusammen'
    ]);

    // 1. Initialize all unique speakers in speakerMap first
    for (const seg of segments) {
      if (!speakerMap.has(seg.speakerId)) {
        const colorIndex = speakerMap.size % SPEAKER_COLORS.length;
        speakerMap.set(seg.speakerId, {
          id: seg.speakerId,
          label: seg.speakerLabel || `Sprecher ${speakerMap.size + 1}`,
          assignedName: null,
          confidence: 0,
          color: SPEAKER_COLORS[colorIndex],
          sampleSegmentId: seg.id
        });
      }
    }

    // 2. Analyze conversation turns and direct naming
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      // A: Response greeting to the previous speaker (e.g. "Hallo Alex,", "Danke Alex,")
      const responseGreetingPattern = /^(?:hallo|hey|hi|guten morgen|danke|vielen dank),?\s+([A-ZÄÖÜ][a-zäöüß]+)[,!. ]/i;
      const greetingMatch = seg.text.match(responseGreetingPattern);
      if (greetingMatch && greetingMatch[1]) {
        const name = greetingMatch[1].trim();
        if (!blacklistWords.has(name.toLowerCase()) && name.length > 2) {
          if (i > 0) {
            const prevSeg = segments[i - 1];
            if (prevSeg.speakerId !== seg.speakerId) {
              const target = speakerMap.get(prevSeg.speakerId);
              if (target && (!target.assignedName || target.confidence! < 0.8)) {
                target.assignedName = name;
                target.confidence = 0.9;
                target.evidence = `Wurde von ${seg.speakerLabel || seg.speakerId} mit "${greetingMatch[0].trim()}" begrüßt.`;
              }
            }
          }
        }
      }

      // B: Hand-off address or question to the next speaker (e.g. "Florian, kannst du...", "Was sagst du, Florian?")
      const handoffPatterns = [
        /(?:frage an|was meinst du|was sagst du|wie sieht es aus bei dir),?\s+([A-ZÄÖÜ][a-zäöüß]+)/i,
        /([A-ZÄÖÜ][a-zäöüß]+),\s*(?:kannst|könntest|hast|machst|übernimmst|wirst|wie|was|denkst|meinst|bist)/i
      ];

      let handoffName: string | null = null;
      for (const pattern of handoffPatterns) {
        const match = seg.text.match(pattern);
        if (match && match[1]) {
          const candidate = match[1].trim();
          if (!blacklistWords.has(candidate.toLowerCase()) && candidate.length > 2) {
            handoffName = candidate;
            seg.addressedTo = candidate;
            break;
          }
        }
      }

      // If a handoff address occurred, the speaker in the next segment (i + 1) is the addressed person
      if (handoffName && i + 1 < segments.length) {
        const nextSeg = segments[i + 1];
        if (nextSeg.speakerId !== seg.speakerId) {
          const targetSpeaker = speakerMap.get(nextSeg.speakerId);
          if (targetSpeaker && (!targetSpeaker.assignedName || targetSpeaker.confidence! < 0.8)) {
            targetSpeaker.assignedName = handoffName;
            targetSpeaker.confidence = 0.9;
            targetSpeaker.evidence = `Wurde in Abschnitt ${i + 1} ("${seg.text.slice(0, 40)}...") direkt mit "${handoffName}" angesprochen und antwortete darauf in Abschnitt ${i + 2}.`;
          }
        }
      }
    }

    return { speakers: speakerMap };
  }

  /**
   * Uses OpenRouter LLM to perform deep conversational deduction if API client is available
   */
  static async analyzeWithLLM(
    segments: TranscriptSegment[],
    client: OpenRouterClient
  ): Promise<Map<string, { name: string; confidence: number; evidence: string }>> {
    const formattedTranscript = segments
      .map((s, idx) => `[Segment ${idx + 1} | ${s.speakerId} (${s.speakerLabel})]: "${s.text}"`)
      .join('\n');

    const prompt = `Analysiere folgendes Meeting-Transkript und ermittle die Klarnamen der beteiligten Sprecher.
Achte besonders darauf:
- Wenn ein Sprecher eine Person namentlich anspricht (z.B. "Florian, kannst du...", "Sarah, wie steht es mit...") und daraufhin der nächste Sprecher antwortet, gehört der Name zu diesem antwortenden Sprecher!
- Wenn sich jemand selbst vorstellt ("Hier ist Alex", "Ich bin Alex").

Transkript:
${formattedTranscript}

Antworte ausschließlich im JSON-Format mit dieser Struktur:
{
  "speakers": [
    {
      "speakerId": "speaker_1",
      "name": "Name der Person oder null wenn unbekannt",
      "confidence": 0.95,
      "evidence": "Kurze Begründung mit Zitat"
    }
  ]
}`;

    try {
      const response = await client.chatCompletion({
        prompt,
        system: 'Du bist ein Experte für Konversationsanalyse und Sprecher-Identifikation in Meeting-Protokollen.',
        jsonResponse: true,
        temperature: 0.1
      });

      const parsed = JSON.parse(response);
      const results = new Map<string, { name: string; confidence: number; evidence: string }>();

      if (parsed.speakers && Array.isArray(parsed.speakers)) {
        for (const item of parsed.speakers) {
          if (item.name && item.confidence >= 0.5) {
            results.set(item.speakerId, {
              name: item.name,
              confidence: item.confidence,
              evidence: item.evidence || 'Ermittelt durch LLM-Konversationsanalyse'
            });
          }
        }
      }
      return results;
    } catch (err) {
      console.warn('LLM speaker deduction failed, falling back to heuristics:', err);
      return new Map();
    }
  }

  /**
   * Combines heuristic analysis with optional LLM verification and builds the final Speaker list,
   * identifying those that need manual clarification via audio snippet.
   */
  static async resolveSpeakers(
    segments: TranscriptSegment[],
    client?: OpenRouterClient
  ): Promise<{
    speakers: Speaker[];
    clarificationNeeded: SpeakerClarificationRequest[];
  }> {
    // 1. Run rule-based heuristic
    const { speakers: speakerMap } = this.analyzeHeuristics(segments);

    // 2. If client available, run LLM analysis
    if (client && client.hasApiKey()) {
      const llmResults = await this.analyzeWithLLM(segments, client);
      llmResults.forEach((val, speakerId) => {
        const existing = speakerMap.get(speakerId);
        if (existing) {
          if (!existing.assignedName || val.confidence > (existing.confidence || 0)) {
            existing.assignedName = val.name;
            existing.confidence = val.confidence;
            existing.evidence = val.evidence;
          }
        }
      });
    }

    const speakers: Speaker[] = [];
    const clarificationNeeded: SpeakerClarificationRequest[] = [];

    // Collect all mentioned names across the meeting to suggest in the modal
    const suggestedPool = new Set<string>();
    for (const seg of segments) {
      if (seg.addressedTo) suggestedPool.add(seg.addressedTo);
    }

    speakerMap.forEach((partial, speakerId) => {
      // Find the best audio segment (longest clean speech) for snippet playback
      const speakerSegments = segments.filter((s) => s.speakerId === speakerId);
      const bestSegment = speakerSegments.reduce((best, cur) => {
        const curDuration = cur.endTime - cur.startTime;
        const bestDuration = best ? best.endTime - best.startTime : 0;
        return curDuration > bestDuration ? cur : best;
      }, speakerSegments[0]);

      const speaker: Speaker = {
        id: speakerId,
        label: partial.label || speakerId,
        assignedName: partial.assignedName || null,
        confidence: partial.confidence || 0,
        evidence: partial.evidence,
        color: partial.color || '#3b82f6',
        sampleSegmentId: bestSegment ? bestSegment.id : undefined
      };

      speakers.push(speaker);

      // If speaker name is not resolved with high confidence (>= 0.8), require user clarification!
      if (!speaker.assignedName || speaker.confidence < 0.8) {
        clarificationNeeded.push({
          speakerId: speaker.id,
          currentLabel: speaker.assignedName || speaker.label,
          bestSegment: bestSegment || {
            id: 'mock',
            speakerId: speaker.id,
            speakerLabel: speaker.label,
            startTime: 0,
            endTime: 3,
            text: 'Kein Audio-Abschnitt verfügbar'
          },
          suggestedNames: Array.from(suggestedPool).filter((n) => n !== speaker.assignedName),
          reason: 'Der Sprecher konnte im Gesprächsverlauf nicht eindeutig einem Namen zugeordnet werden.'
        });
      }
    });

    return { speakers, clarificationNeeded };
  }
}
