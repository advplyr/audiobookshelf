const parseFullName = require('./parseFullName')

function parseName(name) {
  var parts = parseFullName(name)
  var firstName = parts.first
  if (firstName && parts.middle) firstName += ' ' + parts.middle

  return {
    first_name: firstName,
    last_name: parts.last
  }
}

// Check if this name segment is of the format "Last, First" or "First Last"
// return true is "Last, First"
function checkIsALastName(name) {
  if (!name.includes(' ')) return true // No spaces must be a Last name

  var parsed = parseFullName(name)
  if (!parsed.first) return true // had spaces but not a first name i.e. "von Mises", must be last name only

  return false
}

module.exports = (author) => {
  if (!author) return null

  var splitAuthors = []
  // Example &LF: Friedman, Milton & Friedman, Rose
  if (author.includes('&')) {
    author.split('&').forEach((asa) => splitAuthors = splitAuthors.concat(asa.split(',')))
  } else {
    splitAuthors = author.split(',')
  }
  if (splitAuthors.length) splitAuthors = splitAuthors.map(a => a.trim())

  var authors = []

  // 1 author FIRST LAST
  if (splitAuthors.length === 1) {
    authors.push(parseName(author))
  } else {
    var firstChunkIsALastName = checkIsALastName(splitAuthors[0])
    var isEvenNum = splitAuthors.length % 2 === 0

    if (!isEvenNum && firstChunkIsALastName) {
      // console.error('Multi-author LAST,FIRST entry has a straggler (could be roman numerals or a suffix), ignore it', splitByComma[splitByComma.length - 1])
      splitAuthors = splitAuthors.slice(0, splitAuthors.length - 1)
    }

    if (firstChunkIsALastName) {
      var numAuthors = splitAuthors.length / 2
      for (let i = 0; i < numAuthors; i++) {
        var last = splitAuthors.shift()
        var first = splitAuthors.shift()
        authors.push({
          first_name: first,
          last_name: last
        })
      }
    } else {
      splitAuthors.forEach((segment) => {
        authors.push(parseName(segment))
      })
    }
  }

  var firstLast = authors.length ? authors.map(a => a.first_name ? `${a.first_name} ${a.last_name}` : a.last_name).join(', ') : ''
  var lastFirst = authors.length ? authors.map(a => a.first_name ? `${a.last_name}, ${a.first_name}` : a.last_name).join(', ') : ''
  return {
    authorFL: firstLast,
    authorLF: lastFirst,
    authorsParsed: authors
  }
}