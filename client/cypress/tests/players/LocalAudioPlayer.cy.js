import LocalAudioPlayer from '../../../players/LocalAudioPlayer'

describe('LocalAudioPlayer', () => {
  it('increases playbackRate during silence with the real Web Audio pipeline', () => {
    const localPlayer = new LocalAudioPlayer({})

    expect(localPlayer.player.playbackRate).to.equal(1)

    cy.wrap(localPlayer.setSmartSpeed(true)).then(() => {
      expect(localPlayer.enableSmartSpeed).to.be.true
      expect(localPlayer.usingWebAudio).to.be.true
      expect(localPlayer.audioContext).to.not.be.null
      expect(localPlayer.audioSourceNode).to.not.be.null
      expect(localPlayer.silenceDetectorNode).to.not.be.null
      expect(localPlayer.silenceDetectorNode.constructor.name).to.equal('AudioWorkletNode')

      localPlayer.player.currentTime = 5
      localPlayer.silenceDetectorNode.port.onmessage({
        data: {
          type: 'silence-start',
          time: localPlayer.audioContext.currentTime * 1000
        }
      })

      expect(localPlayer.player.playbackRate).to.equal(2.0)

      localPlayer.player.currentTime = 8
      localPlayer.silenceDetectorNode.port.onmessage({
        data: {
          type: 'silence-end',
          time: localPlayer.audioContext.currentTime * 1000
        }
      })

      expect(localPlayer.player.playbackRate).to.equal(1.0)

      localPlayer.destroy()
    })
  })

  it('maps currentTime, duration, and seek through the same Smart Speed wall-clock contract', () => {
    const localPlayer = new LocalAudioPlayer({});

    localPlayer.audioTracks = [{ startOffset: 0, duration: 12 }];
    localPlayer.currentTrackIndex = 0;
    localPlayer.enableSmartSpeed = true;
    localPlayer.smartSpeedRatio = 2.0;
    localPlayer.silenceMap.addRegion(2000, 6000);
    localPlayer.updateSmartSpeedRegions();

    localPlayer.player.currentTime = 8;

    expect(localPlayer.getCurrentTime()).to.equal(6);
    expect(localPlayer.getDuration()).to.equal(10);

    localPlayer.seek(6, false);
    expect(localPlayer.player.currentTime).to.equal(8);
  });
});
