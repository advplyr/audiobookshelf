<template>
  <div class="w-full border border-white border-opacity-10 rounded-xl p-4 my-2" :class="notification.enabled ? 'bg-primary bg-opacity-25' : 'bg-error bg-opacity-5'">
    <div class="flex flex-wrap items-center">
      <p class="text-base md:text-lg font-semibold pr-4">{{ eventName }}</p>
      <div class="flex-grow" />

      <ui-btn v-if="eventName === 'onTest' && notification.enabled" :loading="testing" small class="mr-2" @click.stop="fireTestEventAndSucceed">{{ this.$strings.ButtonFireOnTest }}</ui-btn>
      <ui-btn v-if="eventName === 'onTest' && notification.enabled" :loading="testing" small class="mr-2" color="red-600" @click.stop="fireTestEventAndFail">{{ this.$strings.ButtonFireAndFail }}</ui-btn>
      <!-- <ui-btn v-if="eventName === 'onTest' && notification.enabled" :loading="testing" small class="mr-2" @click.stop="rapidFireTestEvents">Rapid Fire</ui-btn> -->
      <ui-btn v-else-if="notification.enabled" :loading="sendingTest" small class="mr-2" @click.stop="sendTestClick">{{ this.$strings.ButtonTest }}</ui-btn>
      <ui-btn v-else :loading="enabling" small color="success" class="mr-2" @click="enableNotification">{{ this.$strings.ButtonEnable }}</ui-btn>

      <ui-icon-btn :size="7" icon-font-size="1.1rem" icon="edit" class="mr-2" @click="editNotification" />
      <ui-icon-btn bg-color="error" :size="7" icon-font-size="1.2rem" icon="delete" @click="deleteNotificationClick" />
    </div>
    <div class="pt-4">
      <p class="text-gray-300 text-xs md:text-sm mb-2">{{ notification.urls.join(', ') }}</p>

      <p v-if="lastFiredAt && lastAttemptFailed" class="text-red-300 text-xs">Last attempt failed {{ $dateDistanceFromNow(lastFiredAt) }} ({{ numConsecutiveFailedAttempts }} attempt{{ numConsecutiveFailedAttempts === 1 ? '' : 's' }})</p>
      <p v-else-if="lastFiredAt" class="text-gray-400 text-xs">Last fired {{ $dateDistanceFromNow(lastFiredAt) }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    notification: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      sendingTest: false,
      enabling: false,
      deleting: false,
      testing: false
    }
  },
  computed: {
    eventName() {
      return this.notification ? this.notification.eventName : null
    },
    lastFiredAt() {
      return this.notification ? this.notification.lastFiredAt : null
    },
    lastAttemptFailed() {
      return this.notification ? this.notification.lastAttemptFailed : null
    },
    numConsecutiveFailedAttempts() {
      return this.notification ? this.notification.numConsecutiveFailedAttempts : null
    }
  },
  methods: {
    // For testing using the onTest event
    fireTestEventAndFail() {
      this.fireTestEvent(true)
    },
    fireTestEventAndSucceed() {
      this.fireTestEvent(false)
    },
    fireTestEvent(intentionallyFail = false) {
      this.testing = true
      this.$axios
        .$get(`/api/notifications/test?fail=${intentionallyFail ? 1 : 0}`)
        .then(() => {
          this.$toast.success(this.$strings.ToastNotificationTestTriggerSuccess)
        })
        .catch((error) => {
          console.error('Failed', error)
          const errorMsg = error.response ? error.response.data : null
          this.$toast.error(`Failed: ${errorMsg}` || this.$strings.ToastNotificationTestTriggerFailed)
        })
        .finally(() => {
          this.testing = false
        })
    },
    rapidFireTestEvents() {
      this.testing = true
      var numFired = 0
      var interval = setInterval(() => {
        this.fireTestEvent()
        numFired++
        if (numFired > 25) {
          this.testing = false
          clearInterval(interval)
        }
      }, 100)
    },
    // End testing functions
    sendTestClick() {
      const payload = {
        message: this.$strings.MessageConfirmNotificationTestTrigger,
        callback: (confirmed) => {
          if (confirmed) {
            this.sendTest()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    sendTest() {
      this.sendingTest = true
      this.$axios
        .$get(`/api/notifications/${this.notification.id}/test`)
        .then(() => {
          this.$toast.success(this.$strings.ToastNotificationTestTriggerSuccess)
        })
        .catch((error) => {
          console.error('Failed', error)
          const errorMsg = error.response ? error.response.data : null
          this.$toast.error(`Failed: ${errorMsg}` || this.$strings.ToastNotificationTestTriggerFailed)
        })
        .finally(() => {
          this.sendingTest = false
        })
    },
    enableNotification() {
      this.enabling = true
      const payload = {
        id: this.notification.id,
        enabled: true
      }
      this.$axios
        .$patch(`/api/notifications/${this.notification.id}`, payload)
        .then((updatedSettings) => {
          this.$emit('update', updatedSettings)
        })
        .catch((error) => {
          console.error('Failed to update notification', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.enabling = false
        })
    },
    deleteNotificationClick() {
      const payload = {
        message: this.$strings.MessageConfirmDeleteNotification,
        callback: (confirmed) => {
          if (confirmed) {
            this.deleteNotification()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    deleteNotification() {
      this.deleting = true
      this.$axios
        .$delete(`/api/notifications/${this.notification.id}`)
        .then((updatedSettings) => {
          this.$emit('update', updatedSettings)
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error(this.$strings.ToastNotificationDeleteFailed)
        })
        .finally(() => {
          this.deleting = false
        })
    },
    editNotification() {
      this.$emit('edit', this.notification)
    }
  },
  mounted() {}
}
</script>
