/**
 * Audio Playback Worklet Processor for playing PCM audio.
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioQueue = [];
    this.currentOffset = 0;
    this.isPlaying = false;

    this.port.onmessage = (event) => {
      if (event.data === "interrupt") {
        this.audioQueue = [];
        this.currentOffset = 0;
        this.updatePlaybackState(false);
      } else if (event.data && (event.data instanceof Float32Array || event.data.constructor?.name === "Float32Array" || event.data.byteLength !== undefined)) {
        // Handle cross-realm Float32Arrays safely by casting/wrapping if necessary, though pushing directly is fine
        this.audioQueue.push(event.data);
        this.updatePlaybackState(true);
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
    if (output.length === 0) return true;

    const numChannels = output.length;
    const bufferSize = output[0].length;
    let outputIndex = 0;

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
    this.updatePlaybackState(currentlyPlaying);

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
