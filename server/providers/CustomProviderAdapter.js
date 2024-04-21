const Database = require('../Database')
const axios = require('axios')
const Logger = require('../Logger')

class CustomProviderAdapter {
    constructor() { }

    /**
     * 
     * @param {string} title 
     * @param {string} author 
     * @param {string} isbn 
     * @param {string} providerSlug 
     * @param {string} mediaType
     * @returns {Promise<Object[]>}
     */
    async search(title, author, isbn, providerSlug, mediaType) {
        const providerId = providerSlug.split('custom-')[1]
        const provider = await Database.customMetadataProviderModel.findByPk(providerId)

        if (!provider) {
            throw new Error("Custom provider not found for the given id")
        }

        // Setup query params
        const queryObj = {
            mediaType,
            query: title
        }
        if (author) {
            queryObj.author = author
        }
        if (isbn) {
            queryObj.isbn = isbn
        }
        const queryString = (new URLSearchParams(queryObj)).toString()

        // Setup headers
        const axiosOptions = {}
        if (provider.authHeaderValue) {
            axiosOptions.headers = {
                'Authorization': provider.authHeaderValue
            }
        }

        const matches = await axios.get(`${provider.url}/search?${queryString}`, axiosOptions).then((res) => {
            if (!res?.data || !Array.isArray(res.data.matches)) return null
            return res.data.matches
        }).catch(error => {
            Logger.error('[CustomMetadataProvider] Search error', error)
            return []
        })

        if (!matches) {
            throw new Error("Custom provider returned malformed response")
        }

        // re-map keys to throw out
        return matches.map(({
            title,
            subtitle,
            author,
            narrator,
            publisher,
            publishedYear,
            description,
            cover,
            isbn,
            asin,
            genres,
            tags,
            series,
            language,
            duration
        }) => {
            return {
                title,
                subtitle,
                author,
                narrator,
                publisher,
                publishedYear,
                description,
                cover,
                isbn,
                asin,
                genres,
                tags: tags?.join(',') || null,
                series: series?.length ? series : null,
                language,
                duration
            }
        })
    }
}

module.exports = CustomProviderAdapter