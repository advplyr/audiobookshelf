<template>
  <div class="w-full border border-white border-opacity-10 rounded-xl p-4 my-2" :class="notification.enabled ? 'bg-primary bg-opacity-25' : 'bg-error bg-opacity-5'">
    <div class="flex items-center">
      <p class="text-lg font-semibold">{{ eventName }}</p>
      <div class="flex-grow" />

      <ui-btn v-if="eventName === 'onTest' && notification.enabled" :loading="testing" small class="mr-2" @click.stop="fireTestEventAndSucceed">Fire onTest Event</ui-btn>
      <ui-btn v-if="eventName === 'onTest' && notification.enabled" :loading="testing" small class="mr-2" color="red-600" @click.stop="fireTestEventAndFail">Fire & Fail</ui-btn>
      <ui-btn v-else-if="notification.enabled" :loading="sendingTest" small class="mr-2" @click.stop="sendTestClick">Test</ui-btn>
      <ui-btn v-else :loading="enabling" small color="success" class="mr-2" @click="enableNotification">Enable</ui-btn>

      <ui-icon-btn bg-color="warning" :size="7" icon-font-size="1.2rem" icon="edit" class="mr-2" @click="editNotification" />
      <ui-icon-btn bg-color="error" :size="7" icon-font-size="1.2rem" icon="delete" @click="deleteNotificationClick" />
    </div>
    <div class="pt-4">
      <p class="text-gray-300 text-sm mb-2">{{ notification.urls.join(', ') }}</p>

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
          this.$toast.success('Triggered onTest Event')
        })
        .catch((error) => {
          console.error('Failed', error)
          const errorMsg = error.response ? error.response.data : null
          this.$toast.error(`Failed: ${errorMsg}` || 'Failed to trigger onTest event')
        })
        .finally(() => {
          this.testing = false
        })
    },
    sendTestClick() {
      const payload = {
        message: `Send a test notification to event ${this.eventName}?`,
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
          this.$toast.success('Triggered test notification')
        })
        .catch((error) => {
          console.error('Failed', error)
          const errorMsg = error.response ? error.response.data : null
          this.$toast.error(`Failed: ${errorMsg}` || 'Failed to trigger test notification')
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
          this.$toast.success('Notification enabled')
        })
        .catch((error) => {
          console.error('Failed to update notification', error)
          this.$toast.error('Failed to update notification')
        })
        .finally(() => {
          this.enabling = false
        })
    },
    deleteNotificationClick() {
      const payload = {
        message: `Are you sure you want to delete this notification?`,
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
          this.$toast.success('Deleted notification')
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error('Failed to delete notification')
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