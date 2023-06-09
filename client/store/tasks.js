
export const state = () => ({
  tasks: [],
  queuedEmbedLIds: []
})

export const getters = {
  getTasksByLibraryItemId: (state) => (libraryItemId) => {
    return state.tasks.filter(t => t.data && t.data.libraryItemId === libraryItemId)
  }
}

export const actions = {

}

export const mutations = {
  setTasks(state, tasks) {
    state.tasks = tasks
  },
  addUpdateTask(state, task) {
    const index = state.tasks.findIndex(d => d.id === task.id)
    if (index >= 0) {
      state.tasks.splice(index, 1, task)
    } else {
      // Remove duplicate (only have one library item per action)
      state.tasks = state.tasks.filter(_task => {
        if (!_task.data?.libraryItemId || _task.action !== task.action) return true
        return _task.data.libraryItemId !== task.data.libraryItemId
      })

      state.tasks.push(task)
    }
  },
  removeTask(state, task) {
    state.tasks = state.tasks.filter(d => d.id !== task.id)
  },
  setQueuedEmbedLIds(state, libraryItemIds) {
    state.queuedEmbedLIds = libraryItemIds
  },
  addQueuedEmbedLId(state, libraryItemId) {
    if (!state.queuedEmbedLIds.some(lid => lid === libraryItemId)) {
      state.queuedEmbedLIds.push(libraryItemId)
    }
  },
  removeQueuedEmbedLId(state, libraryItemId) {
    state.queuedEmbedLIds = state.queuedEmbedLIds.filter(lid => lid !== libraryItemId)
  }
}