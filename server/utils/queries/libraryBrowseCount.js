async function loadBrowseCount({ mode, exactCountLoader } = {}) {
  if (mode === 'skip') {
    return {
      total: null,
      isExact: false,
      isDeferred: true
    }
  }

  const total = await exactCountLoader()

  return {
    total,
    isExact: true,
    isDeferred: mode === 'deferred-exact'
  }
}

module.exports = {
  loadBrowseCount
}
