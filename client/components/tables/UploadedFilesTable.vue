<template>
  <div class="w-full my-4">
    <div class="w-full bg-primary px-6 py-1 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-4">{{ title }}</p>
      <span class="bg-black-400 rounded-xl py-0.5 px-2 text-sm font-mono">{{ files.length }}</span>
      <div class="grow" />
      <div class="cursor-pointer h-9 w-9 rounded-full hover:bg-black-400 flex justify-center items-center duration-500" :class="expand ? 'transform rotate-180' : ''">
        <span class="material-symbols text-3xl">expand_more</span>
      </div>
    </div>
    <transition name="slide">
      <div class="w-full" v-show="expand">
        <table class="text-sm tracksTable">
          <tr>
            <th class="text-left">{{ $strings.LabelFilename }}</th>
            <th class="text-left">{{ $strings.LabelSize }}</th>
            <th class="text-left">{{ $strings.LabelType }}</th>
          </tr>
          <template v-for="file in files">
            <tr :key="file.path">
              <td class="pl-2">
                {{ file.name }}
              </td>
              <td class="font-mono">
                {{ $bytesPretty(file.size) }}
              </td>
              <td>
                {{ file.filetype }}
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
    title: String,
    files: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      expand: false
    }
  },
  computed: {},
  methods: {
    clickBar() {
      this.expand = !this.expand
    }
  },
  mounted() {}
}
</script>