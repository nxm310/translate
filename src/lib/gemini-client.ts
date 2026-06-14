import { SUPPORTED_LANGUAGES } from "./languages";

export class GeminiClient {
  private ws1: WebSocket | null = null;
  private ws2: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackNode: AudioWorkletNode | null = null;

  private ws1Ready = false;
  private ws2Ready = false;

  // Speaking state tracking
  private playbackEndTime = 0;

  private get isSpeaking(): boolean {
    return Date.now() < this.playbackEndTime;
  }

  // Channel lock: only one connection can produce audio/text at a time
  private activeChannel: string | null = null;

  private pendingInputTranscripts = new Map<string, string>();

  public onStateChange: (state: "idle" | "connecting" | "connected" | "error") => void = () => {};
  public onTranscript: (text: string, isFinal: boolean, targetLang: string) => void = () => {};
  public onVolumeChange: (volume: number) => void = () => {};
  public onError: (error: string) => void = () => {};

  constructor(
    private apiKey: string,
    private lang1: string,
    private lang2: string
  ) {}

  async connect() {
    this.onStateChange("connecting");
    this.ws1Ready = false;
    this.ws2Ready = false;
    this.activeChannel = null;

    try {
      // 1. Initialize Audio (must be done immediately on user click for iOS Safari)
      await this.startAudio();

      // 2. Connect WebSockets — one per translation direction using the v1alpha endpoint
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

      // WS1: translates INTO lang1 (e.g. when someone speaks lang2, output is lang1)
      this.ws1 = new WebSocket(url);
      this.ws1.onopen = () => this.setupSession(this.ws1, this.lang1, "Aoede");
      this.ws1.onmessage = async (event) => {
        try {
          const text = event.data instanceof Blob ? await event.data.text() : event.data;
          this.handleMessage(JSON.parse(text), this.lang1);
        } catch (err: any) {
          console.error("WS1 Message Error:", err);
          this.onError(`Erreur message (WS1): ${err.message || err}`);
        }
      };
      this.ws1.onclose = (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          this.onError(`Erreur de connexion (WS1: ${event.code}): ${event.reason || "Connexion rejetée par Gemini"}`);
        }
        this.disconnect();
      };
      this.ws1.onerror = () => this.onError("Erreur réseau WebSocket (WS1)");

      // WS2: translates INTO lang2 (e.g. when someone speaks lang1, output is lang2)
      this.ws2 = new WebSocket(url);
      this.ws2.onopen = () => this.setupSession(this.ws2, this.lang2, "Puck");
      this.ws2.onmessage = async (event) => {
        try {
          const text = event.data instanceof Blob ? await event.data.text() : event.data;
          this.handleMessage(JSON.parse(text), this.lang2);
        } catch (err: any) {
          console.error("WS2 Message Error:", err);
          this.onError(`Erreur message (WS2): ${err.message || err}`);
        }
      };
      this.ws2.onclose = (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          this.onError(`Erreur de connexion (WS2: ${event.code}): ${event.reason || "Connexion rejetée par Gemini"}`);
        }
        this.disconnect();
      };
      this.ws2.onerror = () => this.onError("Erreur réseau WebSocket (WS2)");

    } catch (e) {
      console.error(e);
      this.onError((e as Error).message);
      this.onStateChange("error");
    }
  }

  private setupSession(ws: WebSocket | null, targetLang: string, voiceName: string) {
    const setupMessage = {
      setup: {
        model: "models/gemini-3.5-live-translate-preview",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName,
              },
            },
          },
          translationConfig: {
            targetLanguageCode: targetLang,
            echoTargetLanguage: false,
          },
        },
        input_audio_transcription: {},
        output_audio_transcription: {},
        realtimeInputConfig: {
          activityHandling: "NO_INTERRUPTION",
        },
      },
    };
    console.log(`Sending setup configuration for targetLang=${targetLang} and voiceName=${voiceName}`);
    ws?.send(JSON.stringify(setupMessage));
  }

  private isNonSilent(base64Data: string): boolean {
    try {
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const alignedLength = Math.floor(bytes.byteLength / 2) * 2;
      const int16Array = new Int16Array(bytes.buffer, 0, alignedLength / 2);
      
      let sum = 0;
      const count = int16Array.length;
      for (let i = 0; i < count; i++) {
        sum += Math.abs(int16Array[i]);
      }
      const avg = count > 0 ? (sum / count) / 32768.0 : 0;
      return avg >= 0.00001; // Lower threshold to avoid ignoring quiet speech
    } catch (e) {
      console.error("Error checking silence:", e);
      return true; // Play if checking fails
    }
  }

  private handleMessage(data: any, targetLang: string) {
    try {
      if (data.setupComplete) {
        if (targetLang === this.lang1) this.ws1Ready = true;
        if (targetLang === this.lang2) this.ws2Ready = true;

        if (this.ws1Ready && this.ws2Ready) {
          this.onStateChange("connected");
          console.log("Dual WebSocket connection established and ready");
        }
      } else if (data.serverContent) {
        // A. Check for audio presence and filter out silent turns immediately
        let hasAudio = false;
        let hasNonSilentAudio = false;
        const modelTurn = data.serverContent.modelTurn;
        if (modelTurn) {
          for (const part of modelTurn.parts) {
            if (part.inlineData && part.inlineData.data) {
              hasAudio = true;
              if (this.isNonSilent(part.inlineData.data)) {
                hasNonSilentAudio = true;
              }
            }
          }
        }

        if (hasAudio && !hasNonSilentAudio) {
          console.log(`handleMessage: ignored silent modelTurn from ${targetLang}`);
          return;
        }

        // B. Claim active channel lock if currently idle
        const hasOutput = !!(modelTurn || data.serverContent.outputTranscription || data.serverContent.output_transcription);
        if (hasOutput && this.activeChannel === null) {
          this.activeChannel = targetLang;
          console.log(`Locked activeChannel to: ${targetLang}`);
        }

        // C. Process translation content only for the active channel
        if (this.activeChannel === targetLang) {
          // 1. Accumulate input transcription (what the user said in the source language)
          const inputTx = data.serverContent.inputTranscription || data.serverContent.input_transcription;
          if (inputTx && inputTx.text) {
            const current = this.pendingInputTranscripts.get(targetLang) || "";
            const newText = current + inputTx.text;
            this.pendingInputTranscripts.set(targetLang, newText);

            const sourceLang = targetLang === this.lang1 ? this.lang2 : this.lang1;
            this.onTranscript(newText, true, sourceLang);
            this.pendingInputTranscripts.delete(targetLang);
          }

          // 2. Accumulate and dispatch output transcription (the translation text)
          const outputTx = data.serverContent.outputTranscription || data.serverContent.output_transcription;
          if (outputTx && outputTx.text) {
            const pendingInput = this.pendingInputTranscripts.get(targetLang);
            if (pendingInput) {
              const sourceLang = targetLang === this.lang1 ? this.lang2 : this.lang1;
              this.onTranscript(pendingInput, true, sourceLang);
              this.pendingInputTranscripts.delete(targetLang);
            }
            this.onTranscript(outputTx.text, true, targetLang);
          }

          // 3. Accumulate modelTurn parts (audio and text)
          if (modelTurn) {
            const pendingInput = this.pendingInputTranscripts.get(targetLang);
            if (pendingInput) {
              const sourceLang = targetLang === this.lang1 ? this.lang2 : this.lang1;
              this.onTranscript(pendingInput, true, sourceLang);
              this.pendingInputTranscripts.delete(targetLang);
            }

            for (const part of modelTurn.parts) {
              if (part.text) {
                this.onTranscript(part.text, true, targetLang);
              }
              if (part.inlineData && part.inlineData.data) {
                this.playAudio(part.inlineData.data);
              }
            }
          }
        }

        // D. Upon turn completion, release lock
        if (data.serverContent.turnComplete) {
          if (this.activeChannel === targetLang) {
            this.playbackNode?.port.postMessage("turnComplete"); // Flush buffer in worklet immediately
            const pendingInput = this.pendingInputTranscripts.get(targetLang);
            if (pendingInput) {
              const sourceLang = targetLang === this.lang1 ? this.lang2 : this.lang1;
              this.onTranscript(pendingInput, true, sourceLang);
            }
            this.activeChannel = null;
            console.log(`Unlocked activeChannel on turnComplete`);
          }
          this.pendingInputTranscripts.delete(targetLang);
        }

        if (data.serverContent.interrupted) {
          this.playbackNode?.port.postMessage("interrupt");
          this.playbackEndTime = 0;
          if (this.activeChannel === targetLang) {
            this.activeChannel = null;
            console.log(`Unlocked activeChannel on interruption`);
          }
          this.pendingInputTranscripts.delete(targetLang);
        }
      }
    } catch (err: any) {
      console.error("handleMessage Error:", err);
      this.onError(`Erreur message: ${err.message || err}`);
    }
  }

  private async startAudio() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Unlock AudioContext immediately within the user gesture before any asynchronous awaits.
      const buffer = ctx.createBuffer(1, 1, 22050);
      const dummySource = ctx.createBufferSource();
      dummySource.buffer = buffer;
      dummySource.connect(ctx.destination);
      dummySource.start(0);

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      this.audioContext = ctx;

      // Get basePath for GitHub Pages (/translate) or empty for local
      const basePath = window.location.pathname.startsWith('/translate') ? '/translate' : '';

      // Load worklet modules
      await this.audioContext.audioWorklet.addModule(`${basePath}/capture.worklet.js`);
      await this.audioContext.audioWorklet.addModule(`${basePath}/playback.worklet.js`);

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const micSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.captureNode = new AudioWorkletNode(this.audioContext, "audio-capture-processor");

      this.captureNode.port.onmessage = (e) => {
        try {
          if (e.data.type === "audio") {
            const rawData = e.data.data;
            this.sendAudio(rawData);

            // Calculate volume
            let sum = 0;
            for (let i = 0; i < rawData.length; i++) {
              sum += rawData[i] * rawData[i];
            }
            const rms = Math.sqrt(sum / rawData.length);
            const volume = this.isSpeaking ? 0 : Math.min(100, Math.round(rms * 250));
            this.onVolumeChange(volume);
          }
        } catch (err: any) {
          console.error("Capture onmessage Error:", err);
          this.onError(`Erreur capture: ${err.message || err}`);
        }
      };

      micSource.connect(this.captureNode);

      this.playbackNode = new AudioWorkletNode(this.audioContext, "pcm-processor", {
        outputChannelCount: [2] // Configure to 2-channel stereo for high device compatibility
      });
      this.playbackNode.port.onmessage = (e) => {
        if (e.data && e.data.type === "log") {
          console.log(`[PlaybackWorklet] ${e.data.message}`);
        } else if (e.data && e.data.type === "state") {
          console.log(`[PlaybackWorklet] state isPlaying: ${e.data.isPlaying}`);
        }
      };
      this.playbackNode.connect(this.audioContext.destination);

    } catch (e) {
      console.error("Audio error", e);
      throw new Error("Veuillez autoriser l'accès au microphone dans les réglages de votre navigateur.");
    }
  }

  private playAudio(base64Data: string) {
    if (!this.playbackNode) return;

    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(console.error);
    }

    const binaryStr = atob(base64Data);
    
    // Update playback end time (24kHz, 16-bit mono = 2 bytes per sample)
    const durationMs = (binaryStr.length / 2) / 24;
    const now = Date.now();
    this.playbackEndTime = Math.max(this.playbackEndTime, now) + durationMs;

    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const alignedLength = Math.floor(bytes.byteLength / 2) * 2;
    const int16Array = new Int16Array(bytes.buffer, 0, alignedLength / 2);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const nativeRate = this.audioContext?.sampleRate || 48000;
    const resampled = this.resample(float32Array, 24000, nativeRate);
    
    // Log sample statistics to check for silence or NaN values
    let min = 0, max = 0, sum = 0, nanCount = 0;
    for (let i = 0; i < resampled.length; i++) {
      const val = resampled[i];
      if (isNaN(val)) {
        nanCount++;
      } else {
        if (val < min) min = val;
        if (val > max) max = val;
        sum += Math.abs(val);
      }
    }
    const avg = resampled.length > 0 ? sum / resampled.length : 0;
    console.log(`playAudio stats: min=${min.toFixed(4)}, max=${max.toFixed(4)}, avg=${avg.toFixed(4)}, nans=${nanCount}, sampleRate=${nativeRate}`);

    // Send audio buffer to worklet (transferring buffer)
    this.playbackNode.port.postMessage(resampled, [resampled.buffer]);
  }

  private sendAudio(float32Data: Float32Array) {
    if (this.isSpeaking) {
      return; // Skip sending audio while playing back translation
    }

    // Safety release: when the user starts speaking, release any lingering active channel lock
    if (this.activeChannel !== null) {
      console.log("User started speaking: releasing activeChannel lock");
      this.activeChannel = null;
    }

    const ws1Open = this.ws1 && this.ws1.readyState === WebSocket.OPEN;
    const ws2Open = this.ws2 && this.ws2.readyState === WebSocket.OPEN;
    if (!ws1Open && !ws2Open) {
      return;
    }

    const nativeRate = this.audioContext?.sampleRate || 48000;
    const resampled = this.resample(float32Data, nativeRate, 16000);

    const int16Array = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      let val = resampled[i] * 32768.0;
      val = Math.max(-32768, Math.min(32767, val));
      int16Array[i] = val;
    }

    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    const audioMessage = JSON.stringify({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=16000",
            data: base64,
          },
        ],
      },
    });

    if (ws1Open) this.ws1!.send(audioMessage);
    if (ws2Open) this.ws2!.send(audioMessage);
  }

  private resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate || !data || data.length === 0) return data;
    if (fromRate <= 0 || toRate <= 0 || isNaN(fromRate) || isNaN(toRate)) return new Float32Array(0);
    
    const ratio = fromRate / toRate;
    let newLength = Math.round(data.length / ratio);
    if (isNaN(newLength) || newLength < 0 || newLength === Infinity) {
      newLength = 0;
    }
    
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      if (idx >= data.length || idx < 0) {
        result[i] = data[data.length - 1] || 0;
        continue;
      }
      const fraction = pos - idx;
      const nextIdx = idx + 1 < data.length ? idx + 1 : idx;
      result[i] = data[idx] * (1 - fraction) + data[nextIdx] * fraction;
    }
    return result;
  }

  async disconnect() {
    this.onStateChange("idle");
    this.ws1Ready = false;
    this.ws2Ready = false;
    this.playbackEndTime = 0;
    this.activeChannel = null;
    this.pendingInputTranscripts.clear();
    this.onVolumeChange(0);

    if (this.ws1) {
      this.ws1.close();
      this.ws1 = null;
    }
    if (this.ws2) {
      this.ws2.close();
      this.ws2 = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.captureNode) {
      this.captureNode.disconnect();
      this.captureNode = null;
    }
    if (this.playbackNode) {
      this.playbackNode.disconnect();
      this.playbackNode = null;
    }
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {
        console.error("Error closing AudioContext:", e);
      }
      this.audioContext = null;
    }
  }
}
