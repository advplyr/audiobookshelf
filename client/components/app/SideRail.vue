<template>
  <div class="w-20 bg-bg h-full relative box-shadow-side z-30" style="min-width: 80px">
    <div class="absolute top-0 -right-4 w-4 bg-bg h-10 pointer-events-none" />
    <nuxt-link :to="`/library/${currentLibraryId}`" class="w-full h-20 flex flex-col items-center justify-center text-white border-b border-primary border-opacity-70 hover:bg-primary cursor-pointer relative" :class="homePage ? 'bg-primary bg-opacity-80' : 'bg-bg bg-opacity-60'">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>

      <p class="font-book pt-1.5" style="font-size: 1rem">Home</p>

      <div v-show="homePage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link>

    <nuxt-link :to="`/library/${currentLibraryId}/bookshelf`" class="w-full h-20 flex flex-col items-center justify-center text-white border-b border-primary border-opacity-70 hover:bg-primary cursor-pointer relative" :class="paramId === '' && !homePage ? 'bg-primary bg-opacity-80' : 'bg-bg bg-opacity-60'">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>

      <p class="font-book pt-1.5" style="font-size: 1rem">Library</p>

      <div v-show="paramId === '' && !homePage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link>

    <nuxt-link :to="`/library/${currentLibraryId}/bookshelf/series`" class="w-full h-20 flex flex-col items-center justify-center text-white text-opacity-80 border-b border-primary border-opacity-70 hover:bg-primary cursor-pointer relative" :class="paramId === 'series' ? 'bg-primary bg-opacity-80' : 'bg-bg bg-opacity-60'">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>

      <p class="font-book pt-1.5" style="font-size: 1rem">Series</p>

      <div v-show="paramId === 'series'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link>

    <!-- <nuxt-link to="/library/collections" class="w-full h-20 flex flex-col items-center justify-center text-white text-opacity-80 border-b border-primary border-opacity-70 hover:bg-primary cursor-pointer relative" :class="paramId === 'collections' ? 'bg-primary bg-opacity-80' : 'bg-bg bg-opacity-60'">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>

      <p class="font-book pt-1.5" style="font-size: 0.8rem">Collections</p>

      <div v-show="paramId === 'collections'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link> -->

    <!-- <nuxt-link to="/library/tags" class="w-full h-20 flex flex-col items-center justify-center text-white text-opacity-80 border-b border-primary border-opacity-70 hover:bg-primary cursor-pointer relative" :class="paramId === 'tags' ? 'bg-primary bg-opacity-80' : 'bg-bg bg-opacity-60'">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>

      <p class="font-book pt-1.5" style="font-size: 0.8rem">Tags</p>

      <div v-show="paramId === 'tags'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link> -->

    <!-- <nuxt-link to="/library/authors" class="w-full h-20 flex flex-col items-center justify-center text-white text-opacity-80 border-b border-primary border-opacity-70 hover:bg-primary cursor-pointer relative" :class="paramId === 'authors' ? 'bg-primary bg-opacity-80' : 'bg-bg bg-opacity-60'">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>

      <p class="font-book pt-1.5" style="font-size: 0.8rem">Authors</p>

      <div v-show="paramId === 'authors'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link> -->
  </div>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {
    paramId() {
      return this.$route.params ? this.$route.params.id || '' : ''
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    selectedClassName() {
      return ''
    },
    homePage() {
      return this.$route.name === 'library-library'
    }
  },
  methods: {},
  mounted() {}
}
</script>