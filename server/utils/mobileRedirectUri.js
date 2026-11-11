/**
 * Allowed form of an entry in "Allowed Mobile Redirect URIs" (other than "*").
 * Accepts `scheme://host/path` and the RFC 8252 private-use form `com.example.app:/path`.
 * The scheme allows RFC 3986 characters (letters, digits, "+", "-", ".") plus "_", which the previous pattern accepted.
 * Written without nested repeats, so it runs in linear time.
 * Keep in sync with client/pages/config/authentication.vue.
 */
const mobileRedirectUriPattern = /^\w[\w+.-]*:(\/\/[\w.-]+(\/[\w./-]*)?|\/[\w.-][\w./-]*)$/i

/**
 * @param {*} uri
 * @returns {boolean}
 */
function isValidMobileRedirectUri(uri) {
  return typeof uri === 'string' && mobileRedirectUriPattern.test(uri)
}

module.exports = { isValidMobileRedirectUri }
