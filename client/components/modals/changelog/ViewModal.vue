<template>
  <modals-modal v-model="show" name="changelog" :width="800" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <h1 class="text-3xl text-white truncate">Changelog</h1>
      </div>
    </template>
    <div class="px-8 py-6 w-full rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-y-scroll" style="max-height: 80vh">
      <template v-for="release in releasesToShow">
        <div :key="release.name">
          <p class="text-xl font-bold pb-4">
            Changelog <a :href="`https://github.com/advplyr/audiobookshelf/releases/tag/${release.name}`" target="_blank" class="hover:underline">{{ release.name }}</a> ({{ $formatDate(release.pubdate, dateFormat) }})
          </p>
          <div class="custom-text" v-html="getChangelog(release)" />
        </div>
        <div v-if="release !== releasesToShow[releasesToShow.length - 1]" :key="`${release.name}-divider`" class="border-b border-black-300 my-8" />
      </template>
    </div>
  </modals-modal>
</template>

<script>
import { marked } from '@/static/libs/marked/index.js'

export default {
  props: {
    value: Boolean,
    versionData: {
      type: Object,
      default: () => {}
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    },
    releasesToShow() {
      return this.versionData?.releasesToShow || []
    }
  },
  methods: {
    getChangelog(release) {
      return marked.parse(release.changelog || 'No Changelog Available', { gfm: true, breaks: true })
    }
  },
  mounted() {}
}
</script>

<style scoped>
/*
1. we need to manually define styles to apply to the parsed markdown elements,
since we don't have access to the actual elements in this component

2. v-deep allows these to take effect on the content passed in to the v-html in the div above
*/
@reference "tailwindcss";

.custom-text ::v-deep > h2 {
  @apply text-lg font-bold;
}
.custom-text ::v-deep > h3 {
  @apply text-lg font-bold;
}
.custom-text ::v-deep > ul {
  @apply list-disc list-inside pb-4;
}
</style>
