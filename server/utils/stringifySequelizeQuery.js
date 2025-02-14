function stringifySequelizeQuery(findOptions) {
  // Helper function to handle symbols in nested objects
  function handleSymbols(obj) {
    if (!obj || typeof obj !== 'object') return obj

    if (Array.isArray(obj)) {
      return obj.map(handleSymbols)
    }

    const newObj = {}
    for (const [key, value] of Object.entries(obj)) {
      // Handle Symbol keys from Object.getOwnPropertySymbols
      Object.getOwnPropertySymbols(obj).forEach((sym) => {
        newObj[`__Op.${sym.toString()}`] = handleSymbols(obj[sym])
      })

      // Handle regular keys
      if (typeof key === 'string') {
        if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Symbol.prototype) {
          // Handle Symbol values
          newObj[key] = `__Op.${value.toString()}`
        } else {
          // Recursively handle nested objects
          newObj[key] = handleSymbols(value)
        }
      }
    }
    return newObj
  }

  const sanitizedOptions = handleSymbols(findOptions)
  return JSON.stringify(sanitizedOptions)
}
module.exports = stringifySequelizeQuery
