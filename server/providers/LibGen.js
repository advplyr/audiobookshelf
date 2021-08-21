var libgen = require('libgen')

class LibGen {
  constructor() {
    this.mirror = null
  }

  async init() {
    this.mirror = await libgen.mirror()
    console.log(`${this.mirror} is currently fastest`)
  }

  async search(queryTitle) {
    if (!this.mirror) {
      await this.init()
    }
    queryTitle = queryTitle.replace(/'/g, '')
    var options = {
      mirror: this.mirror,
      query: queryTitle,
      search_in: 'title'
    }
    var httpsMirror = this.mirror
    if (httpsMirror.startsWith('http:')) {
      httpsMirror = httpsMirror.replace('http:', 'https:')
    }
    // console.log('LibGen Search Options', options)
    try {
      const data = await libgen.search(options)
      let n = data.length
      // console.log(`${n} results for "${options.query}"`)
      var cleanedResults = []
      while (n--) {
        var resultObj = {
          id: data[n].id,
          title: data[n].title,
          author: data[n].author,
          publisher: data[n].publisher,
          description: data[n].descr,
          cover: `${httpsMirror}/covers/${data[n].coverurl}`,
          year: data[n].year
        }
        if (!resultObj.title) continue;
        cleanedResults.push(resultObj)
      }
      return cleanedResults
    } catch (err) {
      console.error(err)
      return {
        errorCode: 500
      }
    }
  }
}

module.exports = LibGen