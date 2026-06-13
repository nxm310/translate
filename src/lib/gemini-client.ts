export class GeminiClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackNode: AudioWorkletNode | null = null;
  
  public onStateChange: (state: "idle" | "connecting" | "connected" | "error") => void = () => {};
  public onTranscript: (text: string, isFinal: boolean) => void = () => {};
  public onError: (error: string) => void = () => {};

  constructor(private apiKey: string, private systemInstruction: string) {}

  async connect() {
    this.onStateChange("connecting");
    try {
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setupSession();
      };

      this.ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          const text = await event.data.text();
          this.handleMessage(JSON.parse(text));
        } else if (typeof event.data === "string") {
          this.handleMessage(JSON.parse(event.data));
        }
      };

      this.ws.onclose = () => {
        this.disconnect();
      };

      this.ws.onerror = (err) => {
        console.error("WebSocket error", err);
        this.onError("Connection error");
        this.disconnect();
      };

    } catch (e) {
      console.error(e);
      this.onError((e as Error).message);
      this.onStateChange("error");
    }
  }

  private setupSession() {
    const setupMessage = {
      setup: {
        model: "models/gemini-2.0-flash-exp",
        systemInstruction: {
          parts: [{ text: this.systemInstruction }],
        },
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede",
              },
            },
          },
        },
      },
    };
    this.ws?.send(JSON.stringify(setupMessage));
  }

  private handleMessage(data: any) {
    if (data.setupComplete) {
      this.onStateChange("connected");
      this.startAudio();
    } else if (data.serverContent) {
      const modelTurn = data.serverContent.modelTurn;
      if (modelTurn) {
        for (const part of modelTurn.parts) {
          if (part.text) {
            this.onTranscript(part.text, true);
          }
          if (part.inlineData && part.inlineData.data) {
            this.playAudio(part.inlineData.data);
          }
        }
      }
      if (data.serverContent.interrupted) {
        this.playbackNode?.port.postMessage("interrupt");
      }
    }
  }

  private async startAudio() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Gemini expects 16kHz
      });

      await this.audioContext.audioWorklet.addModule("/capture.worklet.js");
      await this.audioContext.audioWorklet.addModule("/playback.worklet.js");

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

    } catch (e) {
      console.error("Audio error", e);
      this.onError("Could not access microphone");
    }
  }

  private playAudio(base64Data: string) {
    if (!this.playbackNode) return;
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    // Float32 to PCM 16-bit
    const int16Array = new Int16Array(float32Data.length);
    for (let i = 0; i < float32Data.length; i++) {
      let val = float32Data[i] * 32768.0;
      val = Math.max(-32768, Math.min(32767, val));
      int16Array[i] = val;
    }

    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm;rate=16000",
              data: base64,
            },
          ],
        },
      })
    );
  }

  disconnect() {
    this.onStateChange("idle");
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
