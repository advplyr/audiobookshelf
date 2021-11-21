const axios = require('axios')
const { stripHtml } = require('string-strip-html')
const Logger = require('../Logger')

class Audible {
    constructor() { }

    cleanResult(item) {
        var { title, subtitle, asin, authors, narrators, publisher_name, publisher_summary, release_date, series, product_images } = item;

        var firstSeries = series && series.length > 0 ? series[0] : null;

        return {
            title,
            subtitle: subtitle || null,
            author: authors ? authors.map(({ name }) => name).join(', ') : null,
            narrator: narrators ? narrators.map(({ name }) => name).join(', ') : null,
            publisher: publisher_name,
            publishYear: release_date ? release_date.split('-')[0] : null,
            description: stripHtml(publisher_summary).result,
            cover: this.getBestImageLink(product_images),
            asin,
            series: firstSeries ? firstSeries.title : null,
            volumeNumber: firstSeries ? firstSeries.sequence : null
        }
    }

    getBestImageLink(images) {
        var keys = Object.keys(images);
        return images[keys[keys.length - 1]];
    }

    async search(title, author) {
        var queryString = `response_groups=rating,series,contributors,product_desc,media,product_extended_attrs` +
            `&image_sizes=500,1024,2000&num_results=25&products_sort_by=Relevance&title=${title}`;
        if (author) queryString += `&author=${author}`
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