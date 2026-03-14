const { performance } = require('perf_hooks')

function getPhaseName(markName) {
  return String(markName || '').split(':')[0]
}

function createBrowseRequestProfile(context = {}) {
  const now = typeof context.now === 'function' ? context.now : () => performance.now()
  const marks = []

  return {
    route: context.route || null,
    libraryId: context.libraryId || null,
    now,
    startedAt: now(),
    marks,
    mark(name) {
      marks.push({ name, at: now() })
    }
  }
}

function finishBrowseRequestProfile(profile, { slowMs = 1000 } = {}) {
  const endedAt = profile.now()
  const phases = {}
  const openPhases = new Map()

  profile.marks.forEach((mark) => {
    const phaseName = getPhaseName(mark.name)
    if (!phaseName) return

    if (String(mark.name).endsWith(':start')) {
      openPhases.set(phaseName, mark.at)
      return
    }

    if (String(mark.name).endsWith(':end') && openPhases.has(phaseName)) {
      phases[phaseName] = Math.round(mark.at - openPhases.get(phaseName))
      openPhases.delete(phaseName)
    }
  })

  const totalMs = Math.round(endedAt - profile.startedAt)

  return {
    route: profile.route || null,
    libraryId: profile.libraryId || null,
    totalMs,
    phases,
    isSlow: totalMs >= slowMs
  }
}

module.exports = {
  createBrowseRequestProfile,
  finishBrowseRequestProfile
}
