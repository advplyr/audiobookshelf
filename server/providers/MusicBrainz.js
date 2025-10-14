const axios = require('axios').default
const path = require('path')
const packageJson = require('../../package.json')
const Logger = require('../Logger')
const Throttle = require('p-throttle')

class MusicBrainz {
  #responseTimeout = 10000
  static _instance = null

  constructor() {
    // ensures MusicBrainz class is a singleton
    if (MusicBrainz._instance) {
      return MusicBrainz._instance
    }

    // Rate limit is 1 request per second for the same source IP address.
    // @see https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
    this.limiter = Throttle({
      limit: 1,
      strict: true,
      interval: 150,
    })

    MusicBrainz._instance = this
  }

  get baseUrl() {
    return 'https://musicbrainz.org/ws/2'
  }

  get userAgentString() {
    return `audiobookshelf/${packageJson.version} (https://audiobookshelf.org)`
  }

  /**
   * Escape special Lucene search characters.
   * @param {string} input
   * @returns {string}
   */
  escapeLuceneCharacters(input) {
    if (typeof input === 'string' || input instanceof String) {
      const specialLuceneCharacters = ['\\', '+', '-', '&&', '||', '!', '(', ')', '{', '}', '[', ']', '^', '"', '~', '*', '?', ':', '/']
      return specialLuceneCharacters.reduce((accumulator, character) => {
        return accumulator.replaceAll(character, '\\' + character)
      }, input)
    }
  }

  /**
   * Attempt to parse the authors and narrators from the MusicBrainz artist credit.
   * @param {Object[]} artistCredit The MusicBrainz artist credit
   * @returns {Object[], Object[]} Parsed authors and narrators
   */
  parseArtistCredit(artistCredit) {
    // Up until the first join phrase which contains letter, assume each artist is an author, otherwise ignore the artist.
    // The artist where the join phrase contains the first letter should be assumed to be an author.
    // After a join phrase containing any of 'read', 'narrat', or 'perform' is reached, assume each artist is a narrator until the first join phrase which contains letter.
    // The artist where the join phrase contains the first letter should be assumed to be a narrator.
    let type = 'author'
    let authors = []
    let narrators = []
    var regExp = /[a-zA-Z]/g
    artistCredit.forEach((credit) => {
      if (type === 'author') {
        authors.push(credit.name)
      } else if (type === 'narrator') {
        narrators.push(credit.name)
      }
      if (credit?.joinphrase) {
        if (credit.joinphrase === ' and ' || credit.joinphrase === ', and ') {
          // nothing changes
        } else if (credit.joinphrase.includes('read') || credit.joinphrase.includes('narrat') || credit.joinphrase.includes('perform')) {
          type = 'narrator'
        } else if (regExp.test(credit.joinphrase)) {
          type = 'unknown'
        }
      }
    })
    return {
      authors: authors,
      narrators: narrators
    }
  }

  /**
   * Parse an Audible ASIN from an Audible URL.
   * @param {string} urlString
   * @returns {string}
   */
  parseAudibleAsinFromUrl(urlString) {
    const url = new URL(urlString)
    if (url?.hostname?.startsWith('www.audible.')) {
      return path.parse(url.pathname).base.toUpperCase()
    }
  }

  /**
   * Parse Audible ASIN from MusicBrainz relations.
   * @param {Object[]} relations
   * @returns {string}
   */
  parseAudibleAsin(relations) {
    if (!relations) {
      return null
    }
    const asins = relations
      .filter((relation) => {
        return relation['target-type'] === 'url' && relation.type.startsWith('purchase')
      })
      .map((relation) => {
        return this.parseAudibleAsinFromUrl(relation.url.resource)
      })
      .filter((asin) => {
        return asin !== undefined
      })
    if (asins.length === 0) {
      return null
    }
    if (asins.length > 1) {
      Logger.error(`[MusicBrainz] Parsed multiple Audible ASINs: ${JSON.stringify(asins)}. Ignoring all but the first.`)
    }
    return asins[0]
  }

