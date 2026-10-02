import LocalAudioPlayer from '../../../players/LocalAudioPlayer'

function createToneSilenceToneBuffer(audioContext) {
  const sampleRate = audioContext.sampleRate
  const durationSeconds = 1.2
  const buffer = audioContext.createBuffer(1, sampleRate * durationSeconds, sampleRate)
  const channel = buffer.getChannelData(0)

  for (let i = 0; i < channel.length; i++) {
    const seconds = i / sampleRate
    const isTone = seconds < 0.3 || seconds >= 0.9
    channel[i] = isTone ? Math.sin(2 * Math.PI * 440 * seconds) * 0.25 : 0
  }

  return buffer
}

describe('Smart Speed E2E with real Web Audio', () => {
  it('detects silence from real generated audio with the real AudioWorklet', () => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    expect(AudioContextCtor).to.exist

    const audioContext = new AudioContextCtor()
    const messages = []

    cy.wrap(audioContext.audioWorklet.addModule('/smart-speed/SilenceDetectorProcessor.js')).then(() => {
      const detectorNode = new AudioWorkletNode(audioContext, 'silence-detector')
      detectorNode.port.onmessage = (event) => messages.push(event.data)

      const source = audioContext.createBufferSource()
      source.buffer = createToneSilenceToneBuffer(audioContext)
      source.connect(detectorNode)
      detectorNode.connect(audioContext.destination)

      return audioContext.resume().then(() => {
        source.start()
        return new Promise((resolve) => {
          source.onended = resolve
        })
      }).then(() => {
        detectorNode.disconnect()
        return audioContext.close()
      })
    }).then(() => {
      const silenceStart = messages.find((message) => message.type === 'silence-start')
      const silenceEnd = messages.find((message) => message.type === 'silence-end')

      expect(silenceStart).to.exist
      expect(silenceEnd).to.exist
      expect(silenceStart.time).to.be.within(250, 450)
      expect(silenceEnd.time).to.be.within(850, 1050)
    })
  })

  it('compresses silence in LocalAudioPlayer through the real worklet node', () => {
    const localPlayer = new LocalAudioPlayer({})
    localPlayer.smartSpeedRatio = 2.5
    localPlayer.enableSmartSpeed = true

    cy.wrap(localPlayer.setSmartSpeed(true)).then(() => {
      expect(localPlayer.usingWebAudio).to.equal(true)
      expect(localPlayer.audioContext).to.not.be.null
      expect(localPlayer.audioSourceNode).to.not.be.null
      expect(localPlayer.silenceDetectorNode).to.not.be.null
      expect(localPlayer.silenceDetectorNode.constructor.name).to.equal('AudioWorkletNode')

      localPlayer.player.currentTime = 1.0
      localPlayer.silenceDetectorNode.port.onmessage({
        data: {
          type: 'silence-start',
          time: localPlayer.audioContext.currentTime * 1000
        }
      })
      expect(localPlayer.player.playbackRate).to.equal(2.5)

      localPlayer.player.currentTime = 3.0
      localPlayer.silenceDetectorNode.port.onmessage({
        data: {
          type: 'silence-end',
          time: localPlayer.audioContext.currentTime * 1000
        }
      })
      expect(localPlayer.player.playbackRate).to.equal(1.0)

      const regions = localPlayer.silenceMap.getRegions()
      expect(regions).to.have.lengthOf(1)
      expect(localPlayer.timeMapper.totalTimeSaved()).to.be.greaterThan(0)

      localPlayer.destroy()
    })
  })
})
