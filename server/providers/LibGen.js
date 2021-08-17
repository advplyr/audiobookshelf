var libgen = require('libgen')

class LibGen {
  constructor() {
    this.mirror = null
  }

  async init() {
    this.mirror = await libgen.mirror()
    console.log(`${this.mirror} is currently fastest`)
  }

  async search(query) {
    if (!this.mirror) {
      await this.init()
    }
    var options = {
      mirror: this.mirror,
      query: query,
      search_in: 'title'
    }
    try {
      const data = await libgen.search(options)
      let n = data.length
      console.log(`${n} results for "${options.query}"`)
      while (n--) {
        console.log('');
        console.log('Title: ' + data[n].title)
        console.log('Author: ' + data[n].author)
        console.log('Download: ' +
          'http://gen.lib.rus.ec/book/index.php?md5=' +
          data[n].md5.toLowerCase())
      }
      return data
    } catch (err) {
      console.error(err)
      return {
        errorCode: 500
      }
    }
  }
}

module.exports = LibGen