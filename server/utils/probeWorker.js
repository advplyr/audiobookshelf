const { parentPort } = require("worker_threads")
const prober = require('./prober')

parentPort.on("message", async ({ mediaPath }) => {
  const results = await prober.probe(mediaPath)
  parentPort.postMessage({
    data: results,
  })
})