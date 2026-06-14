import { SUPPORTED_LANGUAGES, detectLanguage } from "./languages";

export class GeminiClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackNode: AudioWorkletNode | null = null;

  // Speaking state: true when the app is playing translated audio
  private isSpeaking = false;

  // Track currently active model to support fallback
  private modelToUse = "models/gemini-2.0-flash";
  private isRetrying = false;

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
    if (!this.isRetrying) {
      this.onStateChange("connecting");
      this.modelToUse = "models/gemini-2.0-flash"; // Reset to default on fresh user click
    }
    this.isRetrying = false;

    try {
      // 1. Initialize Audio (must be done immediately on user click for iOS Safari)
      if (!this.audioContext) {
        await this.startAudio();
      }

      // 2. Connect WebSocket
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setupSession();
      };

      this.ws.onmessage = async (event) => {
        const text = event.data instanceof Blob ? await event.data.text() : event.data;
        this.handleMessage(JSON.parse(text));
      };

      this.ws.onclose = (event) => {
        console.warn("WebSocket closed", event.code, event.reason);
        
        // Automatic fallback logic if the stable model is not supported (code 1008)
        if (event.code === 1008 && this.modelToUse === "models/gemini-2.0-flash") {
          console.log("Switching to models/gemini-2.0-flash-exp fallback...");
          this.modelToUse = "models/gemini-2.0-flash-exp";
          this.isRetrying = true;
          this.ws = null;
          this.connect();
          return;
        }

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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const name1 = SUPPORTED_LANGUAGES.find(l => l.code === this.lang1)?.name || this.lang1;
    const name2 = SUPPORTED_LANGUAGES.find(l => l.code === this.lang2)?.name || this.lang2;

    const systemInstructionText = `You are a strict, real-time, bidirectional audio translator translating conversations between ${name1} and ${name2}.
CRITICAL RULES:
1. If you hear speech in ${name1}, you MUST translate it directly into ${name2}.
2. If you hear speech in ${name2}, you MUST translate it directly into ${name1}.
3. Do not answer any questions, do not add commentary, do not chat, and do not say anything other than the direct translation.
4. Output ONLY the translated audio. Keep your translation immediate and accurate.`;

    const setupMessage = {
      setup: {
        model: this.modelToUse,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede", // standard voice
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: systemInstructionText }],
        },
        input_audio_transcription: {},
        realtimeInputConfig: {
          activityHandling: "NO_INTERRUPTION",
        },
      },
    };
    this.ws.send(JSON.stringify(setupMessage));
  }

  private handleMessage(data: any) {
    if (data.setupComplete) {
      this.onStateChange("connected");
    } else if (data.serverContent) {
      // 1. Accumulate input transcription (what the user said in the source language)
      const inputTx = data.serverContent.inputTranscription || data.serverContent.input_transcription;
      if (inputTx && inputTx.text) {
        const detectedLang = detectLanguage(inputTx.text, this.lang1, this.lang2);
        this.onTranscript(inputTx.text, true, detectedLang);
      }

      // 2. Accumulate modelTurn parts (audio and translation text)
      const modelTurn = data.serverContent.modelTurn;
      if (modelTurn) {
        for (const part of modelTurn.parts) {
          if (part.text) {
            const detectedLang = detectLanguage(part.text, this.lang1, this.lang2);
            this.onTranscript(part.text, true, detectedLang);
          }
          if (part.inlineData && part.inlineData.data) {
            this.playAudio(part.inlineData.data);
          }
        }
      }

      if (data.serverContent.interrupted) {
        this.playbackNode?.port.postMessage("interrupt");
        this.isSpeaking = false;
      }
    }
  }

  private async startAudio() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // Gemini outputs at 24kHz, so we run the context at 24kHz
      });

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Get basePath for GitHub Pages (/translate/) or empty for local
      const basePath = window.location.pathname.startsWith('/translate') ? '/translate' : '';

      await this.audioContext.audioWorklet.addModule(`${basePath}/capture.worklet.js`);
      await this.audioContext.audioWorklet.addModule(`${basePath}/playback.worklet.js`);

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.captureNode = new AudioWorkletNode(this.audioContext, "audio-capture-processor");

      this.captureNode.port.onmessage = (e) => {
        if (e.data.type === "audio") {
          const rawData = e.data.data;
          this.sendAudio(rawData);

          // Calculate RMS volume
          let sum = 0;
          for (let i = 0; i < rawData.length; i++) {
            sum += rawData[i] * rawData[i];
          }
          const rms = Math.sqrt(sum / rawData.length);
          const volume = this.isSpeaking ? 0 : Math.min(100, Math.round(rms * 250));
          this.onVolumeChange(volume);
        }
      };

      source.connect(this.captureNode);

      this.playbackNode = new AudioWorkletNode(this.audioContext, "pcm-processor");
      this.playbackNode.connect(this.audioContext.destination);

      this.playbackNode.port.onmessage = (e) => {
        if (e.data && e.data.type === "state") {
          this.isSpeaking = e.data.isPlaying;
        }
      };

    } catch (e) {
      console.error("Audio error", e);
      throw new Error("Veuillez autoriser l'accès au microphone dans les réglages de votre navigateur.");
    }
  }

  private playAudio(base64Data: string) {
    if (!this.playbackNode) return;
    this.isSpeaking = true;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    // PCM 16-bit to Float32
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    this.playbackNode.port.postMessage(float32Array);
  }

  private sendAudio(float32Data: Float32Array) {
    if (this.isSpeaking) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Downsample from 24000Hz to 16000Hz (keep 2 out of 3 samples)
    const downsampledLength = Math.floor(float32Data.length * 2 / 3);
    const downsampled = new Float32Array(downsampledLength);
    let outIdx = 0;
    for (let i = 0; i < float32Data.length; i += 3) {
      if (outIdx < downsampledLength) downsampled[outIdx++] = float32Data[i];
      if (i + 1 < float32Data.length && outIdx < downsampledLength) downsampled[outIdx++] = float32Data[i + 1];
    }

    // Float32 to PCM 16-bit
    const int16Array = new Int16Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) {
      let val = downsampled[i] * 32768.0;
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

    this.ws.send(audioMessage);
  }

  disconnect() {
    this.onStateChange("idle");
    this.isSpeaking = false;
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
