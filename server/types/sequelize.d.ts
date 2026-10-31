import 'sequelize'

declare module 'sequelize' {
  interface Sequelize {
    // Database.connect installs this helper before model methods are used.
    uppercaseFirst(value: string): string
  }
}
