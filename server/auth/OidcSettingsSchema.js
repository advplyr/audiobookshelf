const groups = [
  { id: 'endpoints', label: 'Provider Endpoints', order: 1 },
  { id: 'credentials', label: 'Client Credentials', order: 2 },
  { id: 'behavior', label: 'Login Behavior', order: 3 },
  { id: 'claims', label: 'Claims & Group Mapping', order: 4, descriptionKey: 'LabelOpenIDClaims' },
  { id: 'advanced', label: 'Advanced', order: 5 }
]

const schema = [
  // Endpoints group
  {
    key: 'authOpenIDIssuerURL',
    type: 'text',
    label: 'Issuer URL',
    group: 'endpoints',
    order: 1,
    required: true,
    validate: 'url'
  },
  {
    key: 'discover',
    type: 'action',
    label: 'Auto-populate',
    group: 'endpoints',
    order: 2,
    description: 'Fetch endpoints from issuer discovery document',
    dependsOn: 'authOpenIDIssuerURL'
  },
  {
    key: 'authOpenIDAuthorizationURL',
    type: 'text',
    label: 'Authorize URL',
    group: 'endpoints',
    order: 3,
    required: true,
    validate: 'url'
  },
  {
    key: 'authOpenIDTokenURL',
    type: 'text',
    label: 'Token URL',
    group: 'endpoints',
    order: 4,
    required: true,
    validate: 'url'
  },
  {
    key: 'authOpenIDUserInfoURL',
    type: 'text',
    label: 'Userinfo URL',
    group: 'endpoints',
    order: 5,
    required: true,
    validate: 'url'
  },
  {
    key: 'authOpenIDJwksURL',
    type: 'text',
    label: 'JWKS URL',
    group: 'endpoints',
    order: 6,
    required: true,
    validate: 'url'
  },
  {
    key: 'authOpenIDLogoutURL',
    type: 'text',
    label: 'Logout URL',
    group: 'endpoints',
    order: 7,
    validate: 'url'
  },

  // Credentials group
  {
    key: 'authOpenIDClientID',
    type: 'text',
    label: 'Client ID',
    group: 'credentials',
    order: 1,
    required: true
  },
  {
    key: 'authOpenIDClientSecret',
    type: 'password',
    label: 'Client Secret',
    group: 'credentials',
    order: 2,
    required: true
  },
  {
    key: 'authOpenIDTokenSigningAlgorithm',
    type: 'select',
    label: 'Signing Algorithm',
    group: 'credentials',
    order: 3,
    required: true,
    default: 'RS256',
    options: [
      { value: 'RS256', label: 'RS256' },
      { value: 'RS384', label: 'RS384' },
      { value: 'RS512', label: 'RS512' },
      { value: 'ES256', label: 'ES256' },
      { value: 'ES384', label: 'ES384' },
      { value: 'ES512', label: 'ES512' },
      { value: 'PS256', label: 'PS256' },
      { value: 'PS384', label: 'PS384' },
      { value: 'PS512', label: 'PS512' },
      { value: 'EdDSA', label: 'EdDSA' }
    ]
  },

  // Behavior group
  {
    key: 'authOpenIDButtonText',
    type: 'text',
    label: 'Button Text',
    group: 'behavior',
    order: 1,
    default: 'Login with OpenId'
  },
  {
    key: 'authOpenIDMatchExistingBy',
    type: 'select',
    label: 'Match Existing Users By',
    group: 'behavior',
    order: 2,
    options: [
      { value: null, label: 'Do not match' },
      { value: 'email', label: 'Match by email' },
      { value: 'username', label: 'Match by username' }
    ]
  },
  {
    key: 'authOpenIDAutoLaunch',
    type: 'boolean',
    label: 'Auto Launch',
    group: 'behavior',
    order: 3,
    description: 'Automatically redirect to the OpenID provider on login page'
  },
  {
    key: 'authOpenIDAutoRegister',
    type: 'boolean',
    label: 'Auto Register',
    group: 'behavior',
    order: 4,
    description: 'Automatically register new users from the OpenID provider'
  },
  {
    key: 'authOpenIDRequireVerifiedEmail',
    type: 'boolean',
    label: 'Require Verified Email',
    group: 'behavior',
    order: 5,
    description: 'Reject login if email_verified is false in the OIDC userinfo, even for existing users'
  },

  // Claims group
  {
    key: 'authOpenIDScopes',
    type: 'text',
    label: 'Scopes',
    group: 'claims',
    order: 1,
    default: 'openid profile email',
    description: 'Space-separated list of OIDC scopes to request'
  },
  {
    key: 'authOpenIDGroupClaim',
    type: 'text',
    label: 'Group Claim',
    group: 'claims',
    order: 2,
    validate: 'claimName',
    descriptionKey: 'LabelOpenIDGroupClaimDescription'
  },
  {
    key: 'authOpenIDGroupMap',
    type: 'keyvalue',
    label: 'Group Mapping',
    group: 'claims',
    order: 3,
    valueOptions: ['admin', 'user', 'guest'],
    description: 'Map OIDC group names to Audiobookshelf roles. If empty, groups are matched by name (admin/user/guest).',
    dependsOn: 'authOpenIDGroupClaim'
  },
  {
    key: 'authOpenIDAdvancedPermsClaim',
    type: 'text',
    label: 'Advanced Permission Claim',
    group: 'claims',
    order: 4,
    validate: 'claimName',
    descriptionKey: 'LabelOpenIDAdvancedPermsClaimDescription'
  },

  // Advanced group
  {
    key: 'authOpenIDMobileRedirectURIs',
    type: 'array',
    label: 'Mobile Redirect URIs',
    group: 'advanced',
    order: 1,
    default: ['audiobookshelf://oauth'],
    validate: 'uri',
    description: 'Allowed redirect URIs for mobile clients.'
  },
  {
    key: 'authOpenIDSubfolderForRedirectURLs',
    type: 'select',
    label: 'Web Redirect URLs Subfolder',
    group: 'advanced',
    order: 2,
    options: [
      { value: '', label: 'None' }
    ],
    description: 'Subfolder prefix for redirect URLs (e.g. /audiobookshelf)'
  },
  {
    key: 'authOpenIDBackchannelLogoutEnabled',
    type: 'boolean',
    label: 'Back-Channel Logout',
    group: 'advanced',
    order: 3,
    description: 'Enable OIDC Back-Channel Logout. Configure your IdP with the logout URL: {baseURL}/auth/openid/backchannel-logout'
  }
]

