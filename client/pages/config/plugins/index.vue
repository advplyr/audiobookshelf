<template>
  <div>
    <app-settings-content :header-text="'Plugins'">
      <template #header-items>
        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>
      </template>

      <h2 class="text-xl font-medium">Installed Plugins</h2>
      <template v-for="plugin in plugins">
        <nuxt-link :key="plugin.slug" :to="`/config/plugins/${plugin.slug}`" class="flex items-center bg-primary rounded-md shadow-sm p-4 my-4 space-x-4">
          <p class="text-lg">{{ plugin.name }}</p>
          <p class="text-sm text-gray-300">{{ plugin.description }}</p>
          <div class="flex-grow" />
          <span class="material-symbols text-4xl">chevron_right</span>
        </nuxt-link>
      </template>
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
  computed: {
    plugins() {
      return this.$store.state.plugins
    }
  },
  methods: {},
  mounted() {},
  beforeDestroy() {}
}
</script>
