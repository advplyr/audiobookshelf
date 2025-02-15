function stringifySequelizeQuery(findOptions) {
  function isClass(func) {
    return typeof func === 'function' && /^class\s/.test(func.toString())
  }

  function replacer(key, value) {
    if (typeof value === 'object' && value !== null) {
      const symbols = Object.getOwnPropertySymbols(value).reduce((acc, sym) => {
        acc[sym.toString()] = value[sym]
        return acc
      }, {})

      return { ...value, ...symbols }
    }

    if (isClass(value)) {
      return `${value.name}`
    }

    return value
  }

  return JSON.stringify(findOptions, replacer)
}
module.exports = stringifySequelizeQuery
