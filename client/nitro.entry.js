import '#internal/nitro/virtual/polyfill'

const nitroApp = useNitroApp()
const listener = toNodeListener(nitroApp.h3App)
const handler = listener
{
  process.on(
    "unhandledRejection",
    (err) => console.error("[nitro] [dev] [unhandledRejection] " + err)
  );
  process.on(
    "uncaughtException",
    (err) => console.error("[nitro] [dev] [uncaughtException] " + err)
  );
}

export { useRuntimeConfig, getRouteRules, handler, listener, useNitroApp };