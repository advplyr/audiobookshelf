const { performance } = require('perf_hooks')

function getPhaseName(markName) {
  return String(markName || '').split(':')[0]
}

function createBrowsePhaseTiming(profile, phaseName) {
  if (!profile || typeof profile.mark !== 'function' || !phaseName) {
    return null
  }

  return {
    onStart() {
      profile.mark(`${phaseName}:start`)
    },
    onFinish() {
      profile.mark(`${phaseName}:end`)
    },
    onError() {
      profile.mark(`${phaseName}:end`)
    }
  }
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
  if (!profile || typeof profile !== 'object') {
    return {
      route: null,
      libraryId: null,
      totalMs: 0,
      phases: {},
      isSlow: false
    }
  }

  const now = typeof profile.now === 'function' ? profile.now : () => performance.now()
  const startedAt = typeof profile.startedAt === 'number' ? profile.startedAt : null
  const marks = Array.isArray(profile.marks) ? profile.marks : []
  const endedAt = startedAt === null ? null : now()
  const phases = {}
  const openPhases = new Map()

  marks.forEach((mark) => {
    const phaseName = getPhaseName(mark.name)
    if (!phaseName) return

    if (String(mark.name).endsWith(':start')) {
      openPhases.set(phaseName, mark.at)
      return
    }

    if (String(mark.name).endsWith(':end') && openPhases.has(phaseName)) {
      phases[phaseName] = (phases[phaseName] || 0) + Math.round(mark.at - openPhases.get(phaseName))
      openPhases.delete(phaseName)
    }
  })

  const totalMs = endedAt === null ? 0 : Math.round(endedAt - startedAt)

  return {
    route: profile.route || null,
    libraryId: profile.libraryId || null,
    totalMs,
    phases,
    isSlow: totalMs > 0 && totalMs >= slowMs
  }
}

module.exports = {
  createBrowsePhaseTiming,
  createBrowseRequestProfile,
  finishBrowseRequestProfile
}
