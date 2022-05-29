"use strict";
/* IMPORT */
var isPrimitive = require("./is-primitive");
/* ARE SHALLOW EQUAL */
var isNaN = Number.isNaN;
function areShallowEqual(x, y) {
  if (x === y)
    return true;
  if (isNaN(x))
    return isNaN(y);
  if (isPrimitive(x) || isPrimitive(y))
    return x === y;
  for (var i in x)
    if (!(i in y))
      return false;
  for (var i in y)
    if (x[i] !== y[i])
      return false;
  return true;
}
/* EXPORT */
module.exports = areShallowEqual;
module.exports.default = areShallowEqual;
Object.defineProperty(module.exports, "__esModule", { value: true });
