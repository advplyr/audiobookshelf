const true_values = ["true", "yes", "y", "1", "on"];

module.exports.parseBool = (value) => {
  if (Object.is(value, null) || value === undefined) {
    return false;
  }
  return true_values.includes(String(value).toLowerCase());
}