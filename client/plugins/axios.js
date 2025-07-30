export default function ({ $axios, store, $root, app }) {
  // Track if we're currently refreshing to prevent multiple refresh attempts
  let isRefreshing = false
  let failedQueue = []

  const processQueue = (error, token = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error)
      } else {
        resolve(token)
      }
    })
    failedQueue = []
  }

  $axios.onRequest((config) => {
    if (!config.url) {
      console.error('Axios request invalid config', config)
      return
    }
    if (config.url.startsWith('http:') || config.url.startsWith('https:')) {
      return
    }
    const bearerToken = store.getters['user/getToken']
    if (bearerToken) {
      config.headers.common['Authorization'] = `Bearer ${bearerToken}`
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Making request to ' + config.url)
    }
  })

  $axios.onError(async (error) => {
    const originalRequest = error.config
    const code = parseInt(error.response && error.response.status)
    const message = error.response ? error.response.data || 'Unknown Error' : 'Unknown Error'

    console.error('Axios error', code, message)

    // Handle 401 Unauthorized (token expired)
    if (code === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints to prevent infinite loops
      if (originalRequest.url === '/auth/refresh' || originalRequest.url === '/login') {
        // Refresh failed or login failed, redirect to login
        store.commit('user/setUser', null)
        store.commit('user/setAccessToken', null)
        app.router.push('/login')
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (!originalRequest.headers) {
              originalRequest.headers = {}
            }
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            return $axios(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Attempt to refresh the token
        // Updates store if successful, otherwise clears store and throw error
        const newAccessToken = await store.dispatch('user/refreshToken')
        if (!newAccessToken) {
          console.error('No new access token received')
          return Promise.reject(error)
        }

        // Update the original request with new token
        if (!originalRequest.headers) {
          originalRequest.headers = {}
        }
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`

        // Process any queued requests
        processQueue(null, newAccessToken)

        // Retry the original request
        return $axios(originalRequest)
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)

        // Process queued requests with error
        processQueue(refreshError, null)

        // Redirect to login
        app.router.push('/login')

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  })
}
