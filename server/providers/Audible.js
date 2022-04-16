const axios = require('axios')
const { stripHtml } = require('string-strip-html')
const Logger = require('../Logger')

class Audible {
    constructor() { }

    cleanResult(item) {
        var { title, subtitle, asin, authors, narrators, publisher_name, publisher_summary, release_date, series, product_images, publication_name } = item;

        var primarySeries = this.getPrimarySeries(series, publication_name);

        return {
            title,
            subtitle: subtitle || null,
            author: authors ? authors.map(({ name }) => name).join(', ') : null,
            narrator: narrators ? narrators.map(({ name }) => name).join(', ') : null,
            publisher: publisher_name,
            publishedYear: release_date ? release_date.split('-')[0] : null,
            description: stripHtml(publisher_summary).result,
            cover: this.getBestImageLink(product_images),
            asin,
            series: primarySeries ? primarySeries.title : null,
            volumeNumber: primarySeries ? primarySeries.sequence : null
        }
    }

    getBestImageLink(images) {
        if (!images) return null
        var keys = Object.keys(images)
        if (!keys.length) return null
        return images[keys[keys.length - 1]]
    }

    getPrimarySeries(series, publication_name) {
        return (series && series.length > 0) ? series.find((s) => s.title == publication_name) || series[0] : null
    }

    isProbablyAsin(title) {
        return /^[0-9A-Z]{10}$/.test(title)
    }

    asinSearch(asin) {
        var queryObj = {
            response_groups: 'rating,series,contributors,product_desc,media,product_extended_attrs',
            image_sizes: '500,1024,2000'
        };
        var queryString = (new URLSearchParams(queryObj)).toString();
        asin = encodeURIComponent(asin);
        var url = `https://api.audible.com/1.0/catalog/products/${asin}?${queryString}`
        Logger.debug(`[Audible] ASIN url: ${url}`)
        return axios.get(url).then((res) => {
            if (!res || !res.data || !res.data.product) return []
            return [res.data.product]
        }).catch(error => {
            Logger.error('[Audible] search error', error)
            return []
        })
    }

    async search(title, author) {
        if (this.isProbablyAsin(title)) {
            var items = await this.asinSearch(title)
            if (items.length > 0) return items.map(item => this.cleanResult(item))
        }

        var queryObj = {
            response_groups: 'rating,series,contributors,product_desc,media,product_extended_attrs',
            image_sizes: '500,1024,2000',
            num_results: '25',
            products_sort_by: 'Relevance',
            title: title
        };
        if (author) queryObj.author = author
        var queryString = (new URLSearchParams(queryObj)).toString();
        var url = `https://api.audible.com/1.0/catalog/products?${queryString}`
        Logger.debug(`[Audible] Search url: ${url}`)
        var items = await axios.get(url).then((res) => {
            if (!res || !res.data || !res.data.products) return []
            return res.data.products
        }).catch(error => {
            Logger.error('[Audible] search error', error)
            return []
        })
        return items.map(item => this.cleanResult(item))
    }
}

module.exports = Audible