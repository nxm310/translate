import { SUPPORTED_LANGUAGES, detectLanguage } from "./languages";

export class GeminiClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackNode: AudioWorkletNode | null = null;

  // Speaking state tracking
  private playbackEndTime = 0;
  private lastDetectedLang = "";

  private get isSpeaking(): boolean {
    return Date.now() < this.playbackEndTime;
  }

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
    this.lastDetectedLang = "";

    try {
      // 1. Initialize Audio (must be done immediately on user click for iOS Safari)
      await this.startAudio();

      // 2. Connect to Gemini Live API WebSocket (v1alpha endpoint)
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.setupSession();
      };
      this.ws.onmessage = async (event) => {
        try {
          const text = event.data instanceof Blob ? await event.data.text() : event.data;
          this.handleMessage(JSON.parse(text));
        } catch (err: any) {
          console.error("WebSocket Message Error:", err);
          this.onError(`Erreur message: ${err.message || err}`);
        }
      };
      this.ws.onclose = (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          this.onError(`Erreur de connexion (${event.code}): ${event.reason || "Connexion rejetée par Gemini"}`);
        }
        this.disconnect();
      };
      this.ws.onerror = () => {
        this.onError("Erreur réseau WebSocket");
      };

    } catch (e) {
      console.error(e);
      this.onError((e as Error).message);
      this.onStateChange("error");
    }
  }

  private setupSession() {
    const lang1Name = SUPPORTED_LANGUAGES.find(l => l.code === this.lang1)?.name || this.lang1;
    const lang2Name = SUPPORTED_LANGUAGES.find(l => l.code === this.lang2)?.name || this.lang2;
    
    // Configure system instruction to translate between selected languages dynamically
    const systemInstructionText = `You are a real-time voice-to-voice translator between ${lang1Name} (${this.lang1}) and ${lang2Name} (${this.lang2}).
Detect the spoken language automatically. If you hear ${lang1Name}, translate it to ${lang2Name}. If you hear ${lang2Name}, translate it to ${lang1Name}.
Respond ONLY with the direct translation of what was said. Do not add any conversational remarks, commentary, explanations, or filler. Just translate directly.`;

    const setupMessage = {
      setup: {
        model: "models/gemini-2.0-flash-exp",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede", // Aoede is a clear voice
              },
            },
          },
        },
        systemInstruction: {
          parts: [
            {
              text: systemInstructionText,
            },
          ],
        },
        input_audio_transcription: {},
        output_audio_transcription: {},
      },
    };

    console.log("Sending setup config:", setupMessage);
    this.ws?.send(JSON.stringify(setupMessage));
  }

  private handleMessage(data: any) {
    try {
      if (data.setupComplete) {
        this.onStateChange("connected");
        console.log("Session setup complete");
      } else if (data.serverContent) {
        const serverContent = data.serverContent;
        console.log("Received serverContent:", Object.keys(serverContent));

        // 1. Handle user's speech transcription (what the user said)
        const inputTx = serverContent.inputTranscription || serverContent.input_transcription;
        if (inputTx && inputTx.text) {
          const text = inputTx.text;
          const detected = detectLanguage(text, this.lang1, this.lang2);
          console.log(`Input transcription: "${text}" (detected: ${detected})`);
          this.onTranscript(text, true, detected);
        }

        // 2. Handle model's translation text (what the model generated)
        const outputTx = serverContent.outputTranscription || serverContent.output_transcription;
        if (outputTx && outputTx.text) {
          const text = outputTx.text;
          const detected = detectLanguage(text, this.lang1, this.lang2);
          this.lastDetectedLang = detected;
          console.log(`Output transcription: "${text}" (detected: ${detected})`);
          this.onTranscript(text, false, detected);
        }

        // 3. Handle model's turn (audio and streaming text)
        const modelTurn = serverContent.modelTurn;
        if (modelTurn) {
          for (const part of modelTurn.parts) {
            if (part.text) {
              const text = part.text;
              const detected = detectLanguage(text, this.lang1, this.lang2);
              this.lastDetectedLang = detected;
              console.log(`Model part text: "${text}" (detected: ${detected})`);
              this.onTranscript(text, false, detected);
            }
            if (part.inlineData && part.inlineData.data) {
              this.playAudio(part.inlineData.data);
            }
          }
        }

        // 4. Handle turn completion
        if (serverContent.turnComplete) {
          console.log("Turn complete");
          const finalLang = this.lastDetectedLang || this.lang2;
          this.onTranscript("", true, finalLang);
        }

        // 5. Handle interruption
        if (serverContent.interrupted) {
          console.log("Turn interrupted");
          this.playbackNode?.port.postMessage("interrupt");
          this.playbackEndTime = 0;
        }
      }
    } catch (err: any) {
      console.error("handleMessage error:", err);
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

      this.playbackNode = new AudioWorkletNode(this.audioContext, "pcm-processor");
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

    const wsOpen = this.ws && this.ws.readyState === WebSocket.OPEN;
    if (!wsOpen) {
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

    this.ws!.send(audioMessage);
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

  disconnect() {
    this.onStateChange("idle");
    this.playbackEndTime = 0;
    this.lastDetectedLang = "";
    this.onVolumeChange(0);

    if (this.ws) {
      this.ws.close();
      this.ws = null;
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
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
