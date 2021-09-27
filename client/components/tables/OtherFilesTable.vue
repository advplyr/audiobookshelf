<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-4">Other Files</p>
      <span class="bg-black-400 rounded-xl py-1 px-2 text-sm font-mono">{{ files.length }}</span>
      <div class="flex-grow" />
      <!-- <nuxt-link :to="`/audiobook/${audiobookId}/edit`" class="mr-4">
        <ui-btn small color="primary">Manage Tracks</ui-btn>
      </nuxt-link> -->
      <div class="cursor-pointer h-10 w-10 rounded-full hover:bg-black-400 flex justify-center items-center duration-500" :class="showFiles ? 'transform rotate-180' : ''">
        <span class="material-icons text-4xl">expand_more</span>
      </div>
    </div>
    <transition name="slide">
      <div class="w-full" v-show="showFiles">
        <table class="text-sm tracksTable">
          <tr class="font-book">
            <th class="text-left">Path</th>
            <th class="text-left">Filetype</th>
          </tr>
          <template v-for="file in files">
            <tr :key="file.path">
              <td class="font-book pl-2">
                {{ file.path }}<span class="text-white text-opacity-50 pl-4">({{ file.ino }})</span>
              </td>
              <td class="text-xs">
                <p>{{ file.filetype }}</p>
              </td>
            </tr>
          </template>
        </table>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    files: {
      type: Array,
      default: () => []
    },
    audiobookId: String
  },
  data() {
    return {
      showFiles: false
    }
  },
  computed: {},
  methods: {
    clickBar() {
      this.showFiles = !this.showFiles
    }
  },
  mounted() {}
}
</script>