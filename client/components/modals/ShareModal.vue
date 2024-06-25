<template>
  <modals-modal ref="modal" v-model="show" name="share" :width="600" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">Share media item</p>
      </div>
    </template>
    <div class="px-6 py-8 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <template v-if="currentShare">
        <div class="w-full py-2">
          <label class="px-1 text-sm font-semibold block">Share URL</label>
          <ui-text-input v-model="currentShareUrl" readonly class="text-base h-10" />
        </div>
        <div class="w-full py-2 px-1">
          <p v-if="currentShare.expiresAt" class="text-base">Expires in {{ currentShareTimeRemaining }}</p>
          <p v-else>Permanent</p>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center justify-between space-x-4">
          <div class="w-40">
            <label class="px-1 text-sm font-semibold block">Slug</label>
            <ui-text-input v-model="newShareSlug" class="text-base h-10" />
          </div>
          <div class="flex-grow" />
          <div class="w-80">
            <label class="px-1 text-sm font-semibold block">Share Duration</label>
            <div class="inline-flex items-center space-x-2">
              <div>
                <ui-icon-btn icon="remove" :size="10" @click="clickMinus" />
              </div>
              <ui-text-input v-model="newShareDuration" type="number" text-center no-spinner class="text-center w-28 h-10 text-base" />
              <div>
                <ui-icon-btn icon="add" :size="10" @click="clickPlus" />
              </div>
              <ui-dropdown v-model="shareDurationUnit" :items="durationUnits" />
            </div>
          </div>
        </div>
        <p class="text-sm text-gray-300 py-4 px-1">
          Share URL will be: <span class="">{{ demoShareUrl }}</span>
        </p>
      </template>
      <div class="flex items-center pt-6">
        <div class="flex-grow" />
        <ui-btn v-if="currentShare" color="error" small @click="deleteShare">{{ $strings.ButtonDelete }}</ui-btn>
        <ui-btn v-if="!currentShare" color="success" small @click="openShare">{{ $strings.ButtonShare }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    libraryItem: {
      type: Object,
      default: () => null
    },
    mediaItemShare: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      processing: false,
      newShareSlug: '',
      newShareDuration: 0,
      currentShare: null,
      shareDurationUnit: 'minutes',
      durationUnits: [
        {
          text: 'Minutes',
          value: 'minutes'
        },
        {
          text: 'Hours',
          value: 'hours'
        },
        {
          text: 'Days',
          value: 'days'
        }
      ]
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
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    user() {
      return this.$store.state.user.user
    },
    demoShareUrl() {
      return `${window.origin}/share/${this.newShareSlug}`
    },
    currentShareUrl() {
      if (!this.currentShare) return ''
      return `${window.origin}/share/${this.currentShare.slug}`
    },
    currentShareTimeRemaining() {
      if (!this.currentShare) return 'Error'
      if (!this.currentShare.expiresAt) return 'Permanent'
      const msRemaining = new Date(this.currentShare.expiresAt).valueOf() - Date.now()
      if (msRemaining <= 0) return 'Expired'
      return this.$elapsedPretty(msRemaining / 1000, true)
    },
    expireDurationSeconds() {
      let shareDuration = Number(this.newShareDuration)
      if (!shareDuration || isNaN(shareDuration)) return 0
      return this.newShareDuration * (this.shareDurationUnit === 'minutes' ? 60 : this.shareDurationUnit === 'hours' ? 3600 : 86400)
    }
  },
  methods: {
    clickPlus() {
      this.newShareDuration++
    },
    clickMinus() {
      if (this.newShareDuration > 0) {
        this.newShareDuration--
      }
    },
    deleteShare() {
      if (!this.currentShare) return
      this.processing = true
      this.$axios
        .$delete(`/api/share/mediaitem/${this.currentShare.id}`)
        .then(() => {
          this.currentShare = null
          this.$emit('removed')
        })
        .catch((error) => {
          console.error('deleteShare', error)
          let errorMsg = error.response?.data || 'Failed to delete share'
          this.$toast.error(errorMsg)
        })
        .finally(() => {
          this.processing = false
        })
    },
    openShare() {
      if (!this.newShareSlug) {
        this.$toast.error('Slug is required')
        return
      }
      const payload = {
        slug: this.newShareSlug,
        mediaItemType: 'book',
        mediaItemId: this.libraryItem.media.id,
        expiresAt: this.expireDurationSeconds ? Date.now() + this.expireDurationSeconds * 1000 : 0
      }
      this.processing = true
      this.$axios
        .$post(`/api/share/mediaitem`, payload)
        .then((data) => {
          this.currentShare = data
          this.$emit('opened', data)
        })
        .catch((error) => {
          console.error('openShare', error)
          let errorMsg = error.response?.data || 'Failed to share item'
          this.$toast.error(errorMsg)
        })
        .finally(() => {
          this.processing = false
        })
    },
    init() {
      this.newShareSlug = this.$randomId(10)
      if (this.mediaItemShare) {
        this.currentShare = { ...this.mediaItemShare }
      } else {
        this.currentShare = null
      }
    }
  },
  mounted() {}
}
</script>