  /**
   * Parse series from MusicBrainz relations.
   * @param {Object[]} relations
   * @returns {Object[]}
   */
  parseSeries(relations) {
    return relations
      .filter((relation) => {
        return relation['target-type'] === 'series'
      })
      .map((relation) => {
        return {
          sequence: relation['ordering-key'],
          series: relation.series.name,
          type: relation.series.type
        }
      })
      .sort((a, b) => {
        if (a.series < b.series) {
          return 1
        }
        if (a.series > b.series) {
          return -1
        }
        if (a.type > b.type) {
          return 0
        }
        // Order of precedence is release, release group, then work
        if (a.type === 'Release series') {
          return 1
        }
        if (b.type === 'Release series') {
          return -1
        }
        if (a.type === 'Release group series') {
          return 1
        }
        if (b.type === 'Release group series') {
          return -1
        }
        if (a.type === 'Work series') {
          return 1
        }
        if (b.type === 'Work series') {
          return -1
        }
        return a.sequence - b.sequence
      })
      .reduce((accumulator, s) => {
        if (!accumulator.some((s2) => { return s2.series === s.series })) {
          return accumulator.concat([{
            series: s.series,
            sequence: s.sequence
          }])
        }
        return accumulator
      }, [])
      .sort((a, b) => {
        if ('sequence' in a && 'sequence' in b) {
          return b.sequence - a.sequence
        } else if ('sequence' in a) {
          return a.sequence
        } else if ('sequence' in b) {
          return b.sequence
        }
        return 0
      })
  }

  /**
   * Parse all relationships from a MusicBrainz release.
   * @param {Object[]} relations
   * @returns {Object[]}
   */
  parseRelations(release) {
    return [].concat(release?.['release-group']?.relations)
      .concat(release.relations)
      .concat(
        release.media.reduce((mediumAccumulator, medium) => {
          return mediumAccumulator.concat(
            medium.tracks.reduce((trackAccumulator, track) => {
              return trackAccumulator.concat(
                track.recording.relations.concat(track.recording.relations.reduce((recordingAccumulator, recording_relation) => {
                  if (recording_relation['target-type'] === 'work') {
                    return recordingAccumulator.concat(recording_relation.work.relations)
                  }
                  return recordingAccumulator
                }, []))
              )
            }, [])
          )
        }, [])
      )
      .filter((element) => element !== undefined)
      .reduce((accumulator, relation) => {
        const found = accumulator.find((item) => {
          const keys = ['name', 'target-credit', 'target-type', 'type', 'direction', 'attributes', 'artist', 'work', 'label', 'url']
          for (let i = 0; i < keys.length; i++) {
            const key = keys.at(i)
            if (item?.[key] !== relation?.[key]) {
              return false
            }
          }
          return true
        })
        if (found) {
          return accumulator
        }
        return accumulator.concat([relation])
      }, [])
  }

  /**
   * Parse genres and tags from MusicBrainz.
   * @param {Object[]} allTags Tags from the release, release group, works, recordings, and series
   * @returns {Object[]}
   */
  parseTags(allTags) {
    const specialPurposeTags = ['abridged', 'accompanying documents', 'audiobook', 'chapters', 'explicit', 'unabridged']
    const ignoredTags = ['abridged', 'audiobook', 'chapters', 'explicit', 'unabridged']
    let sortTags = (a, b) => {
      if (!a?.name || !b?.name || !'count' in a || !'count' in b) {
        return -1
      }
      if (a.count === b.count) {
        return a.name.toString().localeCompare(b.name)
      }
      return b.count - a.count
    }

    const sortedTags = allTags.sort(sortTags)
    function onlyUnique(value, index, array) {
      return array.indexOf(value) === index
    }
    const genres = sortedTags
      .filter((tag) => {
        return !specialPurposeTags.includes(tag.name)
      })
      .map((tag) => {
        return tag.name
      })
      .filter(onlyUnique)
    const tags = sortedTags
      .filter((tag) => {
        return specialPurposeTags.includes(tag.name) && !ignoredTags.includes(tag.name)
      })
      .map((tag) => {
        return tag.name
      })
      .filter(onlyUnique)
    const hasAbridgedTag = sortedTags.some((tag) => {
      return tag.name === 'abridged'
    })
    const hasUnabridgedTag = sortedTags.some((tag) => {
      return tag.name === 'unabridged'
    })
    const explicit = sortedTags.some((tag) => {
      return tag.name === 'explicit'
    })
    let abridged = hasAbridgedTag && !hasUnabridgedTag
    if (hasAbridgedTag && hasUnabridgedTag) {
      Logger.error('[MusicBrainz] Both abridged and unabridged tags are present')
      const abridgedCount = sortedTags.find((tag) => {
        return tag.name === 'abridged'
      }).count
      const unabridgedCount = sortedTags.find((tag) => {
        return tag.name === 'unabridged'
      }).count
      if (abridgedCount === unabridgedCount) {
        Logger.error(`[MusicBrainz] Both abridged and unabridged tags are present and they both have same count ${abridgedCount}`)
        abridged = null
      } else {
        abridged = abridgedCount > unabridgedCount
      }
    }

    return {
      abridged: abridged,
      explicit: explicit,
      genres: genres,
      tags: tags
    }
  }

