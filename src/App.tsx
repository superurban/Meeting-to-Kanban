import React, { useState, useEffect } from 'react';
import { Meeting, SpeakerClarificationRequest, OpenRouterConfig, Task, Speaker } from './types';
import { AudioStorage } from './services/audio/AudioStorage';
import { OpenRouterClient } from './services/ai/openrouter';
import { TranscriptionService } from './services/ai/transcription';
import { SpeakerDeductionService } from './services/ai/speakerDeduction';
import { TaskExtractorService } from './services/ai/taskExtractor';

import { Header } from './components/layout/Header';
import { Navigation, AppTab } from './components/layout/Navigation';
import { MeetingRecorder } from './components/recorder/MeetingRecorder';
import { TranscriptViewer } from './components/transcript/TranscriptViewer';
import { SpeakersViewer } from './components/speakers/SpeakersViewer';
import { SpeakerClarificationModal } from './components/transcript/SpeakerClarificationModal';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { MeetingsManagerView } from './components/meetings/MeetingsManagerView';
import { DeleteConfirmModal } from './components/meetings/DeleteConfirmModal';
import { SettingsModal } from './components/settings/SettingsModal';

export const App: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('record');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<OpenRouterConfig>(AudioStorage.getOpenRouterConfig());

  // Theme Management (Light / Dark Executive SaaS)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('voice_kanban_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('voice_kanban_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Processing & UI States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [reasoningLogs, setReasoningLogs] = useState<string[]>([]);
  const [liveReasoningText, setLiveReasoningText] = useState<string>('');
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [isRetranscribing, setIsRetranscribing] = useState(false);
  const [taskAlertMessage, setTaskAlertMessage] = useState<string | null>(null);
  const [clarificationRequest, setClarificationRequest] = useState<SpeakerClarificationRequest | null>(null);
  const [clarificationQueue, setClarificationQueue] = useState<SpeakerClarificationRequest[]>([]);

  // Deletion Confirmation State
  const [deleteTargetMeeting, setDeleteTargetMeeting] = useState<Meeting | null>(null);

  // Load meetings on mount
  useEffect(() => {
    const init = async () => {
      try {
        const freshConfig = AudioStorage.getOpenRouterConfig();
        setConfig(freshConfig);
        const loaded = await AudioStorage.getAllMeetings();
        setMeetings(loaded);
        if (loaded.length > 0) {
          const first = await AudioStorage.getMeeting(loaded[0].id);
          if (first) {
            setCurrentMeetingId(first.id);
            setActiveTab(first.tasks && first.tasks.length > 0 ? 'kanban' : 'transcript');
          }
        }
      } catch (err) {
        console.error('Fehler beim Initialisieren der Datenbank:', err);
      }
    };
    init();
  }, []);

  const currentMeeting = meetings.find((m) => m.id === currentMeetingId) || null;

  const handleSaveConfig = (newConfig: OpenRouterConfig) => {
    setConfig(newConfig);
    AudioStorage.saveOpenRouterConfig(newConfig);
  };

  const handleSelectMeeting = async (id: string) => {
    const fullMeeting = await AudioStorage.getMeeting(id);
    if (fullMeeting) {
      setCurrentMeetingId(id);
      setMeetings((prev) => prev.map((m) => (m.id === id ? fullMeeting : m)));
    }
  };

  const handleNewMeeting = () => {
    setActiveTab('record');
  };

  /**
   * Meeting Deletion Handlers
   */
  const handleRequestDeleteCurrentMeeting = () => {
    if (currentMeeting) {
      setDeleteTargetMeeting(currentMeeting);
    }
  };

  const handleRequestDeleteMeeting = (meeting: Meeting) => {
    setDeleteTargetMeeting(meeting);
  };

  const handleConfirmDeleteMeeting = async (meetingId: string) => {
    try {
      await AudioStorage.deleteMeeting(meetingId);
      const remaining = meetings.filter((m) => m.id !== meetingId);
      setMeetings(remaining);

      if (currentMeetingId === meetingId) {
        if (remaining.length > 0) {
          const next = await AudioStorage.getMeeting(remaining[0].id);
          if (next) {
            setCurrentMeetingId(next.id);
            setMeetings((prev) => prev.map((m) => (m.id === next.id ? next : m)));
          } else {
            setCurrentMeetingId(remaining[0].id);
          }
        } else {
          setCurrentMeetingId(null);
          setActiveTab('record');
        }
      }

      setTaskAlertMessage('Meeting wurde erfolgreich gelöscht.');
      setTimeout(() => setTaskAlertMessage(null), 4000);
    } catch (err) {
      console.error('Fehler beim Löschen des Meetings:', err);
      alert('Fehler beim Löschen: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  /**
   * Pipeline after recording completes or audio file uploaded
   */
  const handleRecordingComplete = async (
    audioBlob: Blob,
    mimeType: string,
    durationSeconds: number,
    title: string
  ) => {
    setIsProcessing(true);
    setReasoningLogs([
      `[audio.capture] MediaRecorder Blob: ${audioBlob.size} Bytes (${mimeType}, duration: ${durationSeconds.toFixed(1)}s)`
    ]);
    setLiveReasoningText('');
    setProcessingStep('Audio wird aufbereitet...');

    const client = new OpenRouterClient(config);

    if (!client.hasApiKey()) {
      setIsProcessing(false);
      setProcessingStep('');
      alert('Kein OpenRouter API-Key gefunden!\n\nBitte trage deinen API-Key in den Einstellungen ein (Zahnrad oben rechts), damit dein gesprochenes Audio transkribiert werden kann.\n\n(Um die App ohne Key zu testen, nutze bitte unten den Button "Beispiel-Meeting laden".)');
      setIsSettingsOpen(true);
      return;
    }

    const meetingId = `meeting_${Date.now()}`;
    const meetingDate = new Date().toISOString();

    try {
      // Real AI transcription of the user's audio with live reasoning stream
      const segments = await TranscriptionService.transcribeAudio(
        audioBlob,
        mimeType,
        client,
        {
          onProgressLog: (log) => {
            setReasoningLogs((prev) => [...prev, log]);
          },
          onReasoningChunk: (chunk) => {
            setLiveReasoningText((prev) => prev + chunk);
          },
          onContentChunk: (chunk) => {
            setLiveReasoningText((prev) => prev + chunk);
          }
        }
      );

      setProcessingStep('Analysiere Sprecher & Identitäten...');
      setReasoningLogs((prev) => [
        ...prev,
        `[diarization.parse] ${segments.length} Segmente aus Modell-Antwort extrahiert.`
      ]);

      const { speakers, clarificationNeeded } = await SpeakerDeductionService.resolveSpeakers(
        segments,
        client.hasApiKey() ? client : undefined
      );

      setReasoningLogs((prev) => [
        ...prev,
        `[speaker.resolve] ${speakers.length} Sprecher erfasst • ${clarificationNeeded.length} Sprecher ohne Namen.`
      ]);

      setProcessingStep('Extrahiere Aufgaben mit DeepSeek...');
      const tasks = await TaskExtractorService.extractTasks(
        meetingId,
        meetingDate,
        segments,
        speakers,
        client.hasApiKey() ? client : undefined,
        {
          onProgressLog: (log) => {
            setReasoningLogs((prev) => [...prev, log]);
          },
          onReasoningChunk: (chunk) => {
            setLiveReasoningText((prev) => prev + chunk);
          }
        }
      );

      if (tasks.length === 0) {
        setReasoningLogs((prev) => [
          ...prev,
          `[kanban.info] 0 Aufgaben erkannt. Im Transkript wurden keine konkreten Next Steps identifiziert.`
        ]);
        setTaskAlertMessage('Keine Aufgaben im Gespräch erkannt: Die KI konnte aus dem besprochenen Inhalt keine konkreten Aufgaben oder Next Steps ableiten.');
      } else {
        setReasoningLogs((prev) => [
          ...prev,
          `[kanban.done] ${tasks.length} Aufgaben erfolgreich generiert. Wechsle zum Kanban Board...`
        ]);
        setTaskAlertMessage(null);
      }

      const newMeeting: Meeting = {
        id: meetingId,
        title,
        date: meetingDate,
        durationSeconds,
        audioBlob,
        audioMimeType: mimeType,
        speakers,
        segments,
        tasks,
        status: clarificationNeeded.length > 0 ? 'clarification_needed' : 'ready'
      };

      await AudioStorage.saveMeeting(newMeeting);
      setMeetings((prev) => [newMeeting, ...prev]);
      setCurrentMeetingId(meetingId);

      // Save clarification queue for badges & banner in Kanban
      if (clarificationNeeded.length > 0) {
        setClarificationQueue(clarificationNeeded);
      }

      // Automatically switch to Kanban board as requested
      setActiveTab('kanban');
    } catch (err) {
      console.error('Fehler in der Meeting-Verarbeitung:', err);
      alert('Ein Fehler ist bei der Verarbeitung aufgetreten: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  /**
   * One-click demo loader (Florian, Sarah, Alex)
   */
  const handleLoadDemo = async () => {
    setIsProcessing(true);
    setProcessingStep('Lade Demo-Meeting...');

    const demo = TranscriptionService.getSampleDemoMeeting();
    const meetingId = `demo_${Date.now()}`;
    const meetingDate = new Date().toISOString();

    const client = new OpenRouterClient(config);

    setProcessingStep('Erkenne Sprecher (Florian wurde direkt angesprochen)...');
    const { speakers, clarificationNeeded } = await SpeakerDeductionService.resolveSpeakers(
      demo.segments,
      client.hasApiKey() ? client : undefined
    );

    setProcessingStep('Erstelle Kanban-Aufgaben...');
    const tasks = await TaskExtractorService.extractTasks(
      meetingId,
      meetingDate,
      demo.segments,
      speakers,
      client.hasApiKey() ? client : undefined
    );

    const demoMeeting: Meeting = {
      id: meetingId,
      title: demo.title,
      date: meetingDate,
      durationSeconds: demo.durationSeconds,
      speakers,
      segments: demo.segments,
      tasks,
      status: clarificationNeeded.length > 0 ? 'clarification_needed' : 'ready'
    };

    await AudioStorage.saveMeeting(demoMeeting);
    setMeetings((prev) => [demoMeeting, ...prev]);
    setCurrentMeetingId(meetingId);

    setIsProcessing(false);
    setProcessingStep('');

    if (tasks.length === 0) {
      setTaskAlertMessage('Keine Aufgaben im Gespräch erkannt: Im Transkript wurden keine Aufgaben identifiziert.');
    } else {
      setTaskAlertMessage(null);
    }

    if (clarificationNeeded.length > 0) {
      setClarificationQueue(clarificationNeeded);
    }

    // Automatically switch to Kanban board as requested
    setActiveTab('kanban');
  };

  /**
   * Merge two speakers into one person:
   * Reassigns all segments and tasks from sourceSpeakerId to targetSpeakerId,
   * then removes sourceSpeakerId from meeting.speakers.
   */
  const handleMergeSpeakers = async (sourceSpeakerId: string, targetSpeakerId: string, skipConfirm = false) => {
    if (!currentMeeting || sourceSpeakerId === targetSpeakerId) return;

    const sourceSpeaker = currentMeeting.speakers.find((s) => s.id === sourceSpeakerId);
    const targetSpeaker = currentMeeting.speakers.find((s) => s.id === targetSpeakerId);
    if (!sourceSpeaker || !targetSpeaker) return;

    const targetName = targetSpeaker.assignedName || targetSpeaker.label;
    const sourceLabel = sourceSpeaker.assignedName || sourceSpeaker.label;

    if (!skipConfirm) {
      const confirmed = window.confirm(
        `Möchtest du "${sourceLabel}" wirklich mit "${targetName}" zusammenführen?\n\nAlle gesprochenen Abschnitte und Aufgaben werden dauerhaft "${targetName}" zugeordnet.\n\n⚠️ Diese Aktion kann nicht rückgängig gemacht werden.`
      );
      if (!confirmed) return;
    }

    // 1. Reassign all segments of source speaker to target speaker
    const updatedSegments = currentMeeting.segments.map((seg) => {
      if (seg.speakerId === sourceSpeakerId) {
        return {
          ...seg,
          speakerId: targetSpeakerId,
          speakerLabel: targetName
        };
      }
      return seg;
    });

    // 2. Remove source speaker and mark target speaker with merged note
    const updatedSpeakers = currentMeeting.speakers
      .filter((s) => s.id !== sourceSpeakerId)
      .map((s) => {
        if (s.id === targetSpeakerId) {
          return {
            ...s,
            confidence: 1.0,
            evidence: s.evidence 
              ? `${s.evidence} • Zusammengeführt mit ${sourceLabel}`
              : `Zusammengeführt mit ${sourceLabel}`
          };
        }
        return s;
      });

    // 3. Reassign tasks from source to target
    const updatedTasks = currentMeeting.tasks.map((t) => {
      if (t.assignee === sourceLabel || t.assignee === sourceSpeakerId) {
        return { ...t, assignee: targetName };
      }
      return t;
    });

    const updatedMeeting: Meeting = {
      ...currentMeeting,
      speakers: updatedSpeakers,
      segments: updatedSegments,
      tasks: updatedTasks
    };

    await AudioStorage.saveMeeting(updatedMeeting);
    setMeetings((prev) => prev.map((m) => (m.id === updatedMeeting.id ? updatedMeeting : m)));

    // Clean up clarification queue if source was in it
    const remainingQueue = clarificationQueue.filter((q) => q.speakerId !== sourceSpeakerId);
    setClarificationQueue(remainingQueue);
    if (remainingQueue.length > 0) {
      setClarificationRequest(remainingQueue[0]);
    } else {
      setClarificationRequest(null);
    }
  };

  /**
   * Assign a name to an unidentified speaker (from Snippet Clarification Modal or inline edit)
   * If the name matches an existing speaker, asks for confirmation and merges them!
   */
  const handleAssignSpeakerName = async (speakerId: string, assignedName: string) => {
    if (!currentMeeting) return;
    const cleanName = assignedName.trim();
    if (!cleanName) return;

    // Check if another existing speaker has this exact same name (case-insensitive)
    const existingSameNameSpeaker = currentMeeting.speakers.find(
      (s) => s.id !== speakerId && (s.assignedName || s.label).trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (existingSameNameSpeaker) {
      const targetLabel = existingSameNameSpeaker.assignedName || existingSameNameSpeaker.label;
      const confirmed = window.confirm(
        `Der Name "${cleanName}" existiert bereits als Sprecher.\n\nMöchtest du diese Stimme dauerhaft mit "${targetLabel}" zusammenführen?\n\n⚠️ Diese Aktion kann nicht rückgängig gemacht werden.`
      );
      if (!confirmed) return;
      await handleMergeSpeakers(speakerId, existingSameNameSpeaker.id, true);
      return;
    }

    // 1. Update speakers list
    const updatedSpeakers = currentMeeting.speakers.map((s) => {
      if (s.id === speakerId) {
        return {
          ...s,
          assignedName: cleanName,
          confidence: 1.0,
          evidence: 'Manuell nach Audio-Schnipsel-Wiedergabe bestätigt'
        };
      }
      return s;
    });

    // 2. Update segments
    const updatedSegments = currentMeeting.segments.map((seg) => {
      if (seg.speakerId === speakerId) {
        return {
          ...seg,
          speakerLabel: cleanName
        };
      }
      return seg;
    });

    // 3. Update tasks assignees if they were assigned to this speaker
    const oldSpeaker = currentMeeting.speakers.find((s) => s.id === speakerId);
    const oldLabel = oldSpeaker?.assignedName || oldSpeaker?.label || speakerId;
    const updatedTasks = currentMeeting.tasks.map((t) => {
      if (t.assignee === oldLabel || t.assignee === speakerId) {
        return { ...t, assignee: cleanName };
      }
      return t;
    });

    const updatedMeeting: Meeting = {
      ...currentMeeting,
      speakers: updatedSpeakers,
      segments: updatedSegments,
      tasks: updatedTasks
    };

    await AudioStorage.saveMeeting(updatedMeeting);
    setMeetings((prev) => prev.map((m) => (m.id === updatedMeeting.id ? updatedMeeting : m)));

    // Next in queue
    const remainingQueue = clarificationQueue.filter((q) => q.speakerId !== speakerId);
    setClarificationQueue(remainingQueue);
    if (remainingQueue.length > 0) {
      setClarificationRequest(remainingQueue[0]);
    } else {
      setClarificationRequest(null);
    }
  };

  /**
   * Request manual clarification for any speaker on demand
   */
  const handleRequestClarification = (speakerId: string) => {
    if (!currentMeeting) return;
    const speaker = currentMeeting.speakers.find((s) => s.id === speakerId);
    if (!speaker) return;

    const speakerSegments = currentMeeting.segments.filter((s) => s.speakerId === speakerId);
    const bestSegment = speakerSegments[0] || {
      id: 'best',
      speakerId,
      speakerLabel: speaker.label,
      startTime: 0,
      endTime: 4,
      text: 'Audio-Abschnitt'
    };

    const suggestedNames = Array.from(
      new Set(
        currentMeeting.segments
          .map((s) => s.addressedTo)
          .filter(Boolean) as string[]
      )
    );

    setClarificationRequest({
      speakerId,
      currentLabel: speaker.assignedName || speaker.label,
      bestSegment,
      suggestedNames,
      reason: 'Sprecher-Zuordnung manuell bearbeiten'
    });
  };

  /**
   * Trigger Task Extraction again on the updated transcript
   */
  const handleExtractTasksAgain = async () => {
    if (!currentMeeting) return;
    setIsExtractingTasks(true);

    const client = new OpenRouterClient(config);
    try {
      const extracted = await TaskExtractorService.extractTasks(
        currentMeeting.id,
        currentMeeting.date,
        currentMeeting.segments,
        currentMeeting.speakers,
        client.hasApiKey() ? client : undefined
      );

      const updatedMeeting: Meeting = {
        ...currentMeeting,
        tasks: extracted
      };

      await AudioStorage.saveMeeting(updatedMeeting);
      setMeetings((prev) => prev.map((m) => (m.id === updatedMeeting.id ? updatedMeeting : m)));
      
      if (extracted.length === 0) {
        setTaskAlertMessage('Keine Aufgaben im Gespräch erkannt: Im Transkript wurden keine konkreten Aufgaben oder Next Steps identifiziert.');
      } else {
        setTaskAlertMessage(null);
      }

      setActiveTab('kanban');
    } catch (err) {
      console.error('Fehler beim Extrahieren der Aufgaben:', err);
    } finally {
      setIsExtractingTasks(false);
    }
  };

  /**
   * Re-run AI transcription & speaker diarization on the current meeting
   */
  const handleRetranscribeMeeting = async () => {
    if (!currentMeeting) return;
    if (!currentMeeting.audioBlob) {
      alert('Keine Original-Audiodatei für dieses Meeting vorhanden.');
      return;
    }

    const client = new OpenRouterClient(config);
    if (!client.hasApiKey()) {
      alert('Bitte trage deinen OpenRouter API-Key in den Einstellungen ein, um die KI-Transkription auszuführen.');
      setIsSettingsOpen(true);
      return;
    }

    const confirmed = window.confirm(
      'Möchtest du dieses Meeting noch einmal vollständig von der KI transkribieren lassen?\n\nDas bisherige Transkript und die Sprecherzuordnungen werden dabei anhand der Originalaufnahme neu analysiert.'
    );
    if (!confirmed) return;

    setIsRetranscribing(true);
    setTaskAlertMessage('Erneute AI-Transkription läuft...');

    try {
      setReasoningLogs((prev) => [
        ...prev,
        `[retranscribe.start] Starte erneute AI-Transkription für "${currentMeeting.title}"...`
      ]);

      const segments = await TranscriptionService.transcribeAudio(
        currentMeeting.audioBlob,
        currentMeeting.audioMimeType || 'audio/webm',
        client,
        {
          onProgressLog: (log) => setReasoningLogs((prev) => [...prev, log]),
          onReasoningChunk: (chunk) => setLiveReasoningText((prev) => prev + chunk),
          onContentChunk: (chunk) => setLiveReasoningText((prev) => prev + chunk)
        }
      );

      const { speakers, clarificationNeeded } = await SpeakerDeductionService.resolveSpeakers(
        segments,
        client.hasApiKey() ? client : undefined
      );

      const updatedMeeting: Meeting = {
        ...currentMeeting,
        speakers,
        segments,
        status: clarificationNeeded.length > 0 ? 'clarification_needed' : 'ready'
      };

      await AudioStorage.saveMeeting(updatedMeeting);
      setMeetings((prev) => prev.map((m) => (m.id === updatedMeeting.id ? updatedMeeting : m)));
      setClarificationQueue(clarificationNeeded);
      setTaskAlertMessage('Transkription erfolgreich mit KI neu erstellt!');
      setTimeout(() => setTaskAlertMessage(null), 4000);
    } catch (err) {
      console.error('Fehler bei erneuter Transkription:', err);
      alert('Fehler bei erneuter Transkription: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRetranscribing(false);
    }
  };

  /**
   * Update tasks from Kanban Board (status change, edits, drag & drop)
   */
  const handleUpdateTasks = async (newTasks: Task[]) => {
    if (!currentMeeting) return;
    const updatedMeeting: Meeting = {
      ...currentMeeting,
      tasks: newTasks
    };

    await AudioStorage.saveMeeting(updatedMeeting);
    setMeetings((prev) => prev.map((m) => (m.id === updatedMeeting.id ? updatedMeeting : m)));
  };

  const handleResetData = async () => {
    if (currentMeeting) {
      await AudioStorage.deleteMeeting(currentMeeting.id);
    }
    const all = await AudioStorage.getAllMeetings();
    for (const m of all) {
      await AudioStorage.deleteMeeting(m.id);
    }
    setMeetings([]);
    setCurrentMeetingId(null);
    setActiveTab('record');
  };

  // Count unassigned speakers
  const pendingClarificationCount =
    currentMeeting?.speakers.filter((s) => !s.assignedName || s.confidence < 0.8).length || 0;

  return (
    <div 
      className="min-h-screen flex flex-col font-sans transition-colors duration-150 pb-16 md:pb-0"
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Executive SaaS Header */}
      <Header
        currentMeeting={currentMeeting}
        meetings={meetings}
        onSelectMeeting={handleSelectMeeting}
        onNewMeeting={handleNewMeeting}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRequestDeleteCurrentMeeting={handleRequestDeleteCurrentMeeting}
        onOpenMeetingsManager={() => setActiveTab('meetings')}
        hasApiKey={Boolean(config.apiKey && config.apiKey.trim().length > 0)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Navigation (Desktop Tabs with Recordings Dropdown & Mobile Bottom Nav) */}
      <Navigation
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        pendingClarificationCount={pendingClarificationCount}
        speakerCount={currentMeeting?.speakers.length || 0}
        segmentCount={currentMeeting?.segments.length || 0}
        taskCount={currentMeeting?.tasks.length || 0}
        meetings={meetings}
        currentMeeting={currentMeeting}
        onSelectMeeting={handleSelectMeeting}
        onNewMeeting={handleNewMeeting}
        onOpenMeetingsManager={() => setActiveTab('meetings')}
        onRequestDeleteCurrentMeeting={handleRequestDeleteCurrentMeeting}
      />

      {/* Main Content Areas */}
      <main className="flex-1 w-full">
        {activeTab === 'record' && (
          <MeetingRecorder
            onRecordingComplete={handleRecordingComplete}
            onLoadDemo={handleLoadDemo}
            onOpenSettings={() => setIsSettingsOpen(true)}
            hasApiKey={Boolean(config.apiKey && config.apiKey.trim().length > 0)}
            isProcessing={isProcessing}
            processingStep={processingStep}
            reasoningLogs={reasoningLogs}
            liveReasoningText={liveReasoningText}
            currentModelName={config.audioModel || 'Gemini 3.8 Flash'}
          />
        )}

        {activeTab === 'transcript' && currentMeeting && (
          <TranscriptViewer
            meeting={currentMeeting}
            onUpdateSpeakerName={(id, name) => handleAssignSpeakerName(id, name)}
            onMergeSpeakers={handleMergeSpeakers}
            onRequestClarification={handleRequestClarification}
            onExtractTasks={handleExtractTasksAgain}
            isExtractingTasks={isExtractingTasks}
            onRetranscribe={handleRetranscribeMeeting}
            isRetranscribing={isRetranscribing}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'transcript' && !currentMeeting && (
          <div className="text-center py-20 px-4">
            <p className="text-xs text-[var(--text-muted)]">Kein Meeting ausgewählt.</p>
            <button
              onClick={() => setActiveTab('record')}
              className="btn-primary mt-3 text-xs"
            >
              Meeting aufnehmen oder Demo laden
            </button>
          </div>
        )}

        {activeTab === 'speakers' && currentMeeting && (
          <SpeakersViewer
            meeting={currentMeeting}
            onUpdateSpeakerName={(id, name) => handleAssignSpeakerName(id, name)}
            onMergeSpeakers={handleMergeSpeakers}
            onRequestClarification={handleRequestClarification}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'speakers' && !currentMeeting && (
          <div className="text-center py-20 px-4">
            <p className="text-xs text-[var(--text-muted)]">Kein Meeting ausgewählt.</p>
            <button
              onClick={() => setActiveTab('record')}
              className="btn-primary mt-3 text-xs"
            >
              Meeting aufnehmen oder Demo laden
            </button>
          </div>
        )}

        {activeTab === 'kanban' && currentMeeting && (
          <KanbanBoard
            meeting={currentMeeting}
            tasks={currentMeeting.tasks || []}
            speakers={currentMeeting.speakers || []}
            onUpdateTasks={handleUpdateTasks}
            onExtractTasksAgain={handleExtractTasksAgain}
            isExtracting={isExtractingTasks}
            taskAlertMessage={taskAlertMessage}
            onNavigateTab={setActiveTab}
            onRequestClarification={handleRequestClarification}
          />
        )}

        {activeTab === 'kanban' && !currentMeeting && (
          <div className="text-center py-20 px-4">
            <p className="text-xs text-[var(--text-muted)]">Kein Meeting ausgewählt.</p>
            <button
              onClick={() => setActiveTab('record')}
              className="btn-primary mt-3 text-xs"
            >
              Meeting aufnehmen oder Demo laden
            </button>
          </div>
        )}

        {activeTab === 'meetings' && (
          <MeetingsManagerView
            meetings={meetings}
            currentMeetingId={currentMeetingId}
            onSelectMeeting={handleSelectMeeting}
            onRequestDeleteMeeting={handleRequestDeleteMeeting}
            onNewMeeting={handleNewMeeting}
            onNavigateTab={setActiveTab}
          />
        )}
      </main>

      {/* Speaker Clarification Modal (Plays Audio Snippet) */}
      <SpeakerClarificationModal
        request={clarificationRequest}
        audioBlob={currentMeeting?.audioBlob}
        onAssignName={handleAssignSpeakerName}
        onDismiss={() => setClarificationRequest(null)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        meeting={deleteTargetMeeting}
        isOpen={Boolean(deleteTargetMeeting)}
        onConfirm={handleConfirmDeleteMeeting}
        onClose={() => setDeleteTargetMeeting(null)}
      />

      {/* Settings Modal (OpenRouter & Model Selection) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        config={config}
        onSave={handleSaveConfig}
        onClose={() => setIsSettingsOpen(false)}
        onResetData={handleResetData}
      />
    </div>
  );
};

export default App;
