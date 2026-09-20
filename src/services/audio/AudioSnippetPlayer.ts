export class AudioSnippetPlayer {
  private static audioContext: AudioContext | null = null;
  private static currentSource: AudioBufferSourceNode | null = null;
  private static currentAudio: HTMLAudioElement | null = null;
  private static stopTimeout: number | null = null;
  private static activeCallback?: (isPlaying: boolean) => void;
  private static bufferCache = new WeakMap<Blob, AudioBuffer>();

  private static getOrCreateAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    return this.audioContext;
  }

  /**
   * Plays an authentic audio snippet from the original recording from startTime to endTime.
   * If maxDurationSeconds is provided (e.g. 5.0), playback will stop after this duration.
   * Uses Web Audio API decodeAudioData for 100% sample-accurate, seek-bug-free playback of the original voice.
   */
  static async playSnippet(
    blobOrUrl: Blob | string | undefined,
    startTime: number,
    endTime: number,
    _textFallback?: string,
    onStatusChange?: (isPlaying: boolean) => void,
    maxDurationSeconds?: number
  ): Promise<void> {
    this.stopCurrent();

    if (!blobOrUrl) {
      console.warn('[AudioSnippetPlayer] Keine Original-Audiodatei vorhanden.');
      if (onStatusChange) onStatusChange(false);
      return;
    }

    if (onStatusChange) {
      this.activeCallback = onStatusChange;
      this.activeCallback(true);
    }

    // Add grace padding (0.6s) to ensure the last word/syllable is not clipped by AI timestamp truncation
    const gracePadding = maxDurationSeconds ? 0 : 0.6;
    const requestedEndTime = endTime + gracePadding;
    const naturalDuration = Math.max(0.3, requestedEndTime - startTime);
    const duration = maxDurationSeconds ? Math.min(maxDurationSeconds, naturalDuration) : naturalDuration;

    // 1. If it's a real Blob, decode via Web Audio API for 100% reliable original voice playback
    if (blobOrUrl instanceof Blob) {
      try {
        const ctx = this.getOrCreateAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        let audioBuffer = this.bufferCache.get(blobOrUrl);
        if (!audioBuffer) {
          const arrayBuffer = await blobOrUrl.arrayBuffer();
          // slice(0) copies the buffer so decodeAudioData doesn't detach the original
          audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          this.bufferCache.set(blobOrUrl, audioBuffer);
        }

        const safeStartTime = Math.max(0, Math.min(startTime, audioBuffer.duration - 0.05));
        const safeDuration = Math.min(duration, Math.max(0.2, audioBuffer.duration - safeStartTime));

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        this.currentSource = source;

        source.onended = () => {
          if (this.currentSource === source) {
            this.stopCurrent();
          }
        };

        source.start(0, safeStartTime, safeDuration);

        // Backup stop timeout
        this.stopTimeout = window.setTimeout(() => {
          this.stopCurrent();
        }, (safeDuration + 0.3) * 1000);

        return;
      } catch (err) {
        console.warn('[AudioSnippetPlayer] Web Audio API decoding failed, attempting HTML5 Audio fallback:', err);
      }
    }

    // 2. Fallback to HTML5 Audio element for remote URLs or if Web Audio decoding failed
    try {
      const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
      const audio = new Audio(url);
      this.currentAudio = audio;

      const handleStop = () => {
        this.stopCurrent();
      };

      audio.onended = handleStop;
      audio.onerror = (e) => {
        console.error('[AudioSnippetPlayer] HTML5 Audio error:', e);
        this.stopCurrent();
      };

      const executePlay = async () => {
        try {
          if (startTime > 0 && Number.isFinite(audio.duration) && startTime < audio.duration) {
            audio.currentTime = startTime;
          }

          audio.ontimeupdate = () => {
            if (audio.currentTime >= (startTime + duration)) {
              handleStop();
            }
          };

          await audio.play();

          this.stopTimeout = window.setTimeout(() => {
            handleStop();
          }, (duration + 1.0) * 1000);
        } catch (playErr) {
          console.error('[AudioSnippetPlayer] Playback execution failed:', playErr);
          this.stopCurrent();
        }
      };

      if (audio.readyState >= 1) {
        await executePlay();
      } else {
        audio.addEventListener('loadedmetadata', () => {
          executePlay();
        }, { once: true });
        audio.load();
      }
    } catch (err) {
      console.error('[AudioSnippetPlayer] Original audio playback could not be started:', err);
      this.stopCurrent();
    }
  }

  static stopCurrent(): void {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // already stopped
      }
      this.currentSource = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.ontimeupdate = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio = null;
    }
    if (this.activeCallback) {
      const cb = this.activeCallback;
      this.activeCallback = undefined;
      cb(false);
    }
  }
}
