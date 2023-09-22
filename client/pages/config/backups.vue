<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderBackups" :description="$strings.MessageBackupsDescription">
      <div v-if="backupLocation" class="flex items-center mb-4">
        <span class="material-icons-outlined text-2xl text-black-50 mr-2">folder</span>
        <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelBackupLocation }}:</span>
        <div class="text-gray-100 pl-4">{{ backupLocation }}</div>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="enableBackups" small :disabled="updatingServerSettings" @input="updateBackupsSettings" />
        <ui-tooltip :text="$strings.LabelBackupsEnableAutomaticBackupsHelp">
          <p class="pl-4 text-lg">{{ $strings.LabelBackupsEnableAutomaticBackups }} <span class="material-icons icon-text">info_outlined</span></p>
        </ui-tooltip>
      </div>

      <div v-if="enableBackups" class="mb-6">
        <div class="flex items-center pl-6 mb-2">
          <span class="material-icons-outlined text-2xl text-black-50 mr-2">schedule</span>
          <div class="w-40">
            <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.HeaderSchedule }}:</span>
          </div>
          <div class="text-gray-100">{{ scheduleDescription }}</div>
          <span class="material-icons text-lg text-black-50 hover:text-yellow-500 cursor-pointer ml-2" @click="showCronBuilder = !showCronBuilder">edit</span>
        </div>

        <div v-if="nextBackupDate" class="flex items-center pl-6 py-0.5 px-2 mb-2">
          <span class="material-icons-outlined text-2xl text-black-50 mr-2">event</span>
          <div class="w-40">
            <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelNextBackupDate }}:</span>
          </div>
          <div class="text-gray-100">{{ nextBackupDate }}</div>
        </div>

        <!-- <div class="flex items-center pl-6 mb-2">
          <span class="material-icons-outlined text-2xl text-black-50 mr-2">folder</span>
          <div class="w-48">
            <span class="text-white text-opacity-60 uppercase text-sm">{{ $strings.LabelBackupLocation }}:</span>
          </div>
          <div class="text-gray-100">{{ backupLocation }}</div>
        </div> -->
      </div>

      <div class="flex items-center py-2">
        <ui-text-input type="number" v-model="backupsToKeep" no-spinner :disabled="updatingServerSettings" :padding-x="1" text-center class="w-10" @change="updateBackupsSettings" />

        <ui-tooltip :text="$strings.LabelBackupsNumberToKeepHelp">
          <p class="pl-4 text-lg">{{ $strings.LabelBackupsNumberToKeep }} <span class="material-icons icon-text">info_outlined</span></p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-text-input type="number" v-model="maxBackupSize" no-spinner :disabled="updatingServerSettings" :padding-x="1" text-center class="w-10" @change="updateBackupsSettings" />

        <ui-tooltip :text="$strings.LabelBackupsMaxBackupSizeHelp">
          <p class="pl-4 text-lg">{{ $strings.LabelBackupsMaxBackupSize }} <span class="material-icons icon-text">info_outlined</span></p>
        </ui-tooltip>
      </div>

      <tables-backups-table @loaded="backupsLoaded" />

      <modals-backup-schedule-modal v-model="showCronBuilder" :cron-expression.sync="cronExpression" />
    </app-settings-content>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      updatingServerSettings: false,
      enableBackups: true,
      backupsToKeep: 2,
      maxBackupSize: 1,
      cronExpression: '',
      newServerSettings: {},
      showCronBuilder: false,
      backupLocation: ''
    }
  },
  watch: {
    serverSettings(newVal, oldVal) {
      if (newVal && !oldVal) {
        this.newServerSettings = { ...this.serverSettings }
        this.initServerSettings()
      }
    }
  },
  computed: {
    serverSettings() {
      return this.$store.state.serverSettings
    },
    dateFormat() {
      return this.serverSettings.dateFormat
    },
    timeFormat() {
      return this.serverSettings.timeFormat
    },
    scheduleDescription() {
      if (!this.cronExpression) return ''
      const parsed = this.$parseCronExpression(this.cronExpression)
      return parsed ? parsed.description : `${this.$strings.LabelCustomCronExpression} ${this.cronExpression}`
    },
    nextBackupDate() {
      if (!this.cronExpression) return ''
      const parsed = this.$getNextScheduledDate(this.cronExpression)
      return this.$formatJsDatetime(parsed, this.dateFormat, this.timeFormat) || ''
    }
  },
  methods: {
    backupsLoaded(backupLocation) {
      this.backupLocation = backupLocation
    },
    updateBackupsSettings() {
      if (isNaN(this.maxBackupSize) || this.maxBackupSize <= 0) {
        this.$toast.error('Invalid maximum backup size')
        return
      }
      if (isNaN(this.backupsToKeep) || this.backupsToKeep <= 0 || this.backupsToKeep > 99) {
        this.$toast.error('Invalid number of backups to keep')
        return
      }
      const updatePayload = {
        backupSchedule: this.enableBackups ? this.cronExpression : false,
        backupsToKeep: Number(this.backupsToKeep),
        maxBackupSize: Number(this.maxBackupSize)
      }
      this.updateServerSettings(updatePayload)
    },
    updateServerSettings(payload) {
      this.updatingServerSettings = true
      this.$store
        .dispatch('updateServerSettings', payload)
        .then((success) => {
          console.log('Updated Server Settings', success)
          this.updatingServerSettings = false
        })
        .catch((error) => {
          console.error('Failed to update server settings', error)
          this.updatingServerSettings = false
        })
    },
    initServerSettings() {
      this.newServerSettings = this.serverSettings ? { ...this.serverSettings } : {}

      this.backupsToKeep = this.newServerSettings.backupsToKeep || 2
      this.enableBackups = !!this.newServerSettings.backupSchedule
      this.maxBackupSize = this.newServerSettings.maxBackupSize || 1
      this.cronExpression = this.newServerSettings.backupSchedule || '30 1 * * *'
    }
  },
  mounted() {
    this.initServerSettings()
  }
}
</script>
