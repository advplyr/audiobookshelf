function getMediaProgressState(mediaProgress) {
  if (!mediaProgress || mediaProgress.isFinished) {
    return mediaProgress?.isFinished ? 'finished' : 'not-started'
  }

  if ((mediaProgress.currentTime || 0) > 0 || (mediaProgress.ebookProgress || 0) > 0) {
    return 'in-progress'
  }

  return 'not-started'
}

function getMediaProgressKey(mediaProgress) {
  return `${mediaProgress.libraryItemId || ''}:${mediaProgress.episodeId || ''}`
}

function mediaProgressStatesChanged(currentMediaProgress = [], updatedMediaProgress = []) {
  if (!Array.isArray(currentMediaProgress)) currentMediaProgress = []
  if (!Array.isArray(updatedMediaProgress)) updatedMediaProgress = []
  const currentStates = new Map(currentMediaProgress.map((mediaProgress) => [getMediaProgressKey(mediaProgress), getMediaProgressState(mediaProgress)]))
  const updatedStates = new Map(updatedMediaProgress.map((mediaProgress) => [getMediaProgressKey(mediaProgress), getMediaProgressState(mediaProgress)]))
  const allKeys = new Set([...currentStates.keys(), ...updatedStates.keys()])

  for (const key of allKeys) {
    if ((currentStates.get(key) || 'not-started') !== (updatedStates.get(key) || 'not-started')) return true
  }
  return false
}

module.exports = {
  getMediaProgressState,
  mediaProgressStatesChanged
}
