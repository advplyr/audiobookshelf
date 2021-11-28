<template>
  <modals-modal v-model="show" name="textures" :width="'40vw'" :height="'unset'" :bg-opacity="10" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">Bookshelf Texture</p>
      </div>
    </template>
    <div class="px-4 w-full max-w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300" @mousedown.prevent @mouseup.prevent @mousemove.prevent>
      <h1 class="text-2xl mb-2">Select a bookshelf texture (For testing only)</h1>
      <div class="overflow-y-hidden overflow-x-auto">
        <div class="flex -mx-1">
          <template v-for="texture in textures">
            <div :key="texture" class="relative mx-1" style="height: 180px; width: 180px; min-width: 180px" @mousedown.prevent @mouseup.prevent>
              <img :src="texture" class="h-full object-cover cursor-pointer" @click="setTexture(texture)" />
              <div v-if="texture === selectedBookshelfTexture" class="absolute top-0 left-0 flex items-center justify-center w-full h-full bg-black bg-opacity-10">
                <span class="material-icons text-4xl text-success">check</span>
              </div>
            </div>
          </template>
        </div>
      </div>
      <!-- <div class="flex pt-4">
        <div class="flex-grow" />
        <ui-btn color="success" type="submit">Submit</ui-btn>
      </div> -->
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      textures: ['/textures/wood_default.jpg', '/textures/wood1.png', '/textures/wood2.png', '/textures/wood3.png', '/textures/wood4.png', '/textures/leather1.jpg'],
      processing: false
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showBookshelfTextureModal
      },
      set(val) {
        this.$store.commit('globals/setShowBookshelfTextureModal', val)
      }
    },
    selectedBookshelfTexture() {
      return this.$store.state.selectedBookshelfTexture
    }
  },
  methods: {
    init() {},
    setTexture(img) {
      this.$store.dispatch('setBookshelfTexture', img)
    }
  },
  mounted() {}
}
</script>
