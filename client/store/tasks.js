
export const state = () => ({
  tasks: []
})

export const getters = {
  getTaskByLibraryItemId: (state) => (libraryItemId) => {
    return state.tasks.find(t => t.data && t.data.libraryItemId === libraryItemId)
  }
}

export const actions = {

}

export const mutations = {
  setTasks(state, tasks) {
    state.tasks = tasks
  },
  addUpdateTask(state, task) {
    var index = state.tasks.findIndex(d => d.id === task.id)
    if (index >= 0) {
      state.tasks.splice(index, 1, task)
    } else {
      state.tasks.push(task)
    }
  },
  removeTask(state, task) {
    state.tasks = state.tasks.filter(d => d.id !== task.id)
  }
}