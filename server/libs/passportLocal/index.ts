//
// modified for audiobookshelf
// Source: https://github.com/jaredhanson/passport-local
//

/**
 * Module dependencies.
 */
import Strategy from './strategy'

/**
 * Export constructors.
 */
const LocalStrategy = Strategy as typeof Strategy & { Strategy: typeof Strategy }
LocalStrategy.Strategy = Strategy

export = LocalStrategy
