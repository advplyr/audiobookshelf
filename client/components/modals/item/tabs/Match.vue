<template>
  <div id="match-wrapper" class="w-full h-full overflow-hidden px-2 md:px-4 py-4 md:py-6 relative">
    <form @submit.prevent="submitSearch">
      <div class="flex flex-wrap md:flex-nowrap items-center justify-start -mx-1">
        <div class="w-36 px-1">
          <ui-dropdown v-model="provider" :items="providers" :label="$strings.LabelProvider" small />
        </div>
        <div class="flex-grow md:w-72 px-1">
          <ui-text-input-with-label v-model="searchTitle" :label="searchTitleLabel" :placeholder="$strings.PlaceholderSearch" />
        </div>
        <div v-show="provider != 'itunes'" class="w-60 md:w-72 px-1">
          <ui-text-input-with-label v-model="searchAuthor" :label="$strings.LabelAuthor" />
        </div>
        <ui-btn class="mt-5 ml-1" type="submit">{{ $strings.ButtonSearch }}</ui-btn>
      </div>
    </form>
    <div v-show="processing" class="flex h-full items-center justify-center">
      <p>{{ $strings.MessageLoading }}</p>
    </div>
    <div v-show="!processing && !searchResults.length && hasSearched" class="flex h-full items-center justify-center">
      <p>{{ $strings.MessageNoResults }}</p>
    </div>
    <div v-show="!processing" class="w-full max-h-full overflow-y-auto overflow-x-hidden matchListWrapper mt-4">
      <template v-for="(res, index) in searchResults">
        <cards-book-match-card :key="index" :book="res" :current-book-duration="currentBookDuration" :is-podcast="isPodcast" :book-cover-aspect-ratio="bookCoverAspectRatio" @select="selectMatch" />
      </template>
    </div>
    <div v-if="selectedMatchOrig" class="absolute top-0 left-0 w-full bg-bg h-full px-2 py-6 md:p-8 max-h-full overflow-y-auto overflow-x-hidden">
      <div class="flex mb-4">
        <div class="w-8 h-8 rounded-full hover:bg-white hover:bg-opacity-10 flex items-center justify-center cursor-pointer" @click="clearSelectedMatch">
          <span class="material-icons text-3xl">arrow_back</span>
        </div>
        <p class="text-xl pl-3">{{ $strings.HeaderUpdateDetails }}</p>
      </div>
      <ui-checkbox v-model="selectAll" :label="$strings.LabelSelectAll" checkbox-bg="bg" @input="selectAllToggled" />
      <form @submit.prevent="submitMatchUpdate">
        <div v-if="selectedMatchOrig.cover" class="flex flex-wrap md:flex-nowrap items-center justify-center">
          <div class="flex flex-grow items-center py-2">
            <ui-checkbox v-model="selectedMatchUsage.cover" checkbox-bg="bg" @input="checkboxToggled" />
            <ui-text-input-with-label v-model="selectedMatch.cover" :disabled="!selectedMatchUsage.cover" readonly :label="$strings.LabelCover" class="flex-grow mx-4" />
          </div>

          <div class="flex py-2">
            <div>
              <p class="text-center text-gray-200">New</p>
              <a :href="selectedMatch.cover" target="_blank" class="bg-primary">
                <covers-preview-cover :src="selectedMatch.cover" :width="100" :book-cover-aspect-ratio="bookCoverAspectRatio" />
              </a>
            </div>
            <div v-if="media.coverPath" class="ml-0.5">
              <p class="text-center text-gray-200">Current</p>
              <a :href="$store.getters['globals/getLibraryItemCoverSrc'](libraryItem, null, true)" target="_blank" class="bg-primary">
                <covers-preview-cover :src="$store.getters['globals/getLibraryItemCoverSrc'](libraryItem, null, true)" :width="100" :book-cover-aspect-ratio="bookCoverAspectRatio" />
              </a>
            </div>
          </div>
          </div>

        <div 
           v-for="item in [
             {originalValue: mediaMetadata.title,        key: 'title',        component: 'ui-text-input-with-label', props: {label: $strings.LabelTitle}},
             {originalValue: mediaMetadata.subtitle,     key: 'subtitle',     component: 'ui-text-input-with-label', props: {label: $strings.LabelSubtitle}},
             {originalValue: mediaMetadata.authorName,   key: 'author',       component: 'ui-text-input-with-label', props: {label: $strings.LabelAuthor}},
             {originalValue: mediaMetadata.narratorName, key: 'narrator',     component: 'ui-text-input-with-label', props: {label: $strings.LabelNarrators}},
             {originalValue: mediaMetadata.description,  key: 'description',  component: 'ui-textarea-with-label',   props: {label: $strings.LabelDescription}},
             {originalValue: mediaMetadata.publisher,    key: 'publisher',    component: 'ui-text-input-with-label', props: {label: $strings.LabelPublisher}},
             {originalValue: mediaMetadata.publishedYear,key: 'publishedYear',component: 'ui-text-input-with-label', props: {label: $strings.LabelPublishYear}},
             {originalValue: mediaMetadata.seriesName,   key: 'series',       component: 'widgets-series-input-widget'},
             {originalValue: mediaMetadata.genres,       key: 'genres',       component: 'ui-multi-select',          props: {label: $strings.LabelGenres, items: genres}},
             {originalValue: media.tags,                 key: 'tags',         component: 'ui-text-input-with-label', props: {label: $strings.LabelTags}},
             {originalValue: mediaMetadata.language,     key: 'language',     component: 'ui-text-input-with-label', props: {label: $strings.LabelLanguage}},
             {originalValue: mediaMetadata.isbn,         key: 'isbn',         component: 'ui-text-input-with-label', props: {label: 'ISBN'}},
             {originalValue: mediaMetadata.asin,         key: 'asin',         component: 'ui-text-input-with-label', props: {label: 'ASIN'}},
             {originalValue: mediaMetadata.itunesId,     key: 'itunesId',     component: 'ui-text-input-with-label', props: {label: 'iTunes ID'}},
             {originalValue: mediaMetadata.feedUrl,      key: 'feedUrl',      component: 'ui-text-input-with-label', props: {label: 'RSS Feed URL'}},
             {originalValue: mediaMetadata.itunesPageUrl,key: 'itunesPageUrl',component: 'ui-text-input-with-label', props: {label: 'iTunes Page URL'}},
             {originalValue: mediaMetadata.releaseDate,  key: 'releaseDate',  component: 'ui-text-input-with-label', props: {label: $strings.LabelReleaseDate}},
             {originalValue: mediaMetadata.explicit,     key: 'explicit',     component: 'ui-checkbox',              props: {label: $strings.LabelExplicit}, originalValueLabel: mediaMetadata.explicit ? 'explicit (checked)' : 'Not Explicit (unchecked)'}, 
             {originalValue: mediaMetadata.abridged,     key: 'abridged',     component: 'ui-checkbox',              props: {label: $strings.LabelAbridged}, originalValueLabel: mediaMetadata.abridged ? 'Abridged (checked)' : 'Unabridged (unchecked)'},
             ]"
           :key="item.key" 
            @checkbox-toggled="checkboxToggled">
          <div v-if="shouldRender(selectedMatch[item.key])" class="flex items-center py-2">
            <ui-checkbox v-model="selectedMatchUsage[item.key]" checkbox-bg="bg" :check-color="isChanged(item.originalValue, item.key) ? 'text-green-500' : 'text-green-600'" :border-color="isChanged(item.originalValue, item.key) ? 'gray-400' : 'gray-600'" @input="$emit('checkbox-toggled')" />
            <div class="flex-grow ml-4 min-w-0" :class="{ 'pt-4': typeof item.originalValue == 'boolean', 'hasNewValue': isChanged(item.originalValue, item.key) }">
              <component :is="item.component" v-bind="item.props" v-model="selectedMatch[item.key]" :disabled="!selectedMatchUsage[item.key]" :checkbox-bg="!selectedMatchUsage[item.key] ? 'bg' : 'primary'" border-color="gray-600" label-class="pl-2 text-base font-semibold" />
              <p v-if="shouldRender(item.originalValue)" class="text-xs ml-1 text-white text-opacity-60 truncate ..."  :title="valueToString(item.originalValue, item.key)"> {{ $strings.LabelCurrently }} {{ item.originalValueLabel || valueToString(item.originalValue, item.key) }} </p>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end py-2">
          <ui-btn color="success" type="submit">{{ $strings.ButtonSubmit }}</ui-btn>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      libraryItemId: null,
      searchTitle: null,
      searchAuthor: null,
      lastSearch: null,
      provider: 'google',
      searchResults: [],
      hasSearched: false,
      selectedMatch: null,
      selectedMatchOrig: null,
      selectedMatchUsage: {
        title: true,
        subtitle: true,
        cover: true,
        author: true,
        narrator: true,
        description: true,
        publisher: true,
        publishedYear: true,
        series: true,
        genres: true,
        tags: true,
        language: true,
        explicit: true,
        asin: true,
        isbn: true,
        abridged: true,
        // Podcast specific
        itunesPageUrl: true,
        itunesId: true,
        feedUrl: true,
        releaseDate: true
      },
      selectAll: true
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    isProcessing: {
      get() {
        return this.processing
      },
      set(val) {
        this.$emit('update:processing', val)
      }
    },
    seriesItems: {
      get() {
        return this.selectedMatch.series.map((se) => {
          return {
            id: `new-${Math.floor(Math.random() * 10000)}`,
            displayName: se.sequence ? `${se.series} #${se.sequence}` : se.series,
            name: se.series,
            sequence: se.sequence || ''
          }
        })
      },
      set(val) {
        this.selectedMatch.series = val
      }
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    providers() {
      if (this.isPodcast) return this.$store.state.scanners.podcastProviders
      return this.$store.state.scanners.providers
    },
    searchTitleLabel() {
      if (this.provider.startsWith('audible')) return this.$strings.LabelSearchTitleOrASIN
      else if (this.provider == 'itunes') return this.$strings.LabelSearchTerm
      return this.$strings.LabelSearchTitle
    },
    media() {
      return this.libraryItem?.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    currentBookDuration() {
      if (this.isPodcast) return 0
      return this.media.duration || 0
    },
    mediaType() {
      return this.libraryItem?.mediaType || null
    },
    isPodcast() {
      return this.mediaType == 'podcast'
    },
    genres() {
      const filterData = this.$store.state.libraries.filterData || {}
      const currentGenres = filterData.genres || []
      const selectedMatchGenres = this.selectedMatch.genres || []
      return [...new Set([...currentGenres, ...selectedMatchGenres])]
    }
  },
  methods: {
    valueToString(value, key) {
      if (Array.isArray(value) && key === 'series') {
        return  value.map(item => item.displayName).join(",")
      } else if (Array.isArray(value)) {
        return value.join(', ')
      } else if (typeof value == "boolean") {
        return value
      } else {
        // strip html tags for rich text descriptions
        return value.replace(/(<([^>]+)>)/gi, "") || '' 
      }
    },
    shouldRender(value) {
     if (typeof value == "boolean") {
      return value != null
    } else {
      return value && value.length
    }
    },
    isChanged(originalValue, key) {
      return this.valueToString(originalValue, key) != this.valueToString(this.selectedMatch[key], key)
    },
    selectAllToggled(val) {
      for (const key in this.selectedMatchUsage) {
        this.selectedMatchUsage[key] = val
      }
    },
    checkboxToggled() {
      this.selectAll = Object.values(this.selectedMatchUsage).findIndex((v) => v == false) < 0
    },
    persistProvider() {
      try {
        localStorage.setItem('book-provider', this.provider)
      } catch (error) {
        console.error('PersistProvider', error)
      }
    },
    getDefaultBookProvider() {
      let provider = localStorage.getItem('book-provider')
      if (!provider) return 'google'
      // Validate book provider
      if (!this.$store.getters['scanners/checkBookProviderExists'](provider)) {
        console.error('Stored book provider does not exist', provider)
        localStorage.removeItem('book-provider')
        return 'google'
      }
      return provider
    },
    getSearchQuery() {
      if (this.isPodcast) return `term=${encodeURIComponent(this.searchTitle)}`
      var searchQuery = `provider=${this.provider}&fallbackTitleOnly=1&title=${encodeURIComponent(this.searchTitle)}`
      if (this.searchAuthor) searchQuery += `&author=${encodeURIComponent(this.searchAuthor)}`
      if (this.libraryItemId) searchQuery += `&id=${this.libraryItemId}`
      return searchQuery
    },
    submitSearch() {
      if (!this.searchTitle) {
        this.$toast.warning('Search title is required')
        return
      }
      this.persistProvider()
      this.runSearch()
    },
    async runSearch() {
      const searchQuery = this.getSearchQuery()
      if (this.lastSearch === searchQuery) return
      this.searchResults = []
      this.isProcessing = true
      this.lastSearch = searchQuery
      const searchEntity = this.isPodcast ? 'podcast' : 'books'
      let results = await this.$axios.$get(`/api/search/${searchEntity}?${searchQuery}`, { timeout: 20000 }).catch((error) => {
        console.error('Failed', error)
        return []
      })
      // console.log('Got search results', results)
      results = (results || []).filter((res) => {
        return !!res.title
      })

      if (this.isPodcast) {
        // Map to match PodcastMetadata keys
        results = results.map((res) => {
          res.itunesPageUrl = res.pageUrl || null
          res.itunesId = res.id || null
          res.author = res.artistName || null
          res.explicit = res.explicit || false
          return res
        })
      }

      this.searchResults = results || []
      this.isProcessing = false
      this.hasSearched = true
    },
    initSelectedMatchUsage() {
      this.selectedMatchUsage = {
        title: true,
        subtitle: true,
        cover: true,
        author: true,
        narrator: true,
        description: true,
        publisher: true,
        publishedYear: true,
        series: true,
        genres: true,
        tags: true,
        language: true,
        explicit: true,
        asin: true,
        isbn: true,
        abridged: true,
        // Podcast specific
        itunesPageUrl: true,
        itunesId: true,
        feedUrl: true,
        releaseDate: true
      }

      // Load saved selected match from local storage
      try {
        let savedSelectedMatchUsage = localStorage.getItem('selectedMatchUsage')
        if (!savedSelectedMatchUsage) return
        savedSelectedMatchUsage = JSON.parse(savedSelectedMatchUsage)

        for (const key in savedSelectedMatchUsage) {
          if (this.selectedMatchUsage[key] !== undefined) {
            this.selectedMatchUsage[key] = !!savedSelectedMatchUsage[key]
          }
        }
      } catch (error) {
        console.error('Failed to load saved selectedMatchUsage', error)
      }

      this.checkboxToggled()
    },
    init() {
      this.clearSelectedMatch()
      this.initSelectedMatchUsage()

      if (this.libraryItem.id !== this.libraryItemId) {
        this.searchResults = []
        this.hasSearched = false
        this.libraryItemId = this.libraryItem.id
      }

      if (!this.libraryItem.media || !this.libraryItem.media.metadata.title) {
        this.searchTitle = null
        this.searchAuthor = null
        return
      }
      this.searchTitle = this.libraryItem.media.metadata.title
      this.searchAuthor = this.libraryItem.media.metadata.authorName || ''
      if (this.isPodcast) this.provider = 'itunes'
      else {
        this.provider = this.getDefaultBookProvider()
      }

      // Prefer using ASIN if set and using audible provider
      if (this.provider.startsWith('audible') && this.libraryItem.media.metadata.asin) {
        this.searchTitle = this.libraryItem.media.metadata.asin
        this.searchAuthor = ''
      }

      if (this.searchTitle) {
        this.submitSearch()
      }
    },
    selectMatch(match) {
      if (match) {
        if (match.series) {
          if (!match.series.length) {
            delete match.series
          } else {
            match.series = match.series.map((se) => {
              return {
                id: `new-${Math.floor(Math.random() * 10000)}`,
                displayName: se.sequence ? `${se.series} #${se.sequence}` : se.series,
                name: se.series,
                sequence: se.sequence || ''
              }
            })
          }
        }
        if (match.genres && !Array.isArray(match.genres)) {
          // match.genres = match.genres.join(',')
          match.genres = match.genres.split(',').map((g) => g.trim())
        }
      }

      console.log('Select Match', match)
      this.selectedMatch = match
      this.selectedMatchOrig = JSON.parse(JSON.stringify(match))
    },
    buildMatchUpdatePayload() {
      var updatePayload = {}
      updatePayload.metadata = {}

      for (const key in this.selectedMatchUsage) {
        if (this.selectedMatchUsage[key] && this.selectedMatch[key]) {
          if (key === 'series') {
            if (!Array.isArray(this.selectedMatch[key])) {
              console.error('Invalid series in selectedMatch', this.selectedMatch[key])
            } else {
              var seriesPayload = []
              this.selectedMatch[key].forEach((seriesItem) =>
                seriesPayload.push({
                  id: seriesItem.id,
                  name: seriesItem.name,
                  sequence: seriesItem.sequence
                })
              )
              updatePayload.metadata.series = seriesPayload
            }
          } else if (key === 'author' && !this.isPodcast) {
            var authors = this.selectedMatch[key]
            if (!Array.isArray(authors)) {
              authors = authors
                .split(',')
                .map((au) => au.trim())
                .filter((au) => !!au)
            }
            var authorPayload = []
            authors.forEach((authorName) =>
              authorPayload.push({
                id: `new-${Math.floor(Math.random() * 10000)}`,
                name: authorName
              })
            )
            updatePayload.metadata.authors = authorPayload
          } else if (key === 'narrator') {
            updatePayload.metadata.narrators = this.selectedMatch[key].split(',').map((v) => v.trim())
          } else if (key === 'genres') {
            updatePayload.metadata.genres = [...this.selectedMatch[key]]
          } else if (key === 'tags') {
            updatePayload.tags = this.selectedMatch[key].split(',').map((v) => v.trim())
          } else if (key === 'itunesId') {
            updatePayload.metadata.itunesId = Number(this.selectedMatch[key])
          } else {
            updatePayload.metadata[key] = this.selectedMatch[key]
          }
        }
      }

      return updatePayload
    },
    async submitMatchUpdate() {
      var updatePayload = this.buildMatchUpdatePayload()
      if (!Object.keys(updatePayload).length) {
        return
      }

      console.log('Match payload', updatePayload)
      this.isProcessing = true

      // Persist in local storage
      localStorage.setItem('selectedMatchUsage', JSON.stringify(this.selectedMatchUsage))

      if (Object.keys(updatePayload).length) {
        if (updatePayload.metadata.cover) {
          updatePayload.url = updatePayload.metadata.cover
          delete updatePayload.metadata.cover
        }
        const mediaUpdatePayload = updatePayload
        const updateResult = await this.$axios.$patch(`/api/items/${this.libraryItemId}/media`, mediaUpdatePayload).catch((error) => {
          console.error('Failed to update', error)
          return false
        })
        if (updateResult) {
          if (updateResult.updated) {
            this.$toast.success(this.$strings.ToastItemDetailsUpdateSuccess)
          } else {
            this.$toast.info(this.$strings.ToastItemDetailsUpdateUnneeded)
          }
          this.clearSelectedMatch()
          this.$emit('selectTab', 'details')
        } else {
          this.$toast.error(this.$strings.ToastItemDetailsUpdateFailed)
        }
      } else {
        this.clearSelectedMatch()
      }

      this.isProcessing = false
    },
    clearSelectedMatch() {
      this.selectedMatch = null
      this.selectedMatchOrig = null
    }
  }
}
</script>

<style lang="postcss" scoped>
.matchListWrapper {
  height: calc(100% - 124px);
}

@media (min-width: 768px) {
  .matchListWrapper {
    height: calc(100% - 80px);
  }
}

::v-deep .hasNewValue * {
  @apply text-green-500
}
</style>
