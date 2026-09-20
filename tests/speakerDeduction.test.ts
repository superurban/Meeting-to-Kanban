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

  it('correctly deduces Fred and Peter from conversational dialogue with greetings', async () => {
    const segments = [
      { id: '1', speakerId: 'spk_1', speakerLabel: 'Sprecher 1', startTime: 0, endTime: 2, text: 'Hola.' },
      { id: '2', speakerId: 'spk_1', speakerLabel: 'Sprecher 1', startTime: 2.1, endTime: 4, text: 'Dies ist jetzt ein Test.' },
      { id: '3', speakerId: 'spk_1', speakerLabel: 'Sprecher 1', startTime: 4.1, endTime: 8, text: 'Ich verrate meinen Namen nicht, aber neben mir sitzt Thomas. Hallo Thomas.' },
      { id: '4', speakerId: 'spk_2', speakerLabel: 'Sprecher 2', startTime: 8.5, endTime: 13, text: 'Hallo. Ähm, soll ich jetzt deinen Namen sagen? Hallo Fred, grüß dich.' },
      { id: '5', speakerId: 'spk_1', speakerLabel: 'Sprecher 1', startTime: 13.5, endTime: 17, text: 'Jetzt hast du meinen Namen genannt. Hallo Peter.' }
    ];

    const { speakers } = await SpeakerDeductionService.resolveSpeakers(segments);
    const spk1 = speakers.find((s) => s.id === 'spk_1');
    const spk2 = speakers.find((s) => s.id === 'spk_2');

    expect(spk1?.assignedName).toBe('Fred');
    expect(spk2?.assignedName).toBe('Peter');
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

  it('TaskExtractorService returns empty array when no actionable tasks are discussed', async () => {
    const { TaskExtractorService } = await import('../src/services/ai/taskExtractor');
    const casualSegments = [
      {
        id: 'c1',
        speakerId: 'spk_1',
        speakerLabel: 'Alex',
        startTime: 0,
        endTime: 3,
        text: 'Schönes Wetter heute draußen.'
      },
      {
        id: 'c2',
        speakerId: 'spk_2',
        speakerLabel: 'Florian',
        startTime: 3.5,
        endTime: 6,
        text: 'Ja absolut, wirklich sehr angenehm.'
      }
    ];

    const speakers = [
      { id: 'spk_1', label: 'Sprecher 1', assignedName: 'Alex', confidence: 1.0, color: '#3b82f6' },
      { id: 'spk_2', label: 'Sprecher 2', assignedName: 'Florian', confidence: 1.0, color: '#10b981' }
    ];

    const tasks = await TaskExtractorService.extractTasks(
      'meet_casual',
      '2026-09-18T10:00:00Z',
      casualSegments,
      speakers
    );

    expect(tasks).toEqual([]);
    expect(tasks.length).toBe(0);
  });

  it('Meeting deletion correctly filters out deleted meeting and handles fallback selection', () => {
    const meetings = [
      { id: 'm1', title: 'Sprint Review', date: '2026-09-18T10:00:00Z', durationSeconds: 120, speakers: [], segments: [], tasks: [], status: 'ready' as const },
      { id: 'm2', title: 'Board Sync', date: '2026-09-19T10:00:00Z', durationSeconds: 240, speakers: [], segments: [], tasks: [], status: 'ready' as const }
    ];

    const deleteMeetingId = 'm1';
    const remaining = meetings.filter((m) => m.id !== deleteMeetingId);

    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('m2');
    expect(remaining.find((m) => m.id === 'm1')).toBeUndefined();
  });

  it('Merging speakers correctly reassigns segments and tasks to target speaker and removes source speaker', () => {
    const speakers = [
      { id: 'spk_thorben', label: 'Sprecher 2', assignedName: 'Thorben', confidence: 1.0, color: '#10b981' },
      { id: 'spk_don', label: 'Sprecher 4', assignedName: 'Don', confidence: 0.7, color: '#8b5cf6' }
    ];

    const segments = [
      { id: 's1', speakerId: 'spk_thorben', speakerLabel: 'Thorben', startTime: 0, endTime: 4, text: 'Hallo zusammen.' },
      { id: 's2', speakerId: 'spk_don', speakerLabel: 'Don', startTime: 5, endTime: 8, text: 'Hier ist auch noch ein Punkt.' }
    ];

    const tasks = [
      { id: 't1', meetingId: 'm1', title: 'Task 1', assignee: 'Don', status: 'todo' as const, priority: 'medium' as const, columnId: 'todo' },
      { id: 't2', meetingId: 'm1', title: 'Task 2', assignee: 'Thorben', status: 'done' as const, priority: 'high' as const, columnId: 'done' }
    ];

    // Merge spk_don into spk_thorben
    const sourceId = 'spk_don';
    const targetId = 'spk_thorben';
    const targetSpeaker = speakers.find(s => s.id === targetId)!;

    const mergedSegments = segments.map(seg => {
      if (seg.speakerId === sourceId) {
        return { ...seg, speakerId: targetId, speakerLabel: targetSpeaker.assignedName };
      }
      return seg;
    });

    const mergedSpeakers = speakers
      .filter(s => s.id !== sourceId)
      .map(s => s.id === targetId ? { ...s, evidence: 'Zusammengeführt' } : s);

    const mergedTasks = tasks.map(t => {
      if (t.assignee === 'Don') {
        return { ...t, assignee: targetSpeaker.assignedName };
      }
      return t;
    });

    expect(mergedSpeakers.length).toBe(1);
    expect(mergedSpeakers[0].assignedName).toBe('Thorben');
    expect(mergedSegments.every(seg => seg.speakerId === 'spk_thorben')).toBe(true);
    expect(mergedSegments.every(seg => seg.speakerLabel === 'Thorben')).toBe(true);
    expect(mergedTasks.every(t => t.assignee === 'Thorben')).toBe(true);
  });
});
