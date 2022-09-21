<template>
  <div>
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-8 mb-2 max-w-3xl mx-auto">
      <h2 class="text-xl font-semibold mb-2">Apprise Notification Settings</h2>
      <p class="mb-6">Insert some text here describing this feature</p>

      <form @submit.prevent="submitForm">
        <ui-text-input-with-label v-model="appriseApiUrl" label="Apprise API Url" />
        <div class="flex items-center justify-end pt-4">
          <ui-btn type="submit">Save</ui-btn>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      appriseApiUrl: null,
      notifications: [],
      notificationSettings: null
    }
  },
  computed: {},
  methods: {
    submitForm() {
      if (this.notificationSettings && this.notificationSettings.appriseApiUrl == this.appriseApiUrl) {
        return
      }

      // TODO: Validate apprise api url

      const updatePayload = {
        appriseApiUrl: this.appriseApiUrl || null
      }
      this.loading = true
      this.$axios
        .$patch('/api/notifications', updatePayload)
        .then(() => {
          this.$toast.success('Notification settings updated')
        })
        .catch((error) => {
          console.error('Failed to update notification settings', error)
          this.$toast.error('Failed to update notification settings')
        })
        .finally(() => {
          this.loading = false
        })
    },
    async init() {
      this.loading = true
      const notificationSettings = await this.$axios.$get('/api/notifications').catch((error) => {
        console.error('Failed to get notification settings', error)
        this.$toast.error('Failed to load notification settings')
        return null
      })
      this.loading = false
      if (!notificationSettings) {
        return
      }
      this.notificationSettings = notificationSettings
      this.appriseApiUrl = notificationSettings.appriseApiUrl
      this.notifications = notificationSettings.notifications || []
    }
  },
  mounted() {
    this.init()
  }
}
</script>