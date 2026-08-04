const SPEAKING = 0
const SILENCE = 1
const CANDIDATE = 2

const DEBOUNCE_MS = 200
const RMS_REPORT_INTERVAL = 10

class SilenceDetectorProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.state = SPEAKING
    this.silenceThreshold = -40
    this.candidateStartSample = 0
    this.sampleRate = sampleRate
    this.blockCount = 0

    this.port.onmessage = (event) => {
      const msg = event.data
      if (msg.type === 'reset') {
        this.state = SPEAKING
        this.candidateStartSample = 0
        return
      }
      if (msg.type === 'set-threshold') {
        this.silenceThreshold = msg.value
      }
    }
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input.length) return true

    const channel = input[0]
    if (!channel) return true

    let sum = 0
    for (let i = 0; i < channel.length; i++) {
      sum += channel[i] * channel[i]
    }
    const rms = Math.sqrt(sum / channel.length)
    const dbfs = rms === 0 ? -Infinity : 20 * Math.log10(rms)

    this.blockCount++

    if (dbfs < this.silenceThreshold) {
      if (this.state === SPEAKING) {
        this.candidateStartSample = currentFrame
        this.state = CANDIDATE
      } else if (this.state === CANDIDATE) {
        const elapsedMs = ((currentFrame - this.candidateStartSample) / this.sampleRate) * 1000
        if (elapsedMs >= DEBOUNCE_MS) {
          this.state = SILENCE
          const silenceStartTime = (this.candidateStartSample / this.sampleRate) * 1000
          this.port.postMessage({ type: 'silence-start', time: silenceStartTime })
        }
      }
    } else {
      if (this.state === SILENCE) {
        const currentTime = (currentFrame / this.sampleRate) * 1000
        this.port.postMessage({ type: 'silence-end', time: currentTime })
      }
      if (this.state !== SPEAKING) {
        this.state = SPEAKING
      }
    }

    if (this.blockCount % RMS_REPORT_INTERVAL === 0) {
      this.port.postMessage({ type: 'rms', value: dbfs })
    }

    return true
  }
}

registerProcessor('silence-detector', SilenceDetectorProcessor)
