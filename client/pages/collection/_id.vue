<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden" :class="streamAudiobook ? 'streaming' : ''">
    <div class="w-full h-full overflow-y-auto px-2 py-6 md:p-8">
      <div class="flex flex-col sm:flex-row max-w-6xl mx-auto">
        <div class="w-full flex justify-center md:block sm:w-32 md:w-52" style="min-width: 208px">
          <div class="relative" style="height: fit-content">
            <cards-group-cover :name="collectionName" type="collection" :book-items="bookItems" :width="176" :height="176" />
          </div>
        </div>
        <div class="flex-grow px-2 py-6 md:py-0 md:px-10">
          <div class="flex">
            <div class="mb-4">
              <div class="flex sm:items-end flex-col sm:flex-row">
                <h1 class="text-2xl md:text-3xl font-sans">
                  {{ collectionName }}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }
    var collection = await app.$axios.$get(`/api/collection/${params.id}`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!collection) {
      return redirect('/')
    }
    store.commit('user/addUpdateCollection', collection)
    return {
      collection
    }
  },
  data() {
    return {}
  },
  computed: {
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    bookItems() {
      return this.collection.books || []
    },
    collectionName() {
      return this.collection.name || ''
    }
  },
  methods: {},
  mounted() {}
}
</script>