<template>
  <modals-modal ref="modal" v-model="show" name="share" :width="600" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.LabelShare }}</p>
      </div>
    </template>
    <div class="px-6 py-8 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div class="absolute top-0 right-0 p-4">
        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides/media-item-shares" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>
      </div>
      <template v-if="currentShare">
        <div class="w-full py-2">
          <label class="px-1 text-sm font-semibold block">{{ $strings.LabelShareURL }}</label>
          <ui-text-input v-model="currentShareUrl" show-copy readonly />
        </div>
        <div class="w-full py-2 px-1">
          <p v-if="currentShare.isDownloadable" class="text-sm mb-2">{{ $strings.LabelDownloadable }}</p>
          <p v-if="currentShare.expiresAt">{{ $getString('MessageShareExpiresIn', [currentShareTimeRemaining]) }}</p>
          <p v-else>{{ $strings.LabelPermanent }}</p>
        </div>
      </template>
      <template v-else>
        <div class="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4 mb-2">
          <div class="w-full sm:w-48">
            <label class="px-1 text-sm font-semibold block">{{ $strings.LabelSlug }}</label>
            <ui-text-input v-model="newShareSlug" class="text-base h-10" />
          </div>
          <div class="grow" />
          <div class="w-full sm:w-80">
            <label class="px-1 text-sm font-semibold block">{{ $strings.LabelDuration }}</label>
            <div class="inline-flex items-center space-x-2">
              <div>
                <ui-icon-btn icon="remove" :size="10" @click="clickMinus" />
              </div>
              <ui-text-input v-model="newShareDuration" type="number" text-center no-spinner class="text-center max-w-12 min-w-12 h-10 text-base" />
              <div>
                <ui-icon-btn icon="add" :size="10" @click="clickPlus" />
              </div>
              <div class="w-28">
                <ui-dropdown v-model="shareDurationUnit" :items="durationUnits" />
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center w-full md:w-1/2 mb-4">
          <p class="text-sm text-gray-300 py-1 px-1">{{ $strings.LabelDownloadable }}</p>
          <ui-toggle-switch size="sm" v-model="isDownloadable" />
          <ui-tooltip :text="$strings.LabelShareDownloadableHelp">
            <p class="pl-4 text-sm">
              <span class="material-symbols icon-text text-sm">info</span>
            </p>
          </ui-tooltip>
        </div>
        <p class="text-sm text-gray-300 py-1 px-1" v-html="$getString('MessageShareURLWillBe', [demoShareUrl])" />
        <p class="text-sm text-gray-300 py-1 px-1" v-html="$getString('MessageShareExpirationWillBe', [expirationDateString])" />
      </template>
      <div class="flex items-center pt-6">
        <div class="grow" />
        <ui-btn v-if="currentShare" color="bg-error" small @click="deleteShare">{{ $strings.ButtonDelete }}</ui-btn>
        <ui-btn v-if="!currentShare" color="bg-success" small @click="openShare">{{ $strings.ButtonShare }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {},
  data() {
    return {
      processing: false,
      newShareSlug: '',
      newShareDuration: 0,
      currentShare: null,
      shareDurationUnit: 'minutes',
      durationUnits: [
        {
          text: this.$strings.LabelMinutes,
          value: 'minutes'
        },
        {
          text: this.$strings.LabelHours,
          value: 'hours'
        },
        {
          text: this.$strings.LabelDays,
          value: 'days'
        }
      ],
      isDownloadable: false
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
        return this.$store.state.globals.showShareModal
      },
      set(val) {
        this.$store.commit('globals/setShowShareModal', val)
      }
    },
    mediaItemShare() {
      return this.$store.state.globals.selectedMediaItemShare
    },
    libraryItem() {
      return this.$store.state.selectedLibraryItem
    },
    user() {
      return this.$store.state.user.user
    },
    demoShareUrl() {
      return `${window.origin}${this.$config.routerBasePath}/share/${this.newShareSlug}`
    },
    currentShareUrl() {
      if (!this.currentShare) return ''
      return `${window.origin}${this.$config.routerBasePath}/share/${this.currentShare.slug}`
    },
    currentShareTimeRemaining() {
      if (!this.currentShare) return 'Error'
      if (!this.currentShare.expiresAt) return this.$strings.LabelPermanent
      const msRemaining = new Date(this.currentShare.expiresAt).valueOf() - Date.now()
      if (msRemaining <= 0) return 'Expired'
      return this.$elapsedPrettyExtended(msRemaining / 1000, true, false)
    },
    expireDurationSeconds() {
      let shareDuration = Number(this.newShareDuration)
      if (!shareDuration || isNaN(shareDuration)) return 0
      return this.newShareDuration * (this.shareDurationUnit === 'minutes' ? 60 : this.shareDurationUnit === 'hours' ? 3600 : 86400)
    },
    expirationDateString() {
      if (!this.expireDurationSeconds) return this.$strings.LabelPermanent
      const dateMs = Date.now() + this.expireDurationSeconds * 1000
      return this.$formatDatetime(dateMs, this.$store.getters['getServerSetting']('dateFormat'), this.$store.getters['getServerSetting']('timeFormat'))
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
        this.$toast.error(this.$strings.ToastSlugRequired)
        return
      }
      const payload = {
        slug: this.newShareSlug,
        mediaItemType: 'book',
        mediaItemId: this.libraryItem.media.id,
        expiresAt: this.expireDurationSeconds ? Date.now() + this.expireDurationSeconds * 1000 : 0,
        isDownloadable: this.isDownloadable
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
