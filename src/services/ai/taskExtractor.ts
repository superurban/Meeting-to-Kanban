import { Task, TranscriptSegment, Speaker } from '../../types';
import { OpenRouterClient } from './openrouter';
import { parseRelativeGermanDate } from '../../utils/dateUtils';

export interface TaskExtractionResult {
  tasks: Task[];
  meetingTitle: string;
}

export class TaskExtractorService {
  /**
   * Extracts Kanban tasks from the finalized transcript with speaker names
   */
  static async extractTasks(
    meetingId: string,
    meetingDate: string,
    segments: TranscriptSegment[],
    speakers: Speaker[],
    client?: OpenRouterClient,
    callbacks?: {
      onProgressLog?: (log: string) => void;
      onReasoningChunk?: (chunk: string) => void;
    }
  ): Promise<Task[]> {
    const result = await this.extractTasksAndTitle(meetingId, meetingDate, segments, speakers, client, callbacks);
    return result.tasks;
  }

  /**
   * Extracts Kanban tasks AND a suggested meeting title from the transcript
   */
  static async extractTasksAndTitle(
    meetingId: string,
    meetingDate: string,
    segments: TranscriptSegment[],
    speakers: Speaker[],
    client?: OpenRouterClient,
    callbacks?: {
      onProgressLog?: (log: string) => void;
      onReasoningChunk?: (chunk: string) => void;
    }
  ): Promise<TaskExtractionResult> {
    // Build speaker lookup map
    const speakerNameMap = new Map<string, string>();
    speakers.forEach((s) => {
      speakerNameMap.set(s.id, s.assignedName || s.label);
    });

    const formattedTranscript = segments
      .map((s) => {
        const name = speakerNameMap.get(s.speakerId) || s.speakerLabel;
        return `${name}: "${s.text}"`;
      })
      .join('\n');

    const knownParticipants = speakers
      .map((s) => s.assignedName || s.label)
      .join(', ');

    const baseDate = new Date(meetingDate);
    const germanWeekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const weekdayName = germanWeekdays[baseDate.getDay()] || 'Wochentag';
    const dateFormatted = baseDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const defaultTitle = `Meeting vom ${dateFormatted}`;

    if (client && client.hasApiKey()) {
      const summaryModel = client.getConfig().summaryModel || 'deepseek/deepseek-chat';
      callbacks?.onProgressLog?.(`Extrahiere Aufgaben & Meeting-Titel mit ${summaryModel}...`);

      const prompt = `Analysiere folgendes Meeting-Transkript und erstelle:
1. Einen prägnanten, passenden Titel für das Meeting (max. 3-6 Wörter, z.B. "Spülmaschine & Haushaltsplan", "Sprint Planning & Deployment", "Produktstrategie Q4").
2. Eine präzise Aufgabenliste für ein Kanban-Board.

Meeting-Datum: ${weekdayName}, ${dateFormatted} (${meetingDate.split('T')[0]})
Bekannte Teilnehmer: ${knownParticipants}

Transkript:
${formattedTranscript}

Anforderungen für jeden Task:
- title: Prägnanter, handlungsorientierter Titel (z.B. "Spülmaschine anstellen", "Cloudflare Worker fertigstellen")
- assignee: Zuständige Person (muss einem der bekannten Teilnehmer entsprechen, z.B. "Torben", "Florian", "Sarah")
- dueDate: Fälligkeitsdatum im Format YYYY-MM-DD.
  WICHTIG ZUR DATUMSBERECHNUNG:
  Heute ist ${weekdayName}, der ${dateFormatted}.
  Achte exakt auf den genannten Wochentag! Wenn im Transkript z.B. "Fälligkeit nächste Woche Dienstag" steht, MUSS das Datum exakt der Dienstag der nächsten Kalenderwoche sein.
- description: Ausführliche Beschreibung aus dem Kontext der besprochenen Next Steps
- status: "todo" (Standard) oder "in_progress"
- priority: "high", "medium" oder "low"
- quote: Wörtliches Zitat aus dem Transkript, das die Vereinbarung belegt

Antworte ausschließlich im JSON-Format mit dieser Struktur:
{
  "meetingTitle": "Prägnanter Titel für das Meeting",
  "tasks": [
    {
      "title": "Titel der Aufgabe",
      "assignee": "Name",
      "dueDate": "2026-09-22",
      "description": "Detaillierte Beschreibung...",
      "status": "todo",
      "priority": "high",
      "quote": "Transkript-Zitat"
    }
  ]
}`;

      try {
        const response = await client.chatCompletion({
          prompt,
          model: summaryModel,
          system: 'Du bist ein erfahrener Projektmanager und agiler Coach. Du extrahierst verbindliche Aufgaben, präzise Fälligkeitstermine und treffende Meeting-Titel aus Transkripten.',
          temperature: 0.2,
          stream: true,
          onReasoning: callbacks?.onReasoningChunk,
          onApiLog: callbacks?.onProgressLog
        });

        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
        }

        const parsed = JSON.parse(cleanResponse);
        const taskItems: Array<Record<string, unknown>> = Array.isArray(parsed)
          ? parsed
          : parsed.tasks || [];

        const suggestedTitle = (parsed.meetingTitle && typeof parsed.meetingTitle === 'string' && parsed.meetingTitle.trim())
          ? parsed.meetingTitle.trim()
          : (taskItems.length > 0 && taskItems[0].title ? String(taskItems[0].title) : defaultTitle);

        const tasks: Task[] = taskItems.map((item, index) => {
          // Robust deterministic date validation:
          // Check quote and description for relative German dates/weekdays
          const textToCheck = [item.quote, item.description, item.title].filter(Boolean).join(' ');
          const deterministicDate = parseRelativeGermanDate(textToCheck, baseDate);

          let finalDueDate: string | null = null;
          if (deterministicDate) {
            finalDueDate = deterministicDate;
          } else if (item.dueDate) {
            const rawDue = String(item.dueDate).trim();
            finalDueDate = parseRelativeGermanDate(rawDue, baseDate) || (rawDue.match(/^\d{4}-\d{2}-\d{2}$/) ? rawDue : null);
          }

          return {
            id: `task_${Date.now()}_${index}`,
            meetingId,
            title: String(item.title || `Aufgabe ${index + 1}`),
            assignee: String(item.assignee || 'Unzugewiesen'),
            dueDate: finalDueDate,
            description: String(item.description || ''),
            status: (item.status as 'backlog' | 'todo' | 'in_progress' | 'done') || 'todo',
            priority: (item.priority as 'low' | 'medium' | 'high') || 'medium',
            transcriptQuote: item.quote ? String(item.quote) : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });

        return { tasks, meetingTitle: suggestedTitle };
      } catch (err) {
        console.warn('LLM task extraction failed, falling back to heuristic extractor:', err);
      }
    }

    // Heuristic / Demo rule-based task extractor
    const fallbackTasks = this.heuristicExtract(meetingId, meetingDate, segments, speakerNameMap);
    const fallbackTitle = fallbackTasks.length > 0 ? fallbackTasks[0].title : defaultTitle;
    return { tasks: fallbackTasks, meetingTitle: fallbackTitle };
  }

