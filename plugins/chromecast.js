export default (ctx) => {
  var sendInit = async (castContext) => {
    // Fetch background covers for chromecast (temp)
    var covers = await ctx.$axios.$get(`/api/libraries/${ctx.$store.state.libraries.currentLibraryId}/items?limit=40&minified=1`).then((data) => {
      return data.results.filter((b) => b.media.coverPath).map((libraryItem) => {
        var coverUrl = ctx.$store.getters['globals/getLibraryItemCoverSrc'](libraryItem)
        if (process.env.NODE_ENV === 'development') return coverUrl
        return `${window.location.origin}${coverUrl}`
      })
    }).catch((error) => {
      console.error('failed to fetch books', error)
      return null
    })

    // Custom message to receiver
    var castSession = castContext.getCurrentSession()
    castSession.sendMessage('urn:x-cast:com.audiobookshelf.cast', {
      covers
    })
  }

  var initializeCastApi = () => {
    var castContext = cast.framework.CastContext.getInstance()
    castContext.setOptions({
      receiverApplicationId: process.env.chromecastReceiver,
      autoJoinPolicy: chrome.cast ? chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED : null
    });

    castContext.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      (event) => {
        console.log('Session state changed event', event)

        switch (event.sessionState) {
          case cast.framework.SessionState.SESSION_STARTED:
            console.log('[chromecast] CAST SESSION STARTED')

            ctx.$store.commit('globals/setCasting', true)
            sendInit(castContext)

            setTimeout(() => {
              ctx.$eventBus.$emit('cast-session-active', true)
            }, 500)

            break;
          case cast.framework.SessionState.SESSION_RESUMED:
            console.log('[chromecast] CAST SESSION RESUMED')

            setTimeout(() => {
              ctx.$eventBus.$emit('cast-session-active', true)
            }, 500)
            break;
          case cast.framework.SessionState.SESSION_ENDED:
            console.log('[chromecast] CAST SESSION DISCONNECTED')

            ctx.$store.commit('globals/setCasting', false)
            ctx.$eventBus.$emit('cast-session-active', false)
            break;
        }
      })

    ctx.$store.commit('globals/setChromecastInitialized', true)

    var player = new cast.framework.RemotePlayer()
    var playerController = new cast.framework.RemotePlayerController(player)
    ctx.$root.castPlayer = player
    ctx.$root.castPlayerController = playerController
  }

  window['__onGCastApiAvailable'] = function (isAvailable) {
    if (isAvailable) {
      initializeCastApi()
    }
  }

  var script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'
  document.head.appendChild(script)
}