function stringifySequelizeQuery(findOptions: unknown): string | undefined {
  function isClass(func: unknown): func is { name: string } {
    return typeof func === 'function' && /^class\s/.test(func.toString())
  }

  function replacer(key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      const symbols = Object.getOwnPropertySymbols(value).reduce<Record<string, unknown>>((acc, sym) => {
        // The keys come from this object's own symbol properties; their values may have any shape.
        acc[sym.toString()] = (value as Record<symbol, unknown>)[sym]
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
export = stringifySequelizeQuery
