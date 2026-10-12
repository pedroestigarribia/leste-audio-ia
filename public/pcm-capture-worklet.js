class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = [];
    this.position = 0;
    this.step = sampleRate / 16000;
    this.output = [];
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels || !channels.length) return true;
    const left = channels[0];
    const right = channels[1];
    for (let i = 0; i < left.length; i += 1) {
      const value = right ? (left[i] + right[i]) / 2 : left[i];
      this.pending.push(value);
    }

    const samples = [];
    while (this.position + 1 < this.pending.length) {
      const index = Math.floor(this.position);
      const fraction = this.position - index;
      const value = this.pending[index] * (1 - fraction) + this.pending[index + 1] * fraction;
      samples.push(Math.max(-1, Math.min(1, value)));
      this.position += this.step;
    }
    const consumed = Math.floor(this.position);
    if (consumed) {
      this.pending.splice(0, consumed);
      this.position -= consumed;
    }
    this.output.push(...samples);
    if (this.output.length >= 1600) {
      const chunk = new Float32Array(this.output.splice(0, 1600));
      this.port.postMessage(chunk.buffer, [chunk.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