  /**
   * Look up all of the details of a MusicBrainz series.
   * @param {string} id MusicBrainz Series id
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  async getSeries(id, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout
    const includes = {
      inc: ['tags'].join('+')
    }
    const config = {
      headers: {
        'User-Agent': this.userAgentString,
        Accept: 'application/json'
      },
      timeout
    }
    Logger.debug(`[MusicBrainz] Series search id: ${id}`)
    try {
      const response = await this._processRequest(this.limiter(() => axios.get(`${this.baseUrl}/series/${id}/`, { params: includes }, config)))
      Logger.debug(`[MusicBrainz] Series got: ${JSON.stringify(response.data)}`)
      if (!response?.data) return null
      return response.data
    } catch (error) {
      Logger.error('[MusicBrainz] Error getting series', error.message)
      return null
    }
  }

  /**
   * Look up all of the details of a MusicBrainz work.
   * @param {string} id MusicBrainz Work id
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  async getWork(id, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout
    const includes = {
      inc: ['tags'].join('+')
    }
    const config = {
      headers: {
        'User-Agent': this.userAgentString,
        Accept: 'application/json'
      },
      timeout
    }
    try {
      const response = await this._processRequest(this.limiter(() => axios.get(`${this.baseUrl}/work/${id}/`, { params: includes }, config)))
      Logger.debug(`[MusicBrainz] getWork: ${id}`)
      if (!response?.data) return null
      return response.data
    } catch (error) {
      Logger.error('[MusicBrainz] Error getting work', error.message)
      return null
    }
  }

  /**
   * Look up the essential details for a release using as few API calls and resources as possible.
   * This is useful when displaying matches for each release in the UI.
   * @param {string} id MusicBrainz Release id
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  async getReleaseMinimal(id, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout
    const includes = {
      inc: [
        'artist-credits',
        'media',
        'recordings',
        'work-rels',
        'series-rels',
        'artist-rels',
        'recording-level-rels',
        'work-level-rels',
        // Non-essential for the Match list.
        'labels',
        'label-rels',
        'release-group-rels',
        'release-group-level-rels',
        'tags',
        'release-groups',
        'url-rels',
      ].join('+')
    }
    const config = {
      headers: {
        'User-Agent': this.userAgentString,
        Accept: 'application/json'
      },
      timeout
    }
    try {
      const response = await this._processRequest(this.limiter(() => axios.get(`${this.baseUrl}/release/${id}/`, { params: includes }, config)))
      if (!response?.data) return null
      const release = response.data
      const allRelations = this.parseRelations(response.data)
      const releaseTags = release.tags.map((tag) => {
        tag.type = 'release'
        return tag
      })
      const releaseGroupTags = release['release-group'].tags.map((tag) => {
        tag.type = 'release group'
        return tag
      })
      const recordingTags = release.media
        .reduce((mediumAccumulator, medium) => {
          return mediumAccumulator.concat(
            medium.tracks.reduce((trackAccumulator, track) => {
              return trackAccumulator.concat(
                track.recording.tags.map((tag) => {
                  tag.type = 'recording'
                  return tag
                })
              )
            }, [])
          )
        }, [])
        .reduce((accumulator, tag) => {
          const found = accumulator.find((item) => { return item.name === tag.name })
          if (found) {
            return accumulator
          }
          return accumulator.concat([tag])
        }, [])
      const allTags = releaseTags.concat(releaseGroupTags).concat(recordingTags)
      const parsedTags = this.parseTags(allTags)
      const series = this.parseSeries(allRelations)
      const duration = Math.floor(
        response.data.media.reduce((mediumAccumulator, medium) => {
          return (
            mediumAccumulator +
            medium.tracks.reduce((trackAccumulator, track) => {
              return trackAccumulator + track.length
            }, 0)
          )
        }, 0) / 60_000
      )
      const artistCreditArtists = response.data['artist-credit'].map((artistCredit) => {
        return {
          id: artistCredit.artist.id,
          name: artistCredit.name
        }
      })
      const authors = allRelations
        .filter((relation) => {
          return relation['target-type'] === 'artist' && relation.type === 'writer'
        })
        .map((relation) => {
          return relation.artist
        })
        .reduce((accumulator, author) => {
          const found = accumulator.find((item) => { return item.name === author.name })
          if (found) {
            return accumulator
          }
          return accumulator.concat([author])
        }, [])
        .map((author) => {
          const credit = artistCreditArtists.find((artistCredit) => {
            return artistCredit.id === author.id
          })
          if ('name' in credit && credit.name.length > 0) {
            return credit.name
          }
          if ('target-credit' in author && author['target-credit'].length > 0) {
            return author['target-credit']
          }
          return author.name
        })
      const narrators = allRelations
        .filter((relation) => {
          return relation?.['target-type'] === 'artist' && relation?.type === 'vocal' && relation?.attributes?.includes('spoken vocals') && relation?.artist?.id !== '125ec42a-7229-4250-afc5-e057484327fe' // unknown
        })
        .map((relation) => {
          return relation?.artist
        })
        .reduce((accumulator, narrator) => {
          const found = accumulator.find((item) => { return item.id === narrator.id });
          if (found) {
            return accumulator
          }
          return accumulator.concat([narrator])
        }, [])
        .map((narrator) => {
          const credit = artistCreditArtists.find((artistCredit) => {
            return artistCredit.id === narrator.id
          })
          if (credit?.name && credit.name.length > 0) {
            return credit.name
          }
          if (narrator?.['target-credit'] && narrator['target-credit'].length > 0) {
            return narrator['target-credit']
          }
          return narrator.name
        })
      function onlyUnique(value, index, array) {
        return array.indexOf(value) === index
      }
      return {
        authors: authors,
        duration: duration,
        narrators: narrators,
        series: series,
        // Fields that are not essential for being displayed in the Match list.
        // todo Remove these from here and only get them for a selected match.
        abridged: parsedTags?.abridged,
        audibleAsin: this.parseAudibleAsin(response.data?.relations),
        explicit: parsedTags?.explicit,
        genres: parsedTags?.genres,
        publishers: release['label-info'].map((label) => {
                return label?.label?.name
              })
          .concat(
            allRelations.filter((relation) => {
                return relation?.['target-type'] === 'label' && relation?.type === 'published'
              }).map((relation) => {
                if (relation.label?.['target-credit']) {
                  return relation.label['target-credit']
                }
                return relation.label.name
              })
            )
            .filter((element) => element !== undefined)
            .filter(onlyUnique)
            .join(', '),
        tags: parsedTags?.tags,
      }
    } catch (error) {
      Logger.error('[MusicBrainz] Error getting release', error.message)
      return null
    }
  }

  /**
   * Look up all of the details of a MusicBrainz release.
   * @param {string} id MusicBrainz Release id
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  async getReleaseFull(id, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout
    const includes = {
      inc: [
        'artist-credits',
        'labels',
        'media',
        'recordings',
        'release-groups',
        'tags',
        'release-group-rels',
        'work-rels',
        'series-rels',
        'artist-rels',
        'label-rels',
        'recording-level-rels',
        'release-group-level-rels',
        'work-level-rels',
        'url-rels' // for Audible ASIN
      ].join('+')
    }
    const config = {
      headers: {
        'User-Agent': this.userAgentString,
        Accept: 'application/json'
      },
      timeout
    }
    function onlyUnique(value, index, array) {
      return array.indexOf(value) === index
    }
    try {
      Logger.debug(`[MusicBrainz] getRelease: Here!`)
      const response = await this._processRequest(this.limiter(() => axios.get(`${this.baseUrl}/release/${id}/`, { params: includes }, config)))
      if (!response?.data) return null
      Logger.debug(`[MusicBrainz] getRelease response: ${JSON.stringify(response.data.tags)}`)
      Logger.debug(`[MusicBrainz] getRelease response2: ${JSON.stringify(response.data['release-group'].tags)}`)
      const release = response.data
      const allRelations = this.parseRelations(response.data)
      const workTags = (await Promise.all(
        allRelations
          .filter((relation) => {
            return relation['target-type'] === 'work'
          })
          .map((relation) => {
            return relation.work.id
          })
          .reduce((accumulator, work) => {
            const found = accumulator.find((id) => { return id === work })
            if (found) {
              return accumulator
            }
            return accumulator.concat([work])
          }, [])
          .map(async (work) => {
            Logger.debug(`[MusicBrainz] work: ${JSON.stringify(work)}`)
            return await this.getWork(work, timeout)
          })
        )).reduce((accumulator, work) => {
        return accumulator.concat(
          work.tags.map((tag) => {
            tag.type = 'work'
            return tag
          })
        )
      }, [])
      const seriesTags = (await Promise.all(
        allRelations
          .filter((relation) => {
            return relation['target-type'] === 'series'
          })
          .map((relation) => {
            return relation.series.id
          })
          .filter(onlyUnique)
          .map(async (series) => {
            return await this.getSeries(series, timeout)
          })
        )
      ).reduce((accumulator, series) => {
        return accumulator.concat(
          series.tags.map((tag) => {
            tag.type = series.type
            return tag
          })
        )
      }, [])
      const releaseTags = release.tags.map((tag) => {
        tag.type = 'release'
        return tag
      })
      const releaseGroupTags = release['release-group'].tags.map((tag) => {
        tag.type = 'release group'
        return tag
      })
      const recordingTags = release.media
        .reduce((mediumAccumulator, medium) => {
          return mediumAccumulator.concat(
            medium.tracks.reduce((trackAccumulator, track) => {
              return trackAccumulator.concat(
                track.recording.tags.map((tag) => {
                  tag.type = 'recording'
                  return tag
                })
              )
            }, [])
          )
        }, [])
        .reduce((accumulator, tag) => {
          const found = accumulator.find((item) => { return item.name === tag.name })
          if (found) {
            return accumulator
          }
          return accumulator.concat([tag])
        }, [])
      const allTags = workTags.concat(seriesTags).concat(releaseTags).concat(releaseGroupTags).concat(recordingTags)
      const parsedTags = this.parseTags(allTags)
      const series = this.parseSeries(allRelations)
      const duration = Math.floor(
        response.data.media.reduce((mediumAccumulator, medium) => {
          return (
            mediumAccumulator +
            medium.tracks.reduce((trackAccumulator, track) => {
              return trackAccumulator + track.length
            }, 0)
          )
        }, 0) / 60_000
      )
      const artistCreditArtists = response.data['artist-credit'].map((artistCredit) => {
        return {
          id: artistCredit.artist.id,
          name: artistCredit.name
        }
      })
      const authors = allRelations
        .filter((relation) => {
          return relation['target-type'] === 'artist' && relation.type === 'writer'
        })
        .map((relation) => {
          return relation.artist
        })
        .reduce((accumulator, author) => {
          const found = accumulator.find((item) => { return item.name === author.name })
          if (found) {
            return accumulator
          }
          return accumulator.concat([author])
        }, [])
        .map((author) => {
          const credit = artistCreditArtists.find((artistCredit) => {
            return artistCredit.id === author.id
          })
          if ('name' in credit && credit.name.length > 0) {
            return credit.name
          }
          if ('target-credit' in author && author['target-credit'].length > 0) {
            return author['target-credit']
          }
          return author.name
        })
      const narrators = allRelations
        .filter((relation) => {
          return relation?.['target-type'] === 'artist' && relation?.type === 'vocal' && relation?.attributes?.includes('spoken vocals') && relation?.artist?.id !== '125ec42a-7229-4250-afc5-e057484327fe' // unknown
        })
        .map((relation) => {
          return relation?.artist
        })
        .reduce((accumulator, narrator) => {
          const found = accumulator.find((item) => { return item.id === narrator.id });
          if (found) {
            return accumulator
          }
          return accumulator.concat([narrator])
        }, [])
        .map((narrator) => {
          const credit = artistCreditArtists.find((artistCredit) => {
            return artistCredit.id === narrator.id
          })
          if (credit?.name && credit.name.length > 0) {
            return credit.name
          }
          if (narrator?.['target-credit'] && narrator['target-credit'].length > 0) {
            return narrator['target-credit']
          }
          return narrator.name
        })
      return {
        abridged: parsedTags?.abridged,
        audibleAsin: this.parseAudibleAsin(response.data?.relations),
        authors: authors,
        chapters: this.parseChapters(response.data),
        duration: duration,
        explicit: parsedTags?.explicit,
        genres: parsedTags?.genres,
        narrators: narrators,
        publishers: release['label-info'].map((label) => {
                return label?.label?.name
              })
          .concat(
            allRelations.filter((relation) => {
                return relation?.['target-type'] === 'label' && relation?.type === 'published'
              }).map((relation) => {
                if (relation.label?.['target-credit']) {
                  return relation.label['target-credit']
                }
                return relation.label.name
              })
            )
            .filter((element) => element !== undefined)
            .filter(onlyUnique)
            .join(', '),
        series: series,
        tags: parsedTags?.tags,
      }
    } catch (error) {
      Logger.error('[MusicBrainz] Error getting release', error.message)
      return null
    }
  }

  /**
   * Calculates start offsets of chapters given their durations.
   * @param {[Int]}
   * @returns {[Int]}
   */
  lengthsToStartOffsets(lengths) {
    return lengths.map((_length, index) => {
      if (index === 0) {
        return 0
      }
      return lengths.slice(0, index).reduce((accumulator, currentValue) => accumulator + currentValue, 0)
    })
  }

