<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderItemMetadataUtils">
      <nuxt-link to="/config/item-metadata-utils/tags" class="block w-full rounded-sm bg-primary/40 hover:bg-primary/60 text-gray-300 hover:text-white p-4 mt-6 mb-2">
        <div class="flex justify-between">
          <p>{{ $strings.HeaderManageTags }}</p>
          <span class="material-symbols">arrow_forward</span>
        </div>
      </nuxt-link>
      <nuxt-link to="/config/item-metadata-utils/genres" class="block w-full rounded-sm bg-primary/40 hover:bg-primary/60 text-gray-300 hover:text-white p-4 my-2">
        <div class="flex justify-between">
          <p>{{ $strings.HeaderManageGenres }}</p>
          <span class="material-symbols">arrow_forward</span>
        </div>
      </nuxt-link>
      <nuxt-link to="/config/item-metadata-utils/custom-metadata-providers" class="block w-full rounded-sm bg-primary/40 hover:bg-primary/60 text-gray-300 hover:text-white p-4 my-2">
        <div class="flex justify-between">
          <p>{{ $strings.HeaderCustomMetadataProviders }}</p>
          <span class="material-symbols">arrow_forward</span>
        </div>
      </nuxt-link>
    </app-settings-content>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {}
  },
  watch: {},
  computed: {},
  methods: {
    init() {}
  },
  mounted() {
    this.init()
  },
  beforeDestroy() {}
}
</script>
