export default function ({ $axios, store }) {
  $axios.onRequest(config => {
    console.log('Making request to ' + config.url)
    var bearerToken = store.state.user ? store.state.user.token : null
    // console.log('Bearer token', bearerToken)
    if (bearerToken) {
      config.headers.common['Authorization'] = `Bearer ${bearerToken}`
    }

    if (process.env.NODE_ENV === 'development') {
      config.url = `/dev${config.url}`
    }
  })

  $axios.onError(error => {
    const code = parseInt(error.response && error.response.status)
    console.error('Axios error code', code)
  })
}