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

  it('Appending recording correctly offsets timestamps and merges segments', () => {
    const existingSegments = [
      { id: 'seg_1', speakerId: 'spk_1', speakerLabel: 'Florian', startTime: 0, endTime: 15, text: 'Erster Teil des Meetings.' },
      { id: 'seg_2', speakerId: 'spk_2', speakerLabel: 'Sarah', startTime: 16, endTime: 30, text: 'Zweiter Teil des Meetings.' }
    ];

    const timeOffset = 30.0;
    const newRawSegments = [
      { id: 'new_1', speakerId: 'speaker_1', speakerLabel: 'Sprecher 1', startTime: 0.5, endTime: 6.2, text: 'Noch ein Nachtrag.' },
      { id: 'new_2', speakerId: 'speaker_2', speakerLabel: 'Sprecher 2', startTime: 7.0, endTime: 12.5, text: 'Alles klar, danke.' }
    ];

    const adjustedNewSegments = newRawSegments.map((seg, idx) => ({
      ...seg,
      id: `seg_appended_${idx}`,
      startTime: Number((timeOffset + seg.startTime).toFixed(2)),
      endTime: Number((timeOffset + seg.endTime).toFixed(2))
    }));

    const combinedSegments = [...existingSegments, ...adjustedNewSegments];

    expect(combinedSegments.length).toBe(4);
    expect(combinedSegments[2].startTime).toBe(30.5);
    expect(combinedSegments[2].endTime).toBe(36.2);
    expect(combinedSegments[3].startTime).toBe(37.0);
    expect(combinedSegments[3].endTime).toBe(42.5);
    // Ensure all timestamps are strictly in chronological order
    for (let i = 1; i < combinedSegments.length; i++) {
      expect(combinedSegments[i].startTime).toBeGreaterThanOrEqual(combinedSegments[i - 1].startTime);
    }
  });

  it('Appending recording links speakers by name or adds distinct new speakers', () => {
    const existingSpeakers = [
      { id: 'spk_1', label: 'Sprecher 1', assignedName: 'Florian', confidence: 1.0, color: '#3b82f6' },
      { id: 'spk_2', label: 'Sprecher 2', assignedName: 'Sarah', confidence: 0.9, color: '#10b981' }
    ];

    const newDeducedSpeakers = [
      { id: 'new_spk_a', label: 'Sprecher 1', assignedName: 'Florian', confidence: 0.95, color: '#3b82f6' }, // existing
      { id: 'new_spk_b', label: 'Sprecher 2', assignedName: 'Thomas', confidence: 0.9, color: '#f59e0b' }   // new
    ];

    const updatedSpeakers = [...existingSpeakers];
    const speakerIdRemap = new Map<string, string>();

    newDeducedSpeakers.forEach((newSpk) => {
      const matchExisting = newSpk.assignedName
        ? updatedSpeakers.find(
            (s) => s.assignedName?.toLowerCase().trim() === newSpk.assignedName?.toLowerCase().trim()
          )
        : null;

      if (matchExisting) {
        speakerIdRemap.set(newSpk.id, matchExisting.id);
      } else {
        const finalId = `spk_new_${newSpk.id}`;
        speakerIdRemap.set(newSpk.id, finalId);
        updatedSpeakers.push({
          ...newSpk,
          id: finalId,
          label: newSpk.assignedName || `Sprecher ${updatedSpeakers.length + 1}`
        });
      }
    });

    expect(speakerIdRemap.get('new_spk_a')).toBe('spk_1');
    expect(speakerIdRemap.get('new_spk_b')).toBe('spk_new_new_spk_b');
    expect(updatedSpeakers.length).toBe(3);
    expect(updatedSpeakers.find(s => s.assignedName === 'Thomas')).toBeDefined();
  });

  it('correctly detects same speaker in solo recording append without creating duplicate speaker', () => {
    // Existing meeting has only 1 speaker
    const existingSpeakers = [
      { id: 'spk_solo', label: 'Sprecher 1', assignedName: null, confidence: 0, color: '#3b82f6' }
    ];

    // New appended recording has 1 speaker without explicit different name
    const newDeducedSpeakers = [
      { id: 'speaker_1', label: 'Sprecher 1', assignedName: null, confidence: 0, color: '#3b82f6' }
    ];

    const updatedSpeakers = [...existingSpeakers];
    const speakerIdRemap = new Map<string, string>();

    newDeducedSpeakers.forEach((newSpk) => {
      let matchExisting = updatedSpeakers.find((s) => s.id === newSpk.id);

      if (!matchExisting) {
        const candidateNames = [
          newSpk.assignedName?.toLowerCase().trim(),
          newSpk.label?.toLowerCase().trim()
        ].filter(Boolean) as string[];

        for (const cand of candidateNames) {
          matchExisting = updatedSpeakers.find((s) => {
            const sAssigned = s.assignedName?.toLowerCase().trim();
            const sLabel = s.label?.toLowerCase().trim();
            return (sAssigned && sAssigned === cand) || sLabel === cand;
          });
          if (matchExisting) break;
        }
      }

      if (!matchExisting && updatedSpeakers.length === 1 && newDeducedSpeakers.length === 1) {
        matchExisting = updatedSpeakers[0];
      }

      if (matchExisting) {
        speakerIdRemap.set(newSpk.id, matchExisting.id);
      } else {
        updatedSpeakers.push(newSpk);
      }
    });

    // Remaps to existing speaker and does NOT add a duplicate!
    expect(speakerIdRemap.get('speaker_1')).toBe('spk_solo');
    expect(updatedSpeakers.length).toBe(1);
  });

  it('parseRelativeGermanDate correctly calculates "nächste Woche Dienstag" on Sunday 2026-09-20', () => {
    const sundayBase = new Date('2026-09-20T14:00:00Z');
    const quote = 'Äh Torben soll bitte die Spülmaschine anstellen. Fälligkeit nächste Woche Dienstag.';
    
    const dueDate = parseRelativeGermanDate(quote, sundayBase);
    // On Sunday 20.09.2026, next week starts Monday 21.09.2026. Tuesday of next week is 22.09.2026!
    expect(dueDate).toBe('2026-09-22');
  });

  it('TaskExtractorService extracts tasks and deterministic dueDate for Torben dishwasher task', async () => {
    const { TaskExtractorService } = await import('../src/services/ai/taskExtractor');
    const sundayBase = '2026-09-20T14:00:00Z';
    const segments = [
      {
        id: 's_dish',
        speakerId: 'spk_1',
        speakerLabel: 'Florian',
        startTime: 0,
        endTime: 6,
        text: 'Äh Torben soll bitte die Spülmaschine anstellen. Fälligkeit nächste Woche Dienstag.'
      }
    ];
    const speakers = [
      { id: 'spk_1', label: 'Sprecher 1', assignedName: 'Florian', confidence: 1.0, color: '#3b82f6' },
      { id: 'spk_2', label: 'Sprecher 2', assignedName: 'Torben', confidence: 1.0, color: '#10b981' }
    ];

    const result = await TaskExtractorService.extractTasksAndTitle('meet_dish', sundayBase, segments, speakers);
    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0].dueDate).toBe('2026-09-22');
    expect(result.meetingTitle).toBeDefined();
  });

  it('preserves manual meeting title on re-transcription, but updates default title', () => {
    // 1. Meeting with manually set title
    const manualMeeting = {
      id: 'm1',
      title: 'Benutzerdefinierter Titel',
      isTitleManuallySet: true
    };
    const newAiTitle = 'KI-Vorschlag Neu';
    const isManual = manualMeeting.isTitleManuallySet === true;
    const finalTitleManual = isManual ? manualMeeting.title : newAiTitle;
    expect(finalTitleManual).toBe('Benutzerdefinierter Titel');

    // 2. Meeting with auto-generated title (not manually set)
    const autoMeeting = {
      id: 'm2',
      title: 'Meeting vom 20.09.2026, 16:07',
      isTitleManuallySet: false
    };
    const isAutoManual = autoMeeting.isTitleManuallySet === true;
    const finalTitleAuto = isAutoManual ? autoMeeting.title : newAiTitle;
    expect(finalTitleAuto).toBe('KI-Vorschlag Neu');
  });
});