  private static heuristicExtract(
    meetingId: string,
    meetingDateStr: string,
    segments: TranscriptSegment[],
    speakerNameMap: Map<string, string>
  ): Task[] {
    const tasks: Task[] = [];
    const baseDate = new Date(meetingDateStr);

    const actionKeywords = [
      'fertigstellen', 'implementieren', 'testen', 'übernehme', 'mache ich',
      'erstellen', 'abschließen', 'feedback', 'aktualisiert', 'konfiguration',
      'soll', 'bitte', 'erledigen', 'anstellen', 'fälligkeit'
    ];

    segments.forEach((seg, idx) => {
      const lower = seg.text.toLowerCase();
      const speakerName = speakerNameMap.get(seg.speakerId) || seg.speakerLabel;

      const hasAction = actionKeywords.some((kw) => lower.includes(kw));
      if (!hasAction) return;

      let title = '';
      let desc = seg.text;
      let dueDate: string | null = parseRelativeGermanDate(seg.text, baseDate);
      let priority: 'low' | 'medium' | 'high' = 'medium';

      if (lower.includes('cloudflare')) {
        title = 'Cloudflare Worker & PWA Caching fertigstellen';
        desc = 'Worker-Routen implementieren und Offline-Caching der PWA für zuverlässigen Betrieb konfigurieren.';
        priority = 'high';
      } else if (lower.includes('figma') || lower.includes('kanban-board-ui')) {
        title = 'Figma Kanban-Board UI Feedback einholen';
        desc = 'Farbcodierungen der Prioritäten und mobiles Layout mit dem Team abstimmen.';
        priority = 'medium';
      } else if (lower.includes('ton-schnipsel') || lower.includes('web audio')) {
        title = 'Ton-Schnipsel-Wiedergabe mit Web Audio API implementieren';
        desc = 'Präzisen Audio-Snippet-Player bauen, damit unerkannte Stimmen per Klick abgespielt und benannt werden können.';
        priority = 'high';
      } else if (lower.includes('app-store') || lower.includes('dokumentation')) {
        title = 'App-Store Dokumentation & Domain einrichten';
        desc = 'Dokumentation für App-Store Bereitstellung und Cloudflare Pages Custom Domain konfigurieren.';
        priority = 'medium';
      } else if (lower.includes('icons') || lower.includes('touch')) {
        title = 'Mobile App Icons & Touch-Gesten testen';
        desc = 'Homescreen Icons für iOS und Android generieren und Wischgesten auf mobilen Geräten verifizieren.';
        priority = 'low';
      } else {
        const cleaned = seg.text.replace(/^(äh|ähm|ja|also)\s+/i, '').trim();
        title = cleaned.length > 50 ? cleaned.slice(0, 47) + '...' : cleaned;
      }

      tasks.push({
        id: `task_${Date.now()}_${idx}`,
        meetingId,
        title,
        assignee: speakerName,
        dueDate,
        description: desc,
        status: idx === 1 ? 'in_progress' : 'todo',
        priority,
        transcriptQuote: seg.text,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    return tasks;
  }
}