  /**
   * Parse chapters from a MusicBrainz Release's track list into the format used by Audiobookshelf.
   * @param {Object[]} release A MusicBrainz Release
   * @returns {Object[]}
   */
  parseChapters(release) {
    const chapters = release.media
      .reduce((mediumAccumulator, medium) => {
        return mediumAccumulator.concat(medium.tracks)
      }, [])
      .map((track) => {
        return {
          title: track.title,
          lengthMs: track.length
        }
      })
    const startOffsets = this.lengthsToStartOffsets(
      chapters.map((chapter) => {
        return chapter.lengthMs
      })
    )
    return chapters.map((chapter, index) => {
      return chapter.startOffsetMs = startOffsets[index]
    })
  }

  /**
   * Get chapters from the track list of a MusicBrainz release.
   * @param {string} id MusicBrainz Release ID
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  async getChaptersByMusicBrainzReleaseId(id, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout
    const includes = {
      inc: [
        'recordings'
      ].join('+')
    }
    const config = {
      headers: {
        'User-Agent': this.userAgentString,
        Accept: 'application/json'
      },
      timeout
    }
    return this._processRequest(this.limiter(() => axios.get(`${this.baseUrl}/release/${id}/`, { params: includes }, config))).then((response) => {
      if (!response?.data) return null
      return this.parseChapters(response.data)
    }).catch((error) => {
      Logger.error(`[MusicBrainz] error retrieving chapters`, error)
      return []
    })
  }

  /**
   * Search MusicBrainz for a matching release.
   * @param {string} title
   * @param {string} author
   * @param {string} asin The Amazon ASIN, which is different from the Audible ASIN
   * @param {string} isbn
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  async search(title, author, asin, isbn, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout
    let luceneParts = ['primarytype:Other', '(secondarytype:Audiobook OR secondarytype:"Audio drama" OR secondarytype:Spokenword)']
    if (title && title.trim().length !== 0) {
      luceneParts.push(`(release:"${this.escapeLuceneCharacters(title.trim())}" OR alias:"${this.escapeLuceneCharacters(title.trim())}")`)
    }
    if (author && author.length !== 0) {
      let authors = author.split(',')
      if (authors.length !== 0) {
        authors.forEach((a) => {
          luceneParts.push(`artistname:"${this.escapeLuceneCharacters(a.trim())}"`)
        })
      }
    }
    if (isbn) {
      luceneParts.push(`barcode:${this.escapeLuceneCharacters(isbn)}`)
    }
    if (asin) {
      luceneParts.push(`asin:${this.escapeLuceneCharacters(asin)}`)
    }

    const query = {
      query: luceneParts.join(' AND '),
      limit: 10,
      fmt: 'json'
    }
    const config = {
      headers: {
        'User-Agent': this.userAgentString,
        Accept: 'application/json'
      },
      timeout
    }

    Logger.debug(`[MusicBrainz] Search query: ${JSON.stringify(query)}`)

    try {
      let response = await this._processRequest(this.limiter(() => axios.get(`${this.baseUrl}/release/`, { params: query }, config)))
      if (!response?.data?.releases || !Array.isArray(response.data.releases)) return null
      return Promise.all(
        response.data['releases'].map(async (release) => {
          const releaseDetails = await this.getReleaseMinimal(release.id, timeout)
          Logger.debug(`[MusicBrainz] Release Details: ${JSON.stringify(releaseDetails)}`)
          function onlyUnique(value, index, array) {
            return array.indexOf(value) === index
          }
          let authors = []
          let narrators = []
          if ('authors' in releaseDetails && releaseDetails.authors !== undefined && releaseDetails.authors.length > 0) {
            authors = releaseDetails.authors
          }
          if ('narrators' in releaseDetails && releaseDetails.narrators !== undefined && releaseDetails.narrators.length > 0) {
            narrators = releaseDetails.narrators
          }
          if (authors.length === 0 || narrators.length === 0) {
            const authorsAndNarratorsFromArtistCreditOnly = this.parseArtistCredit(release['artist-credit'])
            if (authors.length === 0) {
              authors = authorsAndNarratorsFromArtistCreditOnly.authors
            }
            if (narrators.length === 0) {
              narrators = authorsAndNarratorsFromArtistCreditOnly.narrators
            }
          }
          let payload = {
            title: release?.title,
            isbn: release?.barcode,
            chapters: releaseDetails?.chapters,
            // todo Display the disambiguation comment in the Match list.
            disambiguation: release?.disambiguation,
            explicit: releaseDetails?.explicit,
            publisher: releaseDetails?.publishers,
            publishedYear: release.date ? release.date.split('-')[0] : null,
            region: release?.country,
            musicBrainzReleaseId: release?.id,
            matchConfidence: release?.score / 100.0,
            format: release['media']
              .map((medium) => {
                return medium?.format
              })
              .filter((element) => element !== undefined)
              .filter(onlyUnique)
              .join(', '),
            author: authors.join(', '),
            narrator: narrators.join(', '),
            language: release?.['text-representation']?.language,
            cover: `https://coverartarchive.org/release/${release.id}/front`,
            trackCount: release?.['track-count'],
            amazonAsin: release?.asin,
            asin: releaseDetails?.audibleAsin,
            abridged: releaseDetails?.abridged,
            genres: releaseDetails?.genres,
            tags: releaseDetails?.tags,
            series: releaseDetails?.series,
            duration: releaseDetails?.duration
          }
          // Remove undefined values
          for (const key in payload) {
            if (payload[key] === undefined) {
              delete payload[key]
            }
          }
          return payload
        })
      )
    } catch (error) {
      Logger.error(`[MusicBrainz] search request error`, error)
      return []
    }
  }

  /**
   * Internal method to process requests and retry if rate limit is exceeded.
   */
  async _processRequest(request) {
    try {
      return await request()
    } catch (error) {
      if (error.response?.status === 503) {
        const retryAfter = parseInt(error.response.headers?.['retry-after'], 10) || 5

        Logger.warn(`[MusicBrainz] Rate limit exceeded. Retrying in ${retryAfter} seconds.`)
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))

        return this._processRequest(request)
      }

      throw error
    }
  }
}
module.exports = MusicBrainz
