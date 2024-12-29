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
          <span class="material-symbols text-3xl">arrow_back</span>
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
              <p class="text-center text-gray-200">{{ $strings.LabelNew }}</p>
              <a :href="selectedMatch.cover" target="_blank" class="bg-primary">
                <covers-preview-cover :src="selectedMatch.cover" :width="100" :book-cover-aspect-ratio="bookCoverAspectRatio" />
              </a>
            </div>
            <div v-if="media.coverPath" class="ml-0.5">
              <p class="text-center text-gray-200">{{ $strings.LabelCurrent }}</p>
              <a :href="$store.getters['globals/getLibraryItemCoverSrc'](libraryItem, null, true)" target="_blank" class="bg-primary">
                <covers-preview-cover :src="$store.getters['globals/getLibraryItemCoverSrc'](libraryItem, null, true)" :width="100" :book-cover-aspect-ratio="bookCoverAspectRatio" />
              </a>
            </div>
          </div>
        </div>
        <div v-if="selectedMatchOrig.title" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.title" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.title" :disabled="!selectedMatchUsage.title" :label="$strings.LabelTitle" />
            <p v-if="mediaMetadata.title" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('title', mediaMetadata.title)">{{ mediaMetadata.title || '' }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.subtitle" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.subtitle" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.subtitle" :disabled="!selectedMatchUsage.subtitle" :label="$strings.LabelSubtitle" />
            <p v-if="mediaMetadata.subtitle" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('subtitle', mediaMetadata.subtitle)">{{ mediaMetadata.subtitle }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.author" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.author" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.author" :disabled="!selectedMatchUsage.author" :label="$strings.LabelAuthor" />
            <p v-if="mediaMetadata.authorName" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('author', mediaMetadata.authorName)">{{ mediaMetadata.authorName }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.narrator" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.narrator" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-multi-select v-model="selectedMatch.narrator" :items="narrators" :disabled="!selectedMatchUsage.narrator" :label="$strings.LabelNarrators" />
            <p v-if="mediaMetadata.narratorName" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('narrator', mediaMetadata.narrators)">{{ mediaMetadata.narratorName }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.description" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.description" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-textarea-with-label v-model="selectedMatch.description" :rows="3" :disabled="!selectedMatchUsage.description" :label="$strings.LabelDescription" />
            <p v-if="mediaMetadata.description" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('description', mediaMetadata.description)">{{ mediaMetadata.description.substr(0, 100) + (mediaMetadata.description.length > 100 ? '...' : '') }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.publisher" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.publisher" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.publisher" :disabled="!selectedMatchUsage.publisher" :label="$strings.LabelPublisher" />
            <p v-if="mediaMetadata.publisher" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('publisher', mediaMetadata.publisher)">{{ mediaMetadata.publisher }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.publishedYear" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.publishedYear" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.publishedYear" :disabled="!selectedMatchUsage.publishedYear" :label="$strings.LabelPublishYear" />
            <p v-if="mediaMetadata.publishedYear" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('publishedYear', mediaMetadata.publishedYear)">{{ mediaMetadata.publishedYear }}</a>
            </p>
          </div>
        </div>

        <div v-if="selectedMatchOrig.series" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.series" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <widgets-series-input-widget v-model="selectedMatch.series" :disabled="!selectedMatchUsage.series" />
            <p v-if="mediaMetadata.seriesName" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('series', mediaMetadata.series)">{{ mediaMetadata.seriesName }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.genres?.length" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.genres" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-multi-select v-model="selectedMatch.genres" :items="genres" :disabled="!selectedMatchUsage.genres" :label="$strings.LabelGenres" />
            <p v-if="mediaMetadata.genres?.length" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('genres', mediaMetadata.genres)">{{ mediaMetadata.genres.join(', ') }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.tags" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.tags" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-multi-select v-model="selectedMatch.tags" :items="tags" :disabled="!selectedMatchUsage.tags" :label="$strings.LabelTags" />
            <p v-if="media.tags?.length" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('tags', media.tags)">{{ media.tags.join(', ') }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.language" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.language" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.language" :disabled="!selectedMatchUsage.language" :label="$strings.LabelLanguage" />
            <p v-if="mediaMetadata.language" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('language', mediaMetadata.language)">{{ mediaMetadata.language }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.isbn" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.isbn" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.isbn" :disabled="!selectedMatchUsage.isbn" label="ISBN" />
            <p v-if="mediaMetadata.isbn" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('isbn', mediaMetadata.isbn)">{{ mediaMetadata.isbn }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.asin" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.asin" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.asin" :disabled="!selectedMatchUsage.asin" label="ASIN" />
            <p v-if="mediaMetadata.asin" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('asin', mediaMetadata.asin)">{{ mediaMetadata.asin }}</a>
            </p>
          </div>
        </div>

        <div v-if="selectedMatchOrig.itunesId" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.itunesId" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.itunesId" type="number" :disabled="!selectedMatchUsage.itunesId" label="iTunes ID" />
            <p v-if="mediaMetadata.itunesId" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('itunesId', mediaMetadata.itunesId)">{{ mediaMetadata.itunesId }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.feedUrl" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.feedUrl" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.feedUrl" :disabled="!selectedMatchUsage.feedUrl" label="RSS Feed URL" />
            <p v-if="mediaMetadata.feedUrl" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('feedUrl', mediaMetadata.feedUrl)">{{ mediaMetadata.feedUrl }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.itunesPageUrl" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.itunesPageUrl" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.itunesPageUrl" :disabled="!selectedMatchUsage.itunesPageUrl" label="iTunes Page URL" />
            <p v-if="mediaMetadata.itunesPageUrl" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('itunesPageUrl', mediaMetadata.itunesPageUrl)">{{ mediaMetadata.itunesPageUrl }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.releaseDate" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.releaseDate" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.releaseDate" :disabled="!selectedMatchUsage.releaseDate" :label="$strings.LabelReleaseDate" />
            <p v-if="mediaMetadata.releaseDate" class="text-xs ml-1 text-white text-opacity-60">
              {{ $strings.LabelCurrently }} <a :title="$strings.LabelClickToUseCurrentValue" class="cursor-pointer hover:underline" @click.stop="setMatchFieldValue('releaseDate', mediaMetadata.releaseDate)">{{ mediaMetadata.releaseDate }}</a>
            </p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.explicit != null" class="flex items-center pb-2" :class="{ 'pt-2': mediaMetadata.explicit == null }">
          <ui-checkbox v-model="selectedMatchUsage.explicit" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4" :class="{ 'pt-4': mediaMetadata.explicit != null }">
            <ui-checkbox v-model="selectedMatch.explicit" :label="$strings.LabelExplicit" :disabled="!selectedMatchUsage.explicit" :checkbox-bg="!selectedMatchUsage.explicit ? 'bg' : 'primary'" border-color="gray-600" label-class="pl-2 text-base font-semibold" />
            <p v-if="mediaMetadata.explicit != null" class="text-xs ml-1 text-white text-opacity-60">{{ $strings.LabelCurrently }} {{ mediaMetadata.explicit ? $strings.LabelExplicitChecked : $strings.LabelExplicitUnchecked }}</p>
          </div>
        </div>
        <div v-if="selectedMatchOrig.abridged != null" class="flex items-center pb-2" :class="{ 'pt-2': mediaMetadata.abridged == null }">
          <ui-checkbox v-model="selectedMatchUsage.abridged" checkbox-bg="bg" @input="checkboxToggled" />
          <div class="flex-grow ml-4" :class="{ 'pt-4': mediaMetadata.abridged != null }">
            <ui-checkbox v-model="selectedMatch.abridged" :label="$strings.LabelAbridged" :disabled="!selectedMatchUsage.abridged" :checkbox-bg="!selectedMatchUsage.abridged ? 'bg' : 'primary'" border-color="gray-600" label-class="pl-2 text-base font-semibold" />
            <p v-if="mediaMetadata.abridged != null" class="text-xs ml-1 text-white text-opacity-60">{{ $strings.LabelCurrently }} {{ mediaMetadata.abridged ? $strings.LabelAbridgedChecked : $strings.LabelAbridgedUnchecked }}</p>
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
    filterData() {
      return this.$store.state.libraries.filterData || {}
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
    narrators() {
      return this.filterData.narrators || []
    },
    genres() {
      const currentGenres = this.filterData.genres || []
      const selectedMatchGenres = this.selectedMatch.genres || []
      return [...new Set([...currentGenres, ...selectedMatchGenres])]
    },
    tags() {
      return this.filterData.tags || []
    }
  },
  methods: {
    setMatchFieldValue(field, value) {
      if (Array.isArray(value)) {
        this.selectedMatch[field] = [...value]
      } else {
        this.selectedMatch[field] = value
      }
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
        this.$toast.warning(this.$strings.ToastTitleRequired)
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
        if (match.tags && !Array.isArray(match.tags)) {
          match.tags = match.tags.split(',').map((g) => g.trim())
        }
        if (match.narrator && !Array.isArray(match.narrator)) {
          match.narrator = match.narrator.split(',').map((g) => g.trim())
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
            updatePayload.metadata.narrators = this.selectedMatch[key]
          } else if (key === 'genres') {
            updatePayload.metadata.genres = [...this.selectedMatch[key]]
          } else if (key === 'tags') {
            updatePayload.tags = this.selectedMatch[key]
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
            this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
          }
          this.clearSelectedMatch()
          this.$emit('selectTab', 'details')
        } else {
          this.$toast.error(this.$strings.ToastFailedToUpdate)
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

<style>
.matchListWrapper {
  height: calc(100% - 124px);
}

@media (min-width: 768px) {
  .matchListWrapper {
    height: calc(100% - 80px);
  }
}
</style>
