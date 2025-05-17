function flattenAny(obj, prefix = '', result = {}) {
  const entries =
    obj instanceof Map
      ? obj.entries()
      : Object.entries(obj);

  for (const [key, value] of entries) {
    const newKey = prefix ? `${prefix}.${key}` : `${key}`;
    if (
      value instanceof Map ||
      (typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value))
    ) {
      flattenAny(value, newKey, result);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}


module.exports = {
  flattenAny
}
