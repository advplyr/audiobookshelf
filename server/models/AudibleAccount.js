const { DataTypes, Model } = require('sequelize')
const crypto = require('crypto')
const Logger = require('../Logger')

const ALGORITHM = 'aes-256-cbc'

function getEncryptionKey() {
  const secret = process.env.AUDIBLE_ENCRYPTION_KEY || process.env.TOKEN_SECRET
  if (!secret) throw new Error('[AudibleAccount] No encryption key available — set AUDIBLE_ENCRYPTION_KEY or TOKEN_SECRET')
  return crypto.scryptSync(secret, 'audible-salt', 32)
}

function encrypt(text) {
  if (!text) return null
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(data) {
  if (!data) return null
  try {
    const [ivHex, encHex] = data.split(':')
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()])
    return decrypted.toString('utf8')
  } catch (err) {
    Logger.error('[AudibleAccount] Failed to decrypt token', err.message)
    return null
  }
}

/**
 * @typedef ClientAudibleAccount
 * @property {string} id
 * @property {string} userId
 * @property {string} email
 * @property {string} region
 * @property {Date|null} lastSync
 * @property {boolean} isActive
 * @property {Date} createdAt
 */

class AudibleAccount extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.userId
    /** @type {string} */
    this.email
    /** @type {string} */
    this.region
    /** @type {string} encrypted access token */
    this.encryptedToken
    /** @type {string|null} encrypted website cookies JSON */
    this.encryptedCookies
    /** @type {string|null} library to show the preorders shelf on */
    this.libraryId
    /** @type {number} position in the shelf list (0 = first) */
    this.shelfPosition
    /** @type {Date|null} */
    this.lastSync
    /** @type {boolean} */
    this.isActive
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  getAccessToken() {
    return decrypt(this.encryptedToken)
  }

  setAccessToken(token) {
    this.encryptedToken = encrypt(token)
  }

  getWebsiteCookies() {
    const raw = decrypt(this.encryptedCookies)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }

  setWebsiteCookies(cookiesObj) {
    this.encryptedCookies = cookiesObj ? encrypt(JSON.stringify(cookiesObj)) : null
  }

  /**
   * @returns {ClientAudibleAccount}
   */
  toClientJson() {
    return {
      id: this.id,
      userId: this.userId,
      email: this.email,
      region: this.region,
      libraryId: this.libraryId || null,
      shelfPosition: this.shelfPosition || 0,
      lastSync: this.lastSync,
      isActive: this.isActive,
      createdAt: this.createdAt
    }
  }

  /**
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false
        },
        region: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'us'
        },
        encryptedToken: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        encryptedCookies: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        libraryId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        shelfPosition: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        lastSync: DataTypes.DATE,
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }
      },
      {
        sequelize,
        modelName: 'audibleAccount',
        indexes: [
          { fields: ['userId'] },
          { unique: true, fields: ['email', 'userId'] }
        ]
      }
    )

    const { user } = sequelize.models
    user.hasMany(AudibleAccount, { onDelete: 'CASCADE' })
    AudibleAccount.belongsTo(user)
  }
}

module.exports = AudibleAccount
