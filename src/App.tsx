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
import { SpeakerClarificationModal } from './components/transcript/SpeakerClarificationModal';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { SettingsModal } from './components/settings/SettingsModal';

export const App: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('record');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<OpenRouterConfig>(AudioStorage.getOpenRouterConfig());

  // Processing & UI States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [reasoningLogs, setReasoningLogs] = useState<string[]>([]);
  const [liveReasoningText, setLiveReasoningText] = useState<string>('');
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [clarificationRequest, setClarificationRequest] = useState<SpeakerClarificationRequest | null>(null);
  const [clarificationQueue, setClarificationQueue] = useState<SpeakerClarificationRequest[]>([]);

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
   * Pipeline after recording completes or audio file uploaded
   */
  const handleRecordingComplete = async (
    audioBlob: Blob,
    mimeType: string,
    durationSeconds: number,
    title: string
  ) => {
    setIsProcessing(true);
    setReasoningLogs([`[${new Date().toLocaleTimeString('de-DE')}] Starte Audio-Pipeline für "${title}" (${Math.round(durationSeconds)}s)`]);
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
            setReasoningLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('de-DE')}] ${log}`]);
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
        `[${new Date().toLocaleTimeString('de-DE')}] ${segments.length} Sprachabschnitte erkannt. Analysiere Sprecher und Namensmuster...`
      ]);

      const { speakers, clarificationNeeded } = await SpeakerDeductionService.resolveSpeakers(
        segments,
        client.hasApiKey() ? client : undefined
      );

      setReasoningLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString('de-DE')}] ${speakers.length} Sprecher zugeordnet (${clarificationNeeded.length} unklare Stimme(n) zur Klärung).`
      ]);

      setProcessingStep('Extrahiere Aufgaben & Next Steps mit DeepSeek...');
      const tasks = await TaskExtractorService.extractTasks(
        meetingId,
        meetingDate,
        segments,
        speakers,
        client.hasApiKey() ? client : undefined,
        {
          onProgressLog: (log) => {
            setReasoningLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('de-DE')}] ${log}`]);
          },
          onReasoningChunk: (chunk) => {
            setLiveReasoningText((prev) => prev + chunk);
          }
        }
      );

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

      // Handle clarification queue
      if (clarificationNeeded.length > 0) {
        setClarificationQueue(clarificationNeeded);
        setClarificationRequest(clarificationNeeded[0]);
        setActiveTab('transcript');
      } else {
        setActiveTab('kanban');
      }
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

    // If clarification needed (e.g. Sarah), prompt user with snippet immediately
    if (clarificationNeeded.length > 0) {
      setClarificationQueue(clarificationNeeded);
      setClarificationRequest(clarificationNeeded[0]);
      setActiveTab('transcript');
    } else {
      setActiveTab('kanban');
    }
  };

  /**
   * Assign a name to an unidentified speaker (from Snippet Clarification Modal)
   */
  const handleAssignSpeakerName = async (speakerId: string, assignedName: string) => {
    if (!currentMeeting) return;

    // 1. Update speakers list
    const updatedSpeakers = currentMeeting.speakers.map((s) => {
      if (s.id === speakerId) {
        return {
          ...s,
          assignedName,
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
          speakerLabel: assignedName
        };
      }
      return seg;
    });

    // 3. Update tasks assignees if they were assigned to this speaker
    const oldSpeaker = currentMeeting.speakers.find((s) => s.id === speakerId);
    const oldLabel = oldSpeaker?.assignedName || oldSpeaker?.label || speakerId;
    const updatedTasks = currentMeeting.tasks.map((t) => {
      if (t.assignee === oldLabel || t.assignee === speakerId) {
        return { ...t, assignee: assignedName };
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
      setActiveTab('kanban');
    } catch (err) {
      console.error('Fehler beim Extrahieren der Aufgaben:', err);
    } finally {
      setIsExtractingTasks(false);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white pb-16 md:pb-0">
      {/* Header */}
      <Header
        currentMeeting={currentMeeting}
        meetings={meetings}
        onSelectMeeting={handleSelectMeeting}
        onNewMeeting={handleNewMeeting}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hasApiKey={Boolean(config.apiKey && config.apiKey.trim().length > 0)}
      />

      {/* Navigation (Desktop Tabs & Mobile Bottom Nav) */}
      <Navigation
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        pendingClarificationCount={pendingClarificationCount}
        taskCount={currentMeeting?.tasks.length || 0}
      />

      {/* Main Content Areas */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
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
            onRequestClarification={handleRequestClarification}
            onExtractTasks={handleExtractTasksAgain}
            isExtractingTasks={isExtractingTasks}
          />
        )}

        {activeTab === 'transcript' && !currentMeeting && (
          <div className="text-center py-20 px-4">
            <p className="text-slate-400 text-sm">Kein Meeting ausgewählt.</p>
            <button
              onClick={() => setActiveTab('record')}
              className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
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
          />
        )}

        {activeTab === 'kanban' && !currentMeeting && (
          <div className="text-center py-20 px-4">
            <p className="text-slate-400 text-sm">Kein Meeting ausgewählt.</p>
            <button
              onClick={() => setActiveTab('record')}
              className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
            >
              Meeting aufnehmen oder Demo laden
            </button>
          </div>
        )}
      </main>

      {/* Speaker Clarification Modal (Plays Audio Snippet) */}
      <SpeakerClarificationModal
        request={clarificationRequest}
        audioBlob={currentMeeting?.audioBlob}
        onAssignName={handleAssignSpeakerName}
        onDismiss={() => setClarificationRequest(null)}
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
