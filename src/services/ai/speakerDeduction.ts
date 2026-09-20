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
      'und', 'vielleicht', 'wirklich', 'ja', 'okay', 'ok', 'gut', 'team', 'alle', 'zusammen',
      'test', 'ähm', 'ehm', 'soll', 'name', 'mein', 'dein', 'dies', 'hola', 'hallo', 'servus', 'moin'
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

    // 2. Analyze conversation turns sentence-by-sentence and turn transitions
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      // Collect third parties explicitly mentioned as sitting nearby / third person in this turn:
      // e.g. "neben mir sitzt Thomas", "hier sitzt Sarah"
      const thirdPartyRegex = /(?:neben mir sitzt|hier sitzt|neben mir|bei mir sitzt|kollege|chef)\s+([A-ZÄÖÜ][a-zäöüß]+)/gi;
      const thirdPartyNamesInSegment = new Set<string>();
      let tpMatch: RegExpExecArray | null;
      while ((tpMatch = thirdPartyRegex.exec(seg.text)) !== null) {
        if (tpMatch[1]) {
          thirdPartyNamesInSegment.add(tpMatch[1].trim().toLowerCase());
        }
      }

      const sentences = seg.text.split(/(?<=[.!?])\s+/);

      for (const rawSentence of sentences) {
        const sentence = rawSentence.trim();
        if (!sentence) continue;

        // Pattern A: Self-introduction ("Ich bin Alex", "Mein Name ist Peter", "Hier spricht Florian")
        const selfIntroMatch = sentence.match(/(?:ich bin|mein name ist|hier ist|hier spricht)\s+([A-ZÄÖÜ][a-zäöüß]+)/i);
        if (selfIntroMatch && selfIntroMatch[1]) {
          const name = selfIntroMatch[1].trim();
          if (!blacklistWords.has(name.toLowerCase()) && name.length > 2) {
            const currentSpeaker = speakerMap.get(seg.speakerId);
            if (currentSpeaker && (!currentSpeaker.assignedName || currentSpeaker.confidence! < 0.9)) {
              currentSpeaker.assignedName = name;
              currentSpeaker.confidence = 0.95;
              currentSpeaker.evidence = `Hat sich selbst vorgestellt: "${sentence}"`;
            }
          }
        }

        // Pattern B: Greeting / Addressing the other conversation partner (e.g. "Hallo Fred", "Grüß dich Peter", "Danke Sarah")
        const greetingPatterns = [
          /(?:hallo|hey|hi|guten morgen|grüß dich|moin|servus|danke|vielen dank),?\s+([A-ZÄÖÜ][a-zäöüß]+)/i,
          /([A-ZÄÖÜ][a-zäöüß]+),?\s+(?:grüß dich|hallo|hi|guten morgen|danke)/i
        ];

        for (const pattern of greetingPatterns) {
          const match = sentence.match(pattern);
          if (match && match[1]) {
            const candidate = match[1].trim();
            if (!blacklistWords.has(candidate.toLowerCase()) && candidate.length > 2) {
              // Ignore if clearly referring to an absent or in-room 3rd party
              if (thirdPartyNamesInSegment.has(candidate.toLowerCase()) || /(?:neben mir sitzt|kollege|chef|mit|über)\s+/i.test(sentence)) {
                continue;
              }

              // In a conversation, greeting a person addresses the conversation partner!
              let partnerSpeakerId: string | null = null;
              if (i > 0 && segments[i - 1].speakerId !== seg.speakerId) {
                partnerSpeakerId = segments[i - 1].speakerId;
              } else if (i + 1 < segments.length && segments[i + 1].speakerId !== seg.speakerId) {
                partnerSpeakerId = segments[i + 1].speakerId;
              } else {
                const others = Array.from(speakerMap.keys()).filter((id) => id !== seg.speakerId);
                if (others.length === 1) {
                  partnerSpeakerId = others[0];
                }
              }

              if (partnerSpeakerId) {
                const partner = speakerMap.get(partnerSpeakerId);
                if (partner && (!partner.assignedName || partner.confidence! < 0.8)) {
                  partner.assignedName = candidate;
                  partner.confidence = 0.9;
                  partner.evidence = `Wurde von ${seg.speakerLabel || seg.speakerId} mit "${match[0].trim()}" angesprochen.`;
                }
              }
            }
          }
        }

        // Pattern C: Hand-off questions to the next speaker (e.g. "Florian, kannst du...", "Was sagst du, Florian?")
        const handoffPatterns = [
          /(?:frage an|was meinst du|was sagst du|wie sieht es aus bei dir),?\s+([A-ZÄÖÜ][a-zäöüß]+)/i,
          /([A-ZÄÖÜ][a-zäöüß]+),\s*(?:kannst|könntest|hast|machst|übernimmst|wirst|wie|was|denkst|meinst|bist)/i
        ];

        for (const pattern of handoffPatterns) {
          const match = sentence.match(pattern);
          if (match && match[1]) {
            const candidate = match[1].trim();
            if (!blacklistWords.has(candidate.toLowerCase()) && candidate.length > 2) {
              seg.addressedTo = candidate;
              if (i + 1 < segments.length && segments[i + 1].speakerId !== seg.speakerId) {
                const targetSpeaker = speakerMap.get(segments[i + 1].speakerId);
                if (targetSpeaker && (!targetSpeaker.assignedName || targetSpeaker.confidence! < 0.8)) {
                  targetSpeaker.assignedName = candidate;
                  targetSpeaker.confidence = 0.9;
                  targetSpeaker.evidence = `Wurde in Abschnitt ${i + 1} ("${seg.text.slice(0, 40)}...") direkt mit "${candidate}" angesprochen und antwortete darauf.`;
                }
              }
            }
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
      .map((s, idx) => `[Abschnitt ${idx + 1} | ${s.speakerId}]: "${s.text}"`)
      .join('\n');

    const prompt = `Du bist ein erfahrener Konversationsanalytiker. Deine Aufgabe ist es, für jede Sprecher-ID im Transkript den tatsächlichen Klarnamen der sprechenden Person zu ermitteln.

BEACHTE DIESE PRÄZISEN REGELN FÜR DIE SPRECHERZUWEISUNG:
1. DIREKTE ANREDE DES GESPRÄCHSPARTNERS:
   - Wenn Sprecher B sagt: "Hallo Fred, grüß dich", "Danke Fred" oder "Was sagst du, Fred?", spricht B damit seinen Gegenüber an (den Vorredner oder nächsten Redner, z. B. Sprecher A). Der Name "Fred" gehört folglich zu SPRECHER A, NIEMALS zu Sprecher B!
   - Wenn Sprecher A anschließend bestätigt (z. B. "Jetzt hast du meinen Namen genannt"), beweist dies zweifelsfrei: Sprecher A ist Fred!
   - Wenn Sprecher A daraufhin sagt: "Hallo Peter", spricht A seinen Gegenüber an -> Sprecher B ist Peter!

2. SELBSTVORSTELLUNG:
   - Sätze wie "Hier ist Alex", "Ich bin Alex", "Mein Name ist..." weisen den Namen direkt dem AKTUELLEN Sprecher zu.

3. ERWÄHNUNG DRITTER PERSONEN (Ausschlussregel):
   - Wenn ein Sprecher von Dritten erzählt ("Neben mir sitzt Thomas", "Ich habe mit Sarah telefoniert"), gehört dieser Name NICHT automatisch zu einem der aktiven Sprecher, solange sich diese dritte Person nicht selbst aktiv mit eigener Stimme zu Wort meldet.

4. KONSISTENZ:
   - Ordne jeder Sprecher-ID genau einen Namen zu oder null, wenn kein Name genannt oder abgeleitet werden kann.
   - Vergib eine hohe Confidence (0.85 - 1.0) bei klarer Anrede oder Bestätigung.

Transkript:
${formattedTranscript}

Antworte ausschließlich im JSON-Format mit dieser Struktur:
{
  "speakers": [
    {
      "speakerId": "speaker_1",
      "name": "Echter Name der Person oder null wenn unbekannt",
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
