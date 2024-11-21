export default function ({ $axios, store, $config }) {
  $axios.onRequest((config) => {
    if (!config.url) {
      console.error('Axios request invalid config', config)
      return
    }
    if (config.url.startsWith('http:') || config.url.startsWith('https:')) {
      return
    }
    const bearerToken = store.state.user.user?.token || null
    if (bearerToken) {
      config.headers.common['Authorization'] = `Bearer ${bearerToken}`
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Making request to ' + config.url)
    }
  })

  $axios.onError((error) => {
    const code = parseInt(error.response && error.response.status)
    const message = error.response ? error.response.data || 'Unknown Error' : 'Unknown Error'
    console.error('Axios error', code, message)
  })
}
