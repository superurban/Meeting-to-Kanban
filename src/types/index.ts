export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  meetingId: string;
  title: string;
  assignee: string;
  dueDate: string | null; // ISO YYYY-MM-DD or readable string
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  transcriptQuote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Speaker {
  id: string; // e.g. "speaker_1"
  label: string; // e.g. "Sprecher 1"
  assignedName: string | null; // e.g. "Florian Benne"
  confidence: number; // 0.0 - 1.0 (1.0 = manual / confirmed, >0.8 = auto-addressed)
  evidence?: string; // e.g. "Wurde direkt mit 'Florian' angesprochen und antwortete"
  color: string; // Avatar / badge color
  sampleSegmentId?: string; // Reference to representative audio segment
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerLabel: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  addressedTo?: string; // If this segment addressed someone by name
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // ISO date string
  durationSeconds: number;
  audioBlob?: Blob;
  audioUrl?: string; // ObjectURL or stored reference
  audioMimeType?: string;
  speakers: Speaker[];
  segments: TranscriptSegment[];
  tasks: Task[];
  summary?: string;
  status: 'idle' | 'recording' | 'processing' | 'ready' | 'clarification_needed';
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string; // e.g. "google/gemini-2.0-flash-001" or "anthropic/claude-3.5-sonnet"
  audioModel: string; // e.g. "google/gemini-2.0-flash-001"
  siteUrl: string;
  appName: string;
}

export interface SpeakerClarificationRequest {
  speakerId: string;
  currentLabel: string;
  bestSegment: TranscriptSegment;
  suggestedNames: string[];
  reason: string;
}
