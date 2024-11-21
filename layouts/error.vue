<template>
  <div id="page-wrapper" class="text-white max-h-screen h-screen overflow-hidden">
    <div class="absolute z-0 top-0 left-0 px-6 py-3">
      <div class="flex items-center">
        <nuxt-link to="/">
          <img src="~static/icon.svg" alt="Audiobookshelf Logo" class="w-10 min-w-10 h-10" />
        </nuxt-link>
        <nuxt-link to="/">
          <h1 class="text-xl ml-4 hover:underline">audiobookshelf</h1>
        </nuxt-link>
      </div>
    </div>

    <div class="w-full h-full flex items-center justify-center">
      <div class="w-full p-2 sm:p-4 md:p-8">
        <div class="w-full p-4">
          <div class="text-center">
            <h1 class="text-4xl font-semibold text-red-500 mb-4">{{ statusCode }}</h1>
            <p class="text-xl font-semibold">{{ message }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'blank',
  props: {
    error: {
      type: Object,
      default: null
    }
  },
  computed: {
    statusCode() {
      return (this.error && this.error.statusCode) || 500
    },
    message() {
      return this.error.message || 'Unknown error'
    }
  }
}
</script>
