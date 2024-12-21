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
      <div class="py-4">
        <p v-if="!plugins.length" class="text-gray-300">No plugins installed</p>

        <template v-for="plugin in plugins">
          <nuxt-link :key="plugin.id" :to="`/config/plugins/${plugin.id}`" class="flex items-center bg-primary rounded-md shadow-sm p-4 my-4 space-x-4">
            <p class="text-lg">{{ plugin.name }}</p>
            <p class="text-sm text-gray-300">{{ plugin.description }}</p>
            <div class="flex-grow" />
            <span class="material-symbols text-4xl">chevron_right</span>
          </nuxt-link>
        </template>
      </div>
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
