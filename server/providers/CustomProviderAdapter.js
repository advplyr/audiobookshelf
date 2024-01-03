const Database = require('../Database')
const axios = require("axios");
const Logger = require("../Logger");

class CustomProviderAdapter {
    constructor() {
    }

    async search(title, author, providerSlug) {
        const providerId = providerSlug.split("custom-")[1]

        console.log(providerId)
        const provider = await Database.customMetadataProviderModel.findOne({
            where: {
                id: providerId,
            }
        });

        if (!provider) {
            throw new Error("Custom provider not found for the given id");
        }

        const matches = await axios.get(`${provider.url}/search?query=${encodeURIComponent(title)}${!!author ? `&author=${encodeURIComponent(author)}` : ""}`, {
            headers: {
                "Authorization": provider.apiKey,
            },
        }).then((res) => {
            if (!res || !res.data || !Array.isArray(res.data.matches)) return null
            return res.data.matches
        }).catch(error => {
            Logger.error('[CustomMetadataProvider] Search error', error)
            return []
        })

        if (matches === null) {
            throw new Error("Custom provider returned malformed response");
        }

        // re-map keys to throw out
        return matches.map(({
            title,
            subtitle,
            author,
            narrator,
            publisher,
            published_year,
            description,
            cover,
            isbn,
            asin,
            genres,
            tags,
            language,
            duration,
        }) => {
            return {
                title,
                subtitle,
                author,
                narrator,
                publisher,
                publishedYear: published_year,
                description,
                cover,
                isbn,
                asin,
                genres,
                tags: tags.join(","),
                language,
                duration,
            }
        })
    }
}

module.exports = CustomProviderAdapter