import { describe, it, expect } from 'vitest';
import { parseRelativeGermanDate } from '../src/utils/dateUtils';
import { SpeakerDeductionService } from '../src/services/ai/speakerDeduction';

describe('Speaker Deduction & Date Utils', () => {
  it('parseRelativeGermanDate handles German dates', () => {
    const base = new Date('2026-09-18T10:00:00Z'); // Friday
    
    const morgen = parseRelativeGermanDate('Bitte bis morgen erledigen', base);
    expect(morgen).toBe('2026-09-19');

    const freitag = parseRelativeGermanDate('Fertig bis nächsten Freitag', base);
    expect(freitag).toBe('2026-10-02');
  });

  it('SpeakerDeductionService detects addressed speaker and unassigned speaker', async () => {
    const segments = [
      {
        id: 's1',
        speakerId: 'spk_1',
        speakerLabel: 'Sprecher 1',
        startTime: 0,
        endTime: 5,
        text: 'Guten Morgen. Florian, kannst du die Cloudflare Worker Anbindung bis Freitag fertigstellen?'
      },
      {
        id: 's2',
        speakerId: 'spk_2',
        speakerLabel: 'Sprecher 2',
        startTime: 5.5,
        endTime: 12,
        text: 'Hallo Alex, ja mache ich gerne bis Freitag fertig.'
      },
      {
        id: 's3',
        speakerId: 'spk_3',
        speakerLabel: 'Sprecher 3',
        startTime: 12.5,
        endTime: 18,
        text: 'Ich habe das UI-Design aktualisiert.'
      }
    ];

    const { speakers, clarificationNeeded } = await SpeakerDeductionService.resolveSpeakers(segments);

    // Speaker 2 should be identified as Florian with high confidence
    const spk2 = speakers.find((s) => s.id === 'spk_2');
    expect(spk2).toBeDefined();
    expect(spk2?.assignedName).toBe('Florian');
    expect(spk2?.confidence).toBeGreaterThanOrEqual(0.8);

    // Speaker 3 should need clarification (unnamed speaker)
    const spk3Clarification = clarificationNeeded.find((c) => c.speakerId === 'spk_3');
    expect(spk3Clarification).toBeDefined();
    expect(spk3Clarification?.bestSegment.id).toBe('s3');
  });

  it('TaskExtractorService extracts tasks with title, assignee, dueDate, and description', async () => {
    const { TaskExtractorService } = await import('../src/services/ai/taskExtractor');
    const segments = [
      {
        id: 's1',
        speakerId: 'spk_1',
        speakerLabel: 'Alex',
        startTime: 0,
        endTime: 5,
        text: 'Florian, kannst du die Cloudflare Worker Anbindung bis nächsten Freitag fertigstellen?'
      },
      {
        id: 's2',
        speakerId: 'spk_2',
        speakerLabel: 'Florian',
        startTime: 5.5,
        endTime: 12,
        text: 'Klar, ich übernehme das und implementiere auch das PWA Caching.'
      }
    ];

    const speakers = [
      { id: 'spk_1', label: 'Sprecher 1', assignedName: 'Alex', confidence: 1.0, color: '#3b82f6' },
      { id: 'spk_2', label: 'Sprecher 2', assignedName: 'Florian', confidence: 1.0, color: '#10b981' }
    ];

    const tasks = await TaskExtractorService.extractTasks(
      'meet_1',
      '2026-09-18T10:00:00Z',
      segments,
      speakers
    );

    expect(tasks.length).toBeGreaterThan(0);
    const cfTask = tasks.find((t) => t.title.toLowerCase().includes('cloudflare'));
    expect(cfTask).toBeDefined();
    expect(cfTask?.assignee).toBe('Alex');
    expect(cfTask?.dueDate).toBeDefined();
    expect(cfTask?.description.length).toBeGreaterThan(10);
    expect(['backlog', 'todo', 'in_progress', 'done']).toContain(cfTask?.status);
  });
});
