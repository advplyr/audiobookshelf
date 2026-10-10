import { DataTypes, Model, Op } from 'sequelize'
import type User from './User'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'

type SessionAttributes = {
  id: string
  ipAddress: string | null
  userAgent: string | null
  refreshToken: string
  createdAt?: Date
  updatedAt?: Date
  userId?: string
  expiresAt: Date
  lastRefreshToken: string | null
  lastRefreshTokenExpiresAt: Date | null
}

type SessionCreation = Optional<SessionAttributes, 'id' | 'ipAddress' | 'userAgent' | 'createdAt' | 'updatedAt' | 'lastRefreshToken' | 'lastRefreshTokenExpiresAt'> & { userId: string }

class Session extends Model<SessionAttributes, SessionCreation> {
  declare id: string
  declare ipAddress: string | null
  declare userAgent: string | null
  declare refreshToken: string
  declare createdAt: Date
  declare updatedAt: Date
  declare userId: string
  declare expiresAt: Date
  declare lastRefreshToken: string | null
  declare lastRefreshTokenExpiresAt: Date | null

  declare user?: User

  constructor(values?: SessionCreation, options?: BuildOptions) {
    super(values, options)
  }

  static async createSession(userId: string, ipAddress: string | null | undefined, userAgent: string | null | undefined, refreshToken: string, expiresAt: Date) {
    const session = await Session.create({ userId, ipAddress, userAgent, refreshToken, expiresAt })
    return session
  }

  /**
   * Clean up expired sessions from the database
   * @returns {Promise<number>} Number of sessions deleted
   */
  static async cleanupExpiredSessions() {
    const deletedCount = await Session.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date()
        }
      }
    })
    return deletedCount
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize: Sequelize): void
  // Retain Sequelize's static signature for its polymorphic model methods.
  // Application code uses the single-argument initializer, as before migration.
  static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
    this: MS,
    attributes: ModelAttributes<M, Partial<Attributes<M>>>,
    options: InitOptions<M>
  ): MS
  static init(sequelizeOrAttributes: Sequelize | ModelAttributes): void | ModelStatic<Model> {
    // Database.buildModels supplies a Sequelize instance; the other overload preserves
    // the inherited static contract required by Sequelize's generic query methods.
    const sequelize = sequelizeOrAttributes as Sequelize
    super.init<typeof Session, Session>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        ipAddress: DataTypes.STRING,
        userAgent: DataTypes.STRING,
        refreshToken: {
          type: DataTypes.STRING,
          allowNull: false
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        lastRefreshToken: {
          type: DataTypes.STRING,
          allowNull: true
        },
        lastRefreshTokenExpiresAt: {
          type: DataTypes.DATE,
          allowNull: true
        }
      },
      {
        sequelize,
        modelName: 'session'
      }
    )

    const { user } = sequelize.models
    user.hasMany(Session, {
      onDelete: 'CASCADE',
      foreignKey: {
        allowNull: false
      }
    })
    Session.belongsTo(user)
  }
}

export = Session
