<template>
  <div id="page-wrapper" class="w-full h-screen overflow-y-auto">
    <div class="w-full h-full flex items-center justify-center">
      <p class="text-xl">{{ mediaItemShare.mediaItem.title }}</p>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'blank',
  async asyncData({ params, error, app }) {
    const mediaItemShare = await app.$axios.$get(`/public/share/${params.slug}`).catch((error) => {
      console.error('Failed', error)
      return null
    })
    if (!mediaItemShare) {
      return error({ statusCode: 404, message: 'Not found' })
    }

    return {
      mediaItemShare: mediaItemShare
    }
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {
    console.log('Loaded media item share', this.mediaItemShare)
  }
}
</script>
