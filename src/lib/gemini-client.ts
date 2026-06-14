export class GeminiClient {
  private ws1: WebSocket | null = null;
  private ws2: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackNode: AudioWorkletNode | null = null;

  private ws1Ready = false;
  private ws2Ready = false;

  // Speaking state: true when the app is playing translated audio
  private isSpeaking = false;

  public onStateChange: (state: "idle" | "connecting" | "connected" | "error") => void = () => {};
  public onTranscript: (text: string, isFinal: boolean, targetLang: string) => void = () => {};
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

    try {
      // 1. Initialize Audio (must be done immediately on user click for iOS Safari)
      await this.startAudio();

      // 2. Connect two WebSockets — one per translation direction
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

      // WS1: translates INTO lang1 (e.g. when someone speaks lang2, output is lang1)
      this.ws1 = new WebSocket(url);
      this.ws1.onopen = () => this.setupSession(this.ws1, this.lang1, "Aoede");
      this.ws1.onmessage = async (event) => {
        const text = event.data instanceof Blob ? await event.data.text() : event.data;
        this.handleMessage(JSON.parse(text), this.lang1);
      };
      this.ws1.onclose = (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          this.onError(`Erreur de connexion (${event.code}): ${event.reason || "Connexion rejetée par Gemini"}`);
        }
        this.disconnect();
      };
      this.ws1.onerror = () => this.onError("Erreur réseau WebSocket");

      // WS2: translates INTO lang2 (e.g. when someone speaks lang1, output is lang2)
      this.ws2 = new WebSocket(url);
      this.ws2.onopen = () => this.setupSession(this.ws2, this.lang2, "Puck");
      this.ws2.onmessage = async (event) => {
        const text = event.data instanceof Blob ? await event.data.text() : event.data;
        this.handleMessage(JSON.parse(text), this.lang2);
      };
      this.ws2.onclose = (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          this.onError(`Erreur de connexion (${event.code}): ${event.reason || "Connexion rejetée par Gemini"}`);
        }
        this.disconnect();
      };
      this.ws2.onerror = () => this.onError("Erreur réseau WebSocket");

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
        realtimeInputConfig: {
          activityHandling: "NO_INTERRUPTION",
        },
      },
    };
    ws?.send(JSON.stringify(setupMessage));
  }

  private handleMessage(data: any, targetLang: string) {
    if (data.setupComplete) {
      if (targetLang === this.lang1) this.ws1Ready = true;
      if (targetLang === this.lang2) this.ws2Ready = true;

      if (this.ws1Ready && this.ws2Ready) {
        this.onStateChange("connected");
      }
    } else if (data.serverContent) {
      const modelTurn = data.serverContent.modelTurn;
      if (modelTurn) {
        for (const part of modelTurn.parts) {
          if (part.text) {
            this.onTranscript(part.text, true, targetLang);
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
          this.sendAudio(e.data.data);
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

    const ws1Open = this.ws1 && this.ws1.readyState === WebSocket.OPEN;
    const ws2Open = this.ws2 && this.ws2.readyState === WebSocket.OPEN;
    if (!ws1Open && !ws2Open) return;

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

    // Send same audio to both connections
    if (ws1Open) this.ws1!.send(audioMessage);
    if (ws2Open) this.ws2!.send(audioMessage);
  }

  disconnect() {
    this.onStateChange("idle");
    this.ws1Ready = false;
    this.ws2Ready = false;
    this.isSpeaking = false;

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
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
