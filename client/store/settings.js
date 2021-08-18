
export const state = () => ({
  orderBy: 'title',
  orderDesc: false
})

export const getters = {

}

export const actions = {

}

export const mutations = {
  setSettings(state, settings) {
    state.orderBy = settings.orderBy
    state.orderDesc = settings.orderDesc
  }
}