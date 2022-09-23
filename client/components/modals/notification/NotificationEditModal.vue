<template>
  <modals-modal ref="modal" v-model="show" name="notification-edit" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300">
        <div class="w-full p-8">
          <ui-dropdown v-model="newNotification.eventName" label="Notification Event" :items="eventOptions" class="mb-4" @input="eventOptionUpdated" />

          <ui-multi-select v-model="newNotification.urls" label="Apprise URL(s)" class="mb-2" />

          <ui-text-input-with-label v-model="newNotification.titleTemplate" label="Title Template" class="mb-2" />

          <ui-textarea-with-label v-model="newNotification.bodyTemplate" label="Body Template" class="mb-2" />

          <div class="flex pt-4">
            <div class="flex items-center">
              <ui-toggle-switch v-model="newNotification.enabled" />
              <p class="text-lg pl-2">Enabled</p>
            </div>
            <div class="flex-grow" />
            <ui-btn color="success" type="submit">Submit</ui-btn>
          </div>
        </div>
        <!-- <div class="w-full p-8">
          <div class="flex py-2">
            <div class="w-1/2 px-2">
              <ui-text-input-with-label v-model="newUser.username" label="Username" />
            </div>
            <div class="w-1/2 px-2">
              <ui-text-input-with-label v-if="!isEditingRoot" v-model="newUser.password" :label="isNew ? 'Password' : 'Change Password'" type="password" />
            </div>
          </div>
          <div v-show="!isEditingRoot" class="flex py-2">
            <div class="px-2 w-52">
              <ui-dropdown v-model="newUser.type" label="Account Type" :disabled="isEditingRoot" :items="accountTypes" @input="userTypeUpdated" />
            </div>
            <div class="flex-grow" />
            <div class="flex items-center pt-4 px-2">
              <p class="px-3 font-semibold" :class="isEditingRoot ? 'text-gray-300' : ''">Is Active</p>
              <ui-toggle-switch v-model="newUser.isActive" :disabled="isEditingRoot" />
            </div>
          </div>

          <div v-if="!isEditingRoot && newUser.permissions" class="w-full border-t border-b border-black-200 py-2 px-3 mt-4">
            <p class="text-lg mb-2 font-semibold">Permissions</p>
            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Download</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.download" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Update</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.update" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Delete</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.delete" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Upload</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.upload" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Access Explicit Content</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.accessExplicitContent" />
              </div>
            </div>

            <div class="flex items-center my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Access All Libraries</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.accessAllLibraries" @input="accessAllLibrariesToggled" />
              </div>
            </div>

            <div v-if="!newUser.permissions.accessAllLibraries" class="my-4">
              <ui-multi-select-dropdown v-model="newUser.librariesAccessible" :items="libraryItems" label="Libraries Accessible to User" />
            </div>

            <div class="flex items-cen~ter my-2 max-w-md">
              <div class="w-1/2">
                <p>Can Access All Tags</p>
              </div>
              <div class="w-1/2">
                <ui-toggle-switch v-model="newUser.permissions.accessAllTags" @input="accessAllTagsToggled" />
              </div>
            </div>
            <div v-if="!newUser.permissions.accessAllTags" class="my-4">
              <ui-multi-select-dropdown v-model="newUser.itemTagsAccessible" :items="itemTags" label="Tags Accessible to User" />
            </div>
          </div>

          <div class="flex pt-4 px-2">
            <ui-btn v-if="isEditingRoot" to="/account">Change Root Password</ui-btn>
            <div class="flex-grow" />
            <ui-btn color="success" type="submit">Submit</ui-btn>
          </div>
        </div> -->
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
      return this.notificationEvents.map((e) => ({ value: e.name, text: e.name }))
    },
    selectedEventData() {
      return this.notificationEvents.find((e) => e.name === this.newNotification.eventName)
    },
    showLibrarySelectInput() {
      return this.selectedEventData && this.selectedEventData.requiresLibrary
    },
    title() {
      return this.isNew ? 'Create Notification' : 'Update Notification'
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
      if (this.isNew) {
        this.submitCreate()
      } else {
        this.submitUpdate()
      }
    },
    submitUpdate() {},
    submitCreate() {
      this.processing = true

      const payload = {
        ...this.newNotification
      }
      console.log('Sending create notification', payload)
      this.$axios
        .$post('/api/notifications', payload)
        .then(() => {
          this.$toast.success('Notification created')
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
          titleTemplate: 'Test Title',
          bodyTemplate: 'Test Body',
          enabled: true,
          type: null
        }
      }
    }
  },
  mounted() {}
}
</script>
