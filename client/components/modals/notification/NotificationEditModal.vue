<template>
  <modals-modal ref="modal" v-model="show" name="notification-edit" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300">
        <div class="w-full px-3 py-5 md:p-12">
          <ui-dropdown v-model="newNotification.eventName" :label="$strings.LabelNotificationEvent" :items="eventOptions" class="mb-4" @input="eventOptionUpdated" />

          <ui-multi-select ref="urlsInput" v-model="newNotification.urls" :label="$strings.LabelNotificationAppriseURL" class="mb-2" />

          <ui-text-input-with-label v-model="newNotification.titleTemplate" :label="$strings.LabelNotificationTitleTemplate" class="mb-2" />

          <ui-textarea-with-label v-model="newNotification.bodyTemplate" :label="$strings.LabelNotificationBodyTemplate" :rows="4" class="mb-2" />

          <p v-if="availableVariables" class="text-sm text-gray-300">
            <strong>{{ $strings.LabelNotificationAvailableVariables }}:</strong> {{ availableVariables.join(', ') }}
          </p>

          <div class="flex items-center pt-4">
            <div class="flex items-center">
              <ui-toggle-switch v-model="newNotification.enabled" />
              <p class="text-lg pl-2">{{ $strings.LabelEnable }}</p>
            </div>
            <div class="grow" />
            <ui-btn color="bg-success" type="submit">{{ $strings.ButtonSubmit }}</ui-btn>
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
      return this.notificationEvents.map((e) => {
        return {
          value: e.name,
          text: e.name,
          subtext: this.$strings[e.descriptionKey] || e.description
        }
      })
    },
    selectedEventData() {
      return this.notificationEvents.find((e) => e.name === this.newNotification.eventName)
    },
    showLibrarySelectInput() {
      return this.selectedEventData && this.selectedEventData.requiresLibrary
    },
    title() {
      return this.isNew ? this.$strings.HeaderNotificationCreate : this.$strings.HeaderNotificationUpdate
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
      this.$refs.urlsInput?.forceBlur()

      if (!this.newNotification.urls.length) {
        this.$toast.error(this.$strings.ToastAppriseUrlRequired)
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
          this.$toast.success(this.$strings.ToastNotificationUpdateSuccess)
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to update notification', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
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
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to create notification', error)
          this.$toast.error(this.$strings.ToastNotificationCreateFailed)
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
