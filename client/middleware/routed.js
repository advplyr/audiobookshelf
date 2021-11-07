export default function (context) {
  if (process.client) {
    var route = context.route
    var from = context.from
    var store = context.store

    if (route.name === 'login' || from.name === 'login') return

    if (!route.name) {
      console.warn('No Route name', route)
      return
    }

    if (route.name.startsWith('config') || route.name === 'upload' || route.name === 'account' || route.name.startsWith('audiobook-id') || route.name.startsWith('collection-id')) {
      if (from.name !== route.name && from.name !== 'audiobook-id-edit' && from.name !== 'collection-id' && !from.name.startsWith('config') && from.name !== 'upload' && from.name !== 'account') {
        var _history = [...store.state.routeHistory]
        if (!_history.length || _history[_history.length - 1] !== from.fullPath) {
          _history.push(from.fullPath)
          store.commit('setRouteHistory', _history)
        }
      }
    }
  }
}
