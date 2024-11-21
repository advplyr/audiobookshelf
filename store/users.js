
export const state = () => ({
  usersOnline: []
})

export const getters = {
  getIsUserOnline: state => id => {
    return state.usersOnline.find(u => u.id === id)
  }
}

export const actions = {

}

export const mutations = {
  setUsersOnline(state, usersOnline) {
    state.usersOnline = usersOnline
  },
  updateUserOnline(state, user) {
    var index = state.usersOnline.findIndex(u => u.id === user.id)
    if (index >= 0) {
      state.usersOnline.splice(index, 1, user)
    } else {
      state.usersOnline.push(user)
    }
  },
  removeUserOnline(state, user) {
    state.usersOnline = state.usersOnline.filter(u => u.id !== user.id)
  }
}