
export const state = () => ({
  users: []
})

export const getters = {

}

export const actions = {

}

export const mutations = {
  updateUser(state, user) {
    var index = state.users.findIndex(u => u.id === user.id)
    if (index >= 0) {
      state.users.splice(index, 1, user)
    } else {
      state.users.push(user)
    }
  },
  removeUser(state, user) {
    state.users = state.users.filter(u => u.id !== user.id)
  }
}