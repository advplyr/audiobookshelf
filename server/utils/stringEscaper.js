function escapeString(string) {
  return string.replace(/[.*"+?^${}()|[\]\\]/g, '\\$&');
}

module.exports.escapeString = escapeString