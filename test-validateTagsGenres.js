// Quick test for validateTagsGenresArray function
const validateTagsGenresArray = (tagsGenres) => {
  if (!tagsGenres || (typeof tagsGenres !== 'string' && !Array.isArray(tagsGenres))) return undefined

  // If string, split by comma and trim each item
  if (typeof tagsGenres === 'string') tagsGenres = tagsGenres.split(',')
  // If array, ensure all items are strings
  else if (!tagsGenres.every((t) => typeof t === 'string')) return undefined

  // Trim and filter out empty strings
  tagsGenres = tagsGenres.map((t) => t.trim()).filter(Boolean)
  if (!tagsGenres.length) return undefined

  // Dedup
  return [...new Set(tagsGenres)]
}

// Test cases
console.log('Test 1 - String with commas:')
console.log(validateTagsGenresArray('tag1, tag2, tag3'))
console.log('Expected: ["tag1", "tag2", "tag3"]')

console.log('\nTest 2 - Array of strings:')
console.log(validateTagsGenresArray(['tag1', 'tag2', 'tag3']))
console.log('Expected: ["tag1", "tag2", "tag3"]')

console.log('\nTest 3 - Duplicates:')
console.log(validateTagsGenresArray(['tag1', 'tag2', 'tag1', 'tag3', 'tag2']))
console.log('Expected: ["tag1", "tag2", "tag3"]')

console.log('\nTest 4 - String with duplicates:')
console.log(validateTagsGenresArray('tag1, tag2, tag1, tag3'))
console.log('Expected: ["tag1", "tag2", "tag3"]')

console.log('\nTest 5 - Extra whitespace:')
console.log(validateTagsGenresArray('  tag1  ,  tag2  ,  tag3  '))
console.log('Expected: ["tag1", "tag2", "tag3"]')

console.log('\nTest 6 - Empty string:')
console.log(validateTagsGenresArray(''))
console.log('Expected: undefined')

console.log('\nTest 7 - String with only commas:')
console.log(validateTagsGenresArray(',,,'))
console.log('Expected: undefined')

console.log('\nTest 8 - Empty array:')
console.log(validateTagsGenresArray([]))
console.log('Expected: undefined')

console.log('\nTest 9 - null:')
console.log(validateTagsGenresArray(null))
console.log('Expected: undefined')

console.log('\nTest 10 - undefined:')
console.log(validateTagsGenresArray(undefined))
console.log('Expected: undefined')

console.log('\nTest 11 - Array with non-strings:')
console.log(validateTagsGenresArray([1, 2, 3]))
console.log('Expected: undefined')

console.log('\nTest 12 - Array with mixed types:')
console.log(validateTagsGenresArray(['tag1', 2, 'tag3']))
console.log('Expected: undefined')

console.log('\nTest 13 - Array with empty strings:')
console.log(validateTagsGenresArray(['tag1', '', 'tag2', '   ']))
console.log('Expected: ["tag1", "tag2"]')

console.log('\nTest 14 - Single item:')
console.log(validateTagsGenresArray('tag1'))
console.log('Expected: ["tag1"]')

console.log('\nTest 15 - Object (invalid):')
console.log(validateTagsGenresArray({ tag: 'value' }))
console.log('Expected: undefined')
