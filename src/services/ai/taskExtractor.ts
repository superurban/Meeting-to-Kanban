import { Task, TranscriptSegment, Speaker } from '../../types';
import { OpenRouterClient } from './openrouter';
import { parseRelativeGermanDate } from '../../utils/dateUtils';

export class TaskExtractorService {
  /**
   * Extracts Kanban tasks from the finalized transcript with speaker names
   */
  static async extractTasks(
    meetingId: string,
    meetingDate: string,
    segments: TranscriptSegment[],
    speakers: Speaker[],
    client?: OpenRouterClient
  ): Promise<Task[]> {
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

    if (client && client.hasApiKey()) {
      const prompt = `Analysiere folgendes Meeting-Transkript und erstelle eine präzise Aufgabenliste für ein Kanban-Board.

Meeting-Datum: ${meetingDate}
Bekannte Teilnehmer: ${knownParticipants}

Transkript:
${formattedTranscript}

Anforderungen für jeden Task:
- titel: Prägnanter, handlungsorientierter Titel (z.B. "Cloudflare Worker Integration fertigstellen")
- assignee: Zuständige Person (muss genau einem der bekannten Teilnehmer entsprechen, z.B. "Florian", "Sarah", "Alex")
- dueDate: Fälligkeitsdatum (sofern genannt oder ableitbar, z.B. berechnet anhand des Meeting-Datums im Format YYYY-MM-DD oder "bis nächsten Freitag")
- description: Ausführliche Beschreibung aus dem Kontext der besprochenen Next Steps
- status: "todo" (Standard) oder "in_progress"
- priority: "high", "medium" oder "low"
- quote: Wörtliches Zitat aus dem Transkript, das die Vereinbarung belegt

Antworte ausschließlich im JSON-Format mit dieser Struktur:
{
  "tasks": [
    {
      "title": "Titel der Aufgabe",
      "assignee": "Name",
      "dueDate": "2026-09-25",
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
          model: client.getConfig().summaryModel || 'deepseek/deepseek-chat',
          system: 'Du bist ein erfahrener Projektmanager und agiler Coach. Du extrahierst verbindliche Aufgaben und Next Steps aus Meetings.',
          jsonResponse: true,
          temperature: 0.2
        });

        const parsed = JSON.parse(response);
        const taskItems: Array<Record<string, unknown>> = Array.isArray(parsed)
          ? parsed
          : parsed.tasks || [];

        return taskItems.map((item, index) => ({
          id: `task_${Date.now()}_${index}`,
          meetingId,
          title: String(item.title || `Aufgabe ${index + 1}`),
          assignee: String(item.assignee || 'Unzugewiesen'),
          dueDate: item.dueDate ? String(item.dueDate) : null,
          description: String(item.description || ''),
          status: (item.status as 'backlog' | 'todo' | 'in_progress' | 'done') || 'todo',
          priority: (item.priority as 'low' | 'medium' | 'high') || 'medium',
          transcriptQuote: item.quote ? String(item.quote) : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
      } catch (err) {
        console.warn('LLM task extraction failed, falling back to heuristic extractor:', err);
      }
    }

    // Heuristic / Demo rule-based task extractor
    return this.heuristicExtract(meetingId, meetingDate, segments, speakerNameMap);
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
      'erstellen', 'abschließen', 'feedback', 'aktualisiert', 'konfiguration'
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
        title = seg.text.slice(0, 50) + '...';
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
