const axios = require('axios')
const htmlSanitizer = require('../utils/htmlSanitizer')
const Logger = require('../Logger')

class Audible {
    constructor() { }

    cleanResult(item) {
        var { title, subtitle, asin, authors, narrators, publisherName, summary, releaseDate, image, genres, seriesPrimary, seriesSecondary, language, runtimeLengthMin } = item

        var series = []
        if (seriesPrimary) series.push(seriesPrimary)
        if (seriesSecondary) series.push(seriesSecondary)

        const genresFiltered = genres ? genres.filter(g => g.type == "genre").map(g => g.name) : []
        const tagsFiltered = genres ? genres.filter(g => g.type == "tag").map(g => g.name) : []

        return {
            title,
            subtitle: subtitle || null,
            author: authors ? authors.map(({ name }) => name).join(', ') : null,
            narrator: narrators ? narrators.map(({ name }) => name).join(', ') : null,
            publisher: publisherName,
            publishedYear: releaseDate ? releaseDate.split('-')[0] : null,
            description: summary ? htmlSanitizer.stripAllTags(summary) : null,
            cover: image,
            asin,
            genres: genresFiltered.length ? genresFiltered : null,
            tags: tagsFiltered.length ? tagsFiltered.join(', ') : null,
            series: series != [] ? series.map(({ name, position }) => ({ series: name, sequence: position })) : null,
            language: language ? language.charAt(0).toUpperCase() + language.slice(1) : null,
            duration: runtimeLengthMin && !isNaN(runtimeLengthMin) ? Number(runtimeLengthMin) : 0
        }
    }

    isProbablyAsin(title) {
        return /^[0-9A-Z]{10}$/.test(title)
    }

    asinSearch(asin) {
        asin = encodeURIComponent(asin);
        var url = `https://api.audnex.us/books/${asin}`
        Logger.debug(`[Audible] ASIN url: ${url}`)
        return axios.get(url).then((res) => {
            if (!res || !res.data || !res.data.asin) return null
            return res.data
        }).catch(error => {
            Logger.error('[Audible] ASIN search error', error)
            return []
        })
    }

    async search(title, author, asin) {
        var items
        if (asin) {
            items = [await this.asinSearch(asin)]
        }

        if (!items && this.isProbablyAsin(title)) {
            items = [await this.asinSearch(title)]
        }

        if (!items) {
            var queryObj = {
                num_results: '10',
                products_sort_by: 'Relevance',
                title: title
            };
            if (author) queryObj.author = author
            var queryString = (new URLSearchParams(queryObj)).toString();
            var url = `https://api.audible.com/1.0/catalog/products?${queryString}`
            Logger.debug(`[Audible] Search url: ${url}`)
            items = await axios.get(url).then((res) => {
                if (!res || !res.data || !res.data.products) return null
                return Promise.all(res.data.products.map(result => this.asinSearch(result.asin)))
            }).catch(error => {
                Logger.error('[Audible] query search error', error)
                return []
            })
        }
        return items ? items.map(item => this.cleanResult(item)) : []
    }
}

module.exports = Audible