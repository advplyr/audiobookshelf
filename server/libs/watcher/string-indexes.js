"use strict";
/* STRING INDEXES */
function indexes(str, substr) {
  var indexes = [], rangeLength = substr.length;
  var indexFrom = 0;
  while (true) {
    var index = str.indexOf(substr, indexFrom);
    if (index === -1)
      return indexes;
    indexes.push(index);
    indexFrom = index + rangeLength;
  }
}
/* EXPORT */
module.exports = indexes;
module.exports.default = indexes;
Object.defineProperty(module.exports, "__esModule", { value: true });
