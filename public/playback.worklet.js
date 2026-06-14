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
      } else if (event.data instanceof Float32Array) {
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

    const channel = output[0];
    let outputIndex = 0;

    while (outputIndex < channel.length && this.audioQueue.length > 0) {
      const currentBuffer = this.audioQueue[0];

      if (!currentBuffer || currentBuffer.length === 0) {
        this.audioQueue.shift();
        this.currentOffset = 0;
        continue;
      }

      const remainingOutput = channel.length - outputIndex;
      const remainingBuffer = currentBuffer.length - this.currentOffset;
      const copyLength = Math.min(remainingOutput, remainingBuffer);

      for (let i = 0; i < copyLength; i++) {
        channel[outputIndex++] = currentBuffer[this.currentOffset++];
      }

      if (this.currentOffset >= currentBuffer.length) {
        this.audioQueue.shift();
        this.currentOffset = 0;
      }
    }

    while (outputIndex < channel.length) {
      channel[outputIndex++] = 0;
    }

    const currentlyPlaying = this.audioQueue.length > 0;
    this.updatePlaybackState(currentlyPlaying);

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
