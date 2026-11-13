/* IMPORT */
import isPrimitive from "./is-primitive";
/* ARE SHALLOW EQUAL */
var isNaN = Number.isNaN;
function areShallowEqual(x: unknown, y: unknown) {
  if (x === y)
    return true;
  if (isNaN(x))
    return isNaN(y);
  if (isPrimitive(x) || isPrimitive(y))
    return x === y;
  // The primitive checks above leave only objects and functions.
  const left = x as Record<string, unknown>;
  const right = y as Record<string, unknown>;
  for (var i in left)
    if (!(i in right))
      return false;
  for (var i in right)
    if (left[i] !== right[i])
      return false;
  return true;
}
/* EXPORT */
const exported = Object.assign(areShallowEqual, { default: areShallowEqual });
Object.defineProperty(exported, "__esModule", { value: true });

export = exported;
