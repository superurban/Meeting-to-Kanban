export type WaveformCallback = (frequencyData: Uint8Array, volume: number) => void;

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private startTime: number = 0;
  private timerInterval: number | null = null;
  private mimeType: string = 'audio/webm';

  private onDurationUpdate?: (seconds: number) => void;
  private onWaveformUpdate?: WaveformCallback;

  static getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus'
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }

  async start(
    onWaveform?: WaveformCallback,
    onDuration?: (seconds: number) => void
  ): Promise<void> {
    this.onWaveformUpdate = onWaveform;
    this.onDurationUpdate = onDuration;
    this.audioChunks = [];

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    this.mimeType = AudioRecorder.getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.mimeType
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // Setup Web Audio Analyser
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioCtx();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;
    source.connect(this.analyser);

    this.startTime = Date.now();
    this.timerInterval = window.setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      if (this.onDurationUpdate) {
        this.onDurationUpdate(elapsed);
      }
    }, 200);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudio = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalizedVolume = Math.min(1, average / 128);

      if (this.onWaveformUpdate) {
        this.onWaveformUpdate(dataArray, normalizedVolume);
      }

      this.animFrameId = requestAnimationFrame(checkAudio);
    };

    this.animFrameId = requestAnimationFrame(checkAudio);
    this.mediaRecorder.start(500); // 500ms slices for smooth capture
  }

  stop(): Promise<{ blob: Blob; mimeType: string; durationSeconds: number }> {
    return new Promise((resolve) => {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      const finalDuration = (Date.now() - this.startTime) / 1000;

      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.cleanup();
        const blob = new Blob(this.audioChunks, { type: this.mimeType });
        resolve({ blob, mimeType: this.mimeType, durationSeconds: finalDuration });
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: this.mimeType });
        this.cleanup();
        resolve({ blob, mimeType: this.mimeType, durationSeconds: finalDuration });
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
