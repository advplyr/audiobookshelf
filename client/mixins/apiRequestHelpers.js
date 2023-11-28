export default {
  methods: {
    buildQuerystring(obj, opts = { includePrefix: false }) {
      let querystring = Object
        .entries(obj)
        .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
        .join('&')

      return (opts.includePrefix ? '?' : '').concat(querystring)
    }
  }
}
