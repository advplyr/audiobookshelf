export default function ({ $axios, store }) {
  $axios.onRequest(config => {
    if (config.url.startsWith('http:') || config.url.startsWith('https:')) {
      return
    }
    var bearerToken = store.state.user.user ? store.state.user.user.token : null
    if (bearerToken) {
      config.headers.common['Authorization'] = `Bearer ${bearerToken}`
    }

    if (process.env.NODE_ENV === 'development') {
      config.url = `/dev${config.url}`
      console.log('Making request to ' + config.url)
    }
  })

  $axios.onError(error => {
    const code = parseInt(error.response && error.response.status)
    console.error('Axios error code', code)
  })
}