export class AudioSnippetPlayer {
  private static currentAudio: HTMLAudioElement | null = null;
  private static stopTimeout: number | null = null;
  private static activeCallback?: (isPlaying: boolean, currentTime?: number) => void;

  /**
   * Plays an audio snippet from startTime to endTime (in seconds).
   * If maxDurationSeconds is provided (e.g. 5.0), playback will stop after this duration.
   * If not provided or set to undefined, plays the full segment normally.
   */
  static async playSnippet(
    blobOrUrl: Blob | string | undefined,
    startTime: number,
    endTime: number,
    textFallback?: string,
    onStatusChange?: (isPlaying: boolean) => void,
    maxDurationSeconds?: number
  ): Promise<void> {
    this.stopCurrent();

    if (onStatusChange) {
      this.activeCallback = onStatusChange;
      this.activeCallback(true);
    }

    const naturalDuration = Math.max(0.5, endTime - startTime);
    const duration = maxDurationSeconds ? Math.min(maxDurationSeconds, naturalDuration) : naturalDuration;
    const targetEndTime = maxDurationSeconds ? (startTime + duration) : Math.max(endTime, startTime + naturalDuration);

    if (blobOrUrl) {
      try {
        const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
        const audio = new Audio(url);
        this.currentAudio = audio;

        const handleStop = () => {
          this.stopCurrent();
        };

        audio.onended = handleStop;
        audio.onerror = () => {
          this.fallbackSpeech(textFallback, duration);
        };

        const executePlay = async () => {
          try {
            if (startTime > 0) {
              audio.currentTime = startTime;
            }

            // Track playback to stop cleanly at targetEndTime
            audio.ontimeupdate = () => {
              if (audio.currentTime >= targetEndTime) {
                handleStop();
              }
            };

            await audio.play();

            // Safety timeout: duration + 1.5s buffer
            this.stopTimeout = window.setTimeout(() => {
              handleStop();
            }, (duration + 1.5) * 1000);
          } catch (err) {
            console.warn('Audio play failed, using fallback speech:', err);
            this.fallbackSpeech(textFallback, duration);
          }
        };

        if (audio.readyState >= 1) {
          // Metadata already available, seek and play immediately
          await executePlay();
        } else {
          // Wait for metadata so currentTime seek is guaranteed across all browsers
          audio.addEventListener('loadedmetadata', () => {
            executePlay();
          }, { once: true });
          audio.load();
        }

        return;
      } catch (err) {
        console.warn('Audio snippet playback failed, falling back to speech synthesis:', err);
      }
    }

    // Fallback: Web Speech API synthesis or simulated audio
    this.fallbackSpeech(textFallback, duration);
  }

  private static fallbackSpeech(text?: string, maxDuration = 4): void {
    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 1.0;
      utterance.onend = () => {
        this.stopCurrent();
      };
      utterance.onerror = () => {
        this.stopCurrent();
      };
      window.speechSynthesis.speak(utterance);
    } else {
      // Simple tone simulation using Web Audio API
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      } catch {
        // ignore
      }
      this.stopTimeout = window.setTimeout(() => {
        this.stopCurrent();
      }, 1500);
    }
  }

  static stopCurrent(): void {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.ontimeupdate = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.activeCallback) {
      this.activeCallback(false);
      this.activeCallback = undefined;
    }
  }
}
