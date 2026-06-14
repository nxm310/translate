/**
 * Audio Playback Worklet Processor for playing PCM audio.
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioQueue = [];
    this.currentOffset = 0;
    this.isPlaying = false;
    this.loggedEmptyOutput = false;
    this.isPlayingAudioLog = false;

    this.port.onmessage = (event) => {
      if (event.data === "interrupt") {
        this.audioQueue = [];
        this.currentOffset = 0;
        this.updatePlaybackState(false);
        this.port.postMessage({ type: "log", message: "Playback interrupted" });
      } else if (event.data) {
        const isF32 = event.data instanceof Float32Array;
        const constrName = event.data.constructor?.name;
        const len = event.data.length;

        let samples = event.data;
        // If we transferred the buffer, it might show up as a Float32Array or ArrayBuffer.
        // Let's make sure it is a Float32Array.
        if (event.data.buffer && !isF32 && constrName !== "Float32Array") {
          try {
            samples = new Float32Array(event.data.buffer, event.data.byteOffset || 0, len);
          } catch (e) {
            this.port.postMessage({ type: "log", message: `Casting to Float32Array failed: ${e.message}` });
          }
        } else if (event.data instanceof ArrayBuffer || constrName === "ArrayBuffer") {
          try {
            samples = new Float32Array(event.data);
          } catch (e) {
            this.port.postMessage({ type: "log", message: `Wrapping ArrayBuffer failed: ${e.message}` });
          }
        }

        if (samples && samples.length > 0) {
          this.audioQueue.push(samples);
          this.updatePlaybackState(true);
        }
      }
    };
  }

  updatePlaybackState(isPlaying) {
    if (this.isPlaying !== isPlaying) {
      this.isPlaying = isPlaying;
      this.port.postMessage({ type: "state", isPlaying });
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) {
      if (!this.loggedEmptyOutput) {
        this.port.postMessage({ type: "log", message: `process: outputs[0] is empty or undefined! outputs.length=${outputs.length}` });
        this.loggedEmptyOutput = true;
      }
      return true;
    }

    const numChannels = output.length;
    const bufferSize = output[0].length;
    let outputIndex = 0;

    if (this.audioQueue.length > 0 && !this.isPlayingAudioLog) {
      this.port.postMessage({ type: "log", message: `process: Starting playback of ${this.audioQueue.length} buffers. channels=${numChannels}, bufferSize=${bufferSize}` });
      this.isPlayingAudioLog = true;
    }

    while (outputIndex < bufferSize && this.audioQueue.length > 0) {
      const currentBuffer = this.audioQueue[0];

      if (!currentBuffer || currentBuffer.length === 0) {
        this.audioQueue.shift();
        this.currentOffset = 0;
        continue;
      }

      const remainingOutput = bufferSize - outputIndex;
      const remainingBuffer = currentBuffer.length - this.currentOffset;
      const copyLength = Math.min(remainingOutput, remainingBuffer);

      for (let i = 0; i < copyLength; i++) {
        const sample = currentBuffer[this.currentOffset++];
        for (let c = 0; c < numChannels; c++) {
          output[c][outputIndex + i] = sample;
        }
      }
      outputIndex += copyLength;

      if (this.currentOffset >= currentBuffer.length) {
        this.audioQueue.shift();
        this.currentOffset = 0;
      }
    }

    while (outputIndex < bufferSize) {
      for (let c = 0; c < numChannels; c++) {
        output[c][outputIndex] = 0;
      }
      outputIndex++;
    }

    const currentlyPlaying = this.audioQueue.length > 0;
    if (!currentlyPlaying && this.isPlayingAudioLog) {
      this.port.postMessage({ type: "log", message: "process: Audio queue empty, playback finished." });
      this.isPlayingAudioLog = false;
    }
    this.updatePlaybackState(currentlyPlaying);

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
