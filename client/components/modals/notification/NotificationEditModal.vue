<template>
  <modals-modal ref="modal" v-model="show" name="notification-edit" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="p-4 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300">
        <div class="w-full p-8">
          <ui-dropdown v-model="newNotification.eventName" label="Notification Event" :items="eventOptions" class="mb-4" @input="eventOptionUpdated" />

          <ui-multi-select v-model="newNotification.urls" label="Apprise URL(s)" class="mb-2" />

          <ui-text-input-with-label v-model="newNotification.titleTemplate" label="Title Template" class="mb-2" />

          <ui-textarea-with-label v-model="newNotification.bodyTemplate" label="Body Template" class="mb-2" />

          <p v-if="availableVariables" class="text-sm text-gray-300"><strong>Available variables:</strong> {{ availableVariables.join(', ') }}</p>

          <div class="flex items-center pt-4">
            <div class="flex items-center">
              <ui-toggle-switch v-model="newNotification.enabled" />
              <p class="text-lg pl-2">Enabled</p>
            </div>
            <div class="flex-grow" />
            <ui-btn color="success" type="submit">Submit</ui-btn>
          </div>
        </div>
      </div>
    </form>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    notification: {
      type: Object,
      default: () => null
    },
    notificationData: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      processing: false,
      newNotification: {},
      isNew: true
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
    notificationEvents() {
      if (!this.notificationData) return []
      return this.notificationData.events || []
    },
    eventOptions() {
      return this.notificationEvents.map((e) => ({ value: e.name, text: e.name, subtext: e.description }))
    },
    selectedEventData() {
      return this.notificationEvents.find((e) => e.name === this.newNotification.eventName)
    },
    showLibrarySelectInput() {
      return this.selectedEventData && this.selectedEventData.requiresLibrary
    },
    title() {
      return this.isNew ? 'Create Notification' : 'Update Notification'
    },
    availableVariables() {
      return this.selectedEventData ? this.selectedEventData.variables || null : null
    }
  },
  methods: {
    eventOptionUpdated() {
      if (!this.selectedEventData) return
      this.newNotification.titleTemplate = this.selectedEventData.defaults.title || ''
      this.newNotification.bodyTemplate = this.selectedEventData.defaults.body || ''
    },
    close() {
      // Force close when navigating - used in UsersTable
      if (this.$refs.modal) this.$refs.modal.setHide()
    },
    submitForm() {
      if (!this.newNotification.urls.length) {
        this.$toast.error('Must enter an Apprise URL')
        return
      }

      if (this.isNew) {
        this.submitCreate()
      } else {
        this.submitUpdate()
      }
    },
    submitUpdate() {
      this.processing = true

      const payload = {
        ...this.newNotification
      }
      console.log('Sending update notification', payload)
      this.$axios
        .$patch(`/api/notifications/${payload.id}`, payload)
        .then((updatedSettings) => {
          this.$emit('update', updatedSettings)
          this.$toast.success('Notification updated')
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to update notification', error)
          this.$toast.error('Failed to update notification')
        })
        .finally(() => {
          this.processing = false
        })
    },
    submitCreate() {
      this.processing = true

      const payload = {
        ...this.newNotification
      }
      console.log('Sending create notification', payload)
      this.$axios
        .$post('/api/notifications', payload)
        .then((updatedSettings) => {
          this.$emit('update', updatedSettings)
          this.$toast.success('Notification created')
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to create notification', error)
          this.$toast.error('Failed to create notification')
        })
        .finally(() => {
          this.processing = false
        })
    },
    init() {
      this.isNew = !this.notification
      if (this.notification) {
        this.newNotification = {
          id: this.notification.id,
          libraryId: this.notification.libraryId,
          eventName: this.notification.eventName,
          urls: [...this.notification.urls],
          titleTemplate: this.notification.titleTemplate,
          bodyTemplate: this.notification.bodyTemplate,
          enabled: this.notification.enabled,
          type: this.notification.type
        }
      } else {
        this.newNotification = {
          libraryId: null,
          eventName: 'onTest',
          urls: [],
          titleTemplate: '',
          bodyTemplate: '',
          enabled: true,
          type: null
        }
        this.eventOptionUpdated()
      }
    }
  },
  mounted() {}
}
</script>
