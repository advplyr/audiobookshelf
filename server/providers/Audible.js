const axios = require('axios')
const htmlSanitizer = require('../utils/htmlSanitizer')
const Logger = require('../Logger')

class Audible {
    constructor() {
        this.regionMap = {
            'us': '.com',
            'ca': '.ca',
            'uk': '.co.uk',
            'au': '.com.au',
            'fr': '.fr',
            'de': '.de',
            'jp': '.co.jp',
            'it': '.it',
            'in': '.in',
            'es': '.es'
        }
    }

    cleanResult(item) {
        const { title, subtitle, asin, authors, narrators, publisherName, summary, releaseDate, image, genres, seriesPrimary, seriesSecondary, language, runtimeLengthMin, formatType } = item

        const series = []
        if (seriesPrimary) {
            series.push({
                series: seriesPrimary.name,
                sequence: (seriesPrimary.position || '').replace(/Book /, '') // Can be badly formatted see #1339
            })
        }
        if (seriesSecondary) {
            series.push({
                series: seriesSecondary.name,
                sequence: (seriesSecondary.position || '').replace(/Book /, '')
            })
        }

        const genresFiltered = genres ? genres.filter(g => g.type == "genre").map(g => g.name) : []
        const tagsFiltered = genres ? genres.filter(g => g.type == "tag").map(g => g.name) : []

        return {
            title,
            subtitle: subtitle || null,
            author: authors ? authors.map(({ name }) => name).join(', ') : null,
            narrator: narrators ? narrators.map(({ name }) => name).join(', ') : null,
            publisher: publisherName,
            publishedYear: releaseDate ? releaseDate.split('-')[0] : null,
            description: summary ? htmlSanitizer.sanitize(summary) : null,
            descriptionPlain: summary ? htmlSanitizer.stripAllTags(summary) : null,
            cover: image,
            asin,
            genres: genresFiltered.length ? genresFiltered : null,
            tags: tagsFiltered.length ? tagsFiltered.join(', ') : null,
            series: series.length ? series : null,
            language: language ? language.charAt(0).toUpperCase() + language.slice(1) : null,
            duration: runtimeLengthMin && !isNaN(runtimeLengthMin) ? Number(runtimeLengthMin) : 0,
            region: item.region || null,
            rating: item.rating || null,
            abridged: formatType === 'abridged'
        }
    }

    isProbablyAsin(title) {
        return /^[0-9A-Z]{10}$/.test(title)
    }

    asinSearch(asin, region) {
        asin = encodeURIComponent(asin);
        var regionQuery = region ? `?region=${region}` : ''
        var url = `https://api.audnex.us/books/${asin}${regionQuery}`
        Logger.debug(`[Audible] ASIN url: ${url}`)
        return axios.get(url).then((res) => {
            if (!res || !res.data || !res.data.asin) return null
            return res.data
        }).catch(error => {
            Logger.error('[Audible] ASIN search error', error)
            return []
        })
    }

    async search(title, author, asin, region) {
        if (region && !this.regionMap[region]) {
            Logger.error(`[Audible] search: Invalid region ${region}`)
            region = ''
        }

        let items
        if (asin) {
            items = [await this.asinSearch(asin, region)]
        }

        if (!items && this.isProbablyAsin(title)) {
            items = [await this.asinSearch(title, region)]
        }

        if (!items) {
            const queryObj = {
                num_results: '10',
                products_sort_by: 'Relevance',
                title: title
            }
            if (author) queryObj.author = author
            const queryString = (new URLSearchParams(queryObj)).toString()
            const tld = region ? this.regionMap[region] : '.com'
            const url = `https://api.audible${tld}/1.0/catalog/products?${queryString}`
            Logger.debug(`[Audible] Search url: ${url}`)
            items = await axios.get(url).then((res) => {
                if (!res || !res.data || !res.data.products) return null
                return Promise.all(res.data.products.map(result => this.asinSearch(result.asin, region)))
            }).catch(error => {
                Logger.error('[Audible] query search error', error)
                return []
            })
        }
        return items ? items.map(item => this.cleanResult(item)) : []
    }
}

module.exports = Audible