/**
 * Get the OIDC settings schema
 * @returns {Array} schema field descriptors
 */
function getSchema() {
  // Lazily resolve sample permissions to avoid circular dependency at require time
  const User = require('../models/User')
  return schema.map((field) => {
    if (field.key === 'authOpenIDAdvancedPermsClaim') {
      return {
        ...field,
        samplePermissions: User.getSampleAbsPermissions()
      }
    }
    return field
  })
}

/**
 * Get the OIDC settings groups
 * @returns {Array} group descriptors
 */
function getGroups() {
  return groups
}

/**
 * Validate OIDC settings values against the schema
 * @param {Object} values - key-value pairs of settings
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validateSettings(values) {
  const errors = []

  // Reject unknown keys
  const knownKeys = new Set(schema.filter((f) => f.type !== 'action').map((f) => f.key))
  for (const key of Object.keys(values)) {
    if (!knownKeys.has(key)) {
      errors.push(`Unknown setting: "${key}"`)
    }
  }

  for (const field of schema) {
    if (field.type === 'action') continue

    const value = values[field.key]

    // Check required fields
    if (field.required) {
      if (value === undefined || value === null || value === '') {
        errors.push(`${field.label} is required`)
        continue
      }
    }

    // Skip validation for empty optional fields
    if (value === undefined || value === null || value === '') continue

    // Type-specific validation
    if (field.validate === 'url') {
      try {
        new URL(value)
      } catch {
        errors.push(`${field.label}: Invalid URL`)
      }
    }

    if (field.validate === 'uri') {
      if (Array.isArray(value)) {
        const uriPattern = /^\w+:\/\/[\w.-]+(\/[\w./-]*)*$/i
        for (const uri of value) {
          if (!uriPattern.test(uri)) {
            errors.push(`${field.label}: Invalid URI "${uri}"`)
          }
        }
      }
    }

    if (field.validate === 'claimName') {
      if (typeof value === 'string' && value !== '') {
        const claimPattern = /^[a-zA-Z][a-zA-Z0-9_:./-]*$/
        if (!claimPattern.test(value)) {
          errors.push(`${field.label}: Invalid claim name`)
        }
      }
    }

    if (field.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${field.label}: Expected boolean`)
      }
    }

    if (field.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${field.label}: Expected array`)
      }
    }

    if (field.type === 'keyvalue') {
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        errors.push(`${field.label}: Expected object`)
      } else if (field.valueOptions) {
        for (const [k, v] of Object.entries(value)) {
          if (!field.valueOptions.includes(v)) {
            errors.push(`${field.label}: Invalid value "${v}" for key "${k}". Must be one of: ${field.valueOptions.join(', ')}`)
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }
  return { valid: true }
}

module.exports = { getSchema, getGroups, validateSettings }
