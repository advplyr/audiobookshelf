/**
 * https://gist.github.com/DLiblik/96801665f9b6c935f12c1071d37eae95
 Compares two items (values or references) for nested equivalency, meaning that
 at root and at each key or index they are equivalent as follows:
 - If a value type, values are either hard equal (===) or are both NaN
     (different than JS where NaN !== NaN)
 - If functions, they are the same function instance or have the same value
     when converted to string via `toString()`
 - If Date objects, both have the same getTime() or are both NaN (invalid)
 - If arrays, both are same length, and all contained values areEquivalent
     recursively - only contents by numeric key are checked
 - If other object types, enumerable keys are the same (the keys themselves)
     and values at every key areEquivalent recursively
 Author: Dathan Liblik
 License: Free to use anywhere by anyone, as-is, no guarantees of any kind.
 @param value1 First item to compare
 @param value2 Other item to compare
 @param stack Used internally to track circular refs - don't set it
 */
module.exports = function areEquivalent(value1, value2, numToString = false, stack = []) {
  if (numToString) {
    if (value1 !== null && !isNaN(value1)) value1 = String(value1)
    if (value2 !== null && !isNaN(value2)) value2 = String(value2)
  }

  // Numbers, strings, null, undefined, symbols, functions, booleans.
  // Also: objects (incl. arrays) that are actually the same instance
  if (value1 === value2) {
    // Fast and done
    return true
  }

  // Truthy check to handle value1=null, value2=Object
  if ((value1 && !value2) || (!value1 && value2)) {
    // console.log('value1/value2 falsy mismatch', value1, value2)
    return false
  }

  const type1 = typeof value1

  // Ensure types match
  if (type1 !== typeof value2) {
    // console.log('type diff', type1, typeof value2)
    return false
  }

  // Special case for number: check for NaN on both sides
  // (only way they can still be equivalent but not equal)
  if (type1 === 'number') {
    // Failed initial equals test, but could still both be NaN
    return (isNaN(value1) && isNaN(value2));
  }

  // Special case for function: check for toString() equivalence
  if (type1 === 'function') {
    // Failed initial equals test, but could still have equivalent
    // implementations - note, will match on functions that have same name
    // and are native code: `function abc() { [native code] }`
    return value1.toString() === value2.toString()
  }

  // For these types, cannot still be equal at this point, so fast-fail
  if (type1 === 'bigint' || type1 === 'boolean' ||
    type1 === 'function' || type1 === 'string' ||
    type1 === 'symbol') {
    // console.log('no match for values', value1, value2)
    return false
  }

  // For dates, cast to number and ensure equal or both NaN (note, if same
  // exact instance then we're not here - that was checked above)
  if (value1 instanceof Date) {
    if (!(value2 instanceof Date)) {
      return false
    }
    // Convert to number to compare
    const asNum1 = +value1, asNum2 = +value2
    // Check if both invalid (NaN) or are same value
    return asNum1 === asNum2 || (isNaN(asNum1) && isNaN(asNum2))
  }

  // At this point, it's a reference type and could be circular, so
  // make sure we haven't been here before... note we only need to track value1
  // since value1 being un-circular means value2 will either be equal (and not
  // circular too) or unequal whether circular or not.
  if (stack.includes(value1)) {
    throw new Error(`areEquivalent value1 is circular`);
  }

  // breadcrumb
  stack.push(value1)

  // Handle arrays
  if (Array.isArray(value1)) {
    if (!Array.isArray(value2)) {
      return false
    }

    const length = value1.length

    if (length !== value2.length) {
      return false
    }

    for (let i = 0; i < length; i++) {
      if (!areEquivalent(value1[i], value2[i], numToString, stack)) {
        return false
      }
    }
    return true
  }

  // Final case: object

  // get both key lists and check length
  const keys1 = Object.keys(value1)
  const keys2 = Object.keys(value2)
  const numKeys = keys1.length

  if (keys2.length !== numKeys) {
    return false
  }

  // Empty object on both sides?
  if (numKeys === 0) {
    return true
  }

  // sort is a native call so it's very fast - much faster than comparing the
  // values at each key if it can be avoided, so do the sort and then
  // ensure every key matches at every index
  keys1.sort()
  keys2.sort()

  // Ensure perfect match across all keys
  for (let i = 0; i < numKeys; i++) {
    if (keys1[i] !== keys2[i]) {
      // console.log('object key is not equiv', keys1[i], keys2[i])
      return false
    }
  }

  // Ensure perfect match across all values
  for (let i = 0; i < numKeys; i++) {
    if (!areEquivalent(value1[keys1[i]], value2[keys1[i]], numToString, stack)) {
      // console.log('2 subobjects not equiv', keys1[i], value1[keys1[i]], value2[keys1[i]])
      return false
    }
  }

  // back up
  stack.pop();

  // Walk the same, talk the same - matching ducks. Quack.
  // 🦆🦆
  return true;
}