var initializeCastApi = function () {
  var context = cast.framework.CastContext.getInstance()
  context.setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  });

  context.addEventListener(
    cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
    (event) => {
      console.log('Session state changed event', event)

      switch (event.sessionState) {
        case cast.framework.SessionState.SESSION_STARTED:
          console.log('CAST SESSION STARTED')

          // Test: Casting an image
          // var castSession = cast.framework.CastContext.getInstance().getCurrentSession();
          // var mediaInfo = new chrome.cast.media.MediaInfo('https://images.unsplash.com/photo-1519331379826-f10be5486c6f', 'image/jpg');
          // var request = new chrome.cast.media.LoadRequest(mediaInfo);
          // castSession.loadMedia(request).then(
          //   function () { console.log('Load succeed'); },
          //   function (errorCode) { console.log('Error code: ' + errorCode); })

          break;
        case cast.framework.SessionState.SESSION_RESUMED:
          console.log('CAST SESSION RESUMED')
          break;
        case cast.framework.SessionState.SESSION_ENDED:
          console.log('CastContext: CastSession disconnected')
          // Update locally as necessary
          break;
      }
    })
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
