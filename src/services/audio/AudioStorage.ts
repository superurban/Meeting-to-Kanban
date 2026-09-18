import { Meeting, Task, OpenRouterConfig } from '../../types';

const DB_NAME = 'VoiceToKanbanDB';
const DB_VERSION = 1;
const STORE_MEETINGS = 'meetings';
const STORE_AUDIO = 'audio_blobs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MEETINGS)) {
        db.createObjectStore(STORE_MEETINGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class AudioStorage {
  static async saveAudioBlob(meetingId: string, blob: Blob): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, 'readwrite');
      const store = tx.objectStore(STORE_AUDIO);
      const req = store.put({ id: meetingId, blob, updatedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  static async getAudioBlob(meetingId: string): Promise<Blob | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, 'readonly');
      const store = tx.objectStore(STORE_AUDIO);
      const req = store.get(meetingId);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  static async deleteAudioBlob(meetingId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, 'readwrite');
      const store = tx.objectStore(STORE_AUDIO);
      const req = store.delete(meetingId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  static async saveMeeting(meeting: Meeting): Promise<void> {
    // Separate the blob from the JSON meeting metadata before storing in meetings store
    const { audioBlob, audioUrl, ...metaMeeting } = meeting;
    if (audioBlob) {
      await this.saveAudioBlob(meeting.id, audioBlob);
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEETINGS, 'readwrite');
      const store = tx.objectStore(STORE_MEETINGS);
      const req = store.put(metaMeeting);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  static async getMeeting(id: string): Promise<Meeting | null> {
    const db = await openDB();
    const meta: Meeting | null = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEETINGS, 'readonly');
      const store = tx.objectStore(STORE_MEETINGS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!meta) return null;

    // Attach audio blob and create URL if exists
    const audioBlob = await this.getAudioBlob(id);
    if (audioBlob) {
      meta.audioBlob = audioBlob;
      meta.audioUrl = URL.createObjectURL(audioBlob);
    }
    return meta;
  }

  static async getAllMeetings(): Promise<Meeting[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEETINGS, 'readonly');
      const store = tx.objectStore(STORE_MEETINGS);
      const req = store.getAll();
      req.onsuccess = () => {
        const meetings: Meeting[] = req.result || [];
        // Sort descending by date
        meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        resolve(meetings);
      };
      req.onerror = () => reject(req.error);
    });
  }

  static async deleteMeeting(id: string): Promise<void> {
    await this.deleteAudioBlob(id);
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEETINGS, 'readwrite');
      const store = tx.objectStore(STORE_MEETINGS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // OpenRouter Settings
  static getOpenRouterConfig(): OpenRouterConfig {
    const saved = localStorage.getItem('openrouter_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      apiKey: '',
      model: 'google/gemini-2.0-flash-001',
      audioModel: 'google/gemini-2.0-flash-001',
      siteUrl: window.location.origin,
      appName: 'VoiceToKanban'
    };
  }

  static saveOpenRouterConfig(config: OpenRouterConfig): void {
    localStorage.setItem('openrouter_config', JSON.stringify(config));
  }
}
