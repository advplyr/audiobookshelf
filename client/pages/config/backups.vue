<template>
  <div class="w-full h-full">
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
      <div class="flex items-center mb-2">
        <h1 class="text-xl">Backups</h1>
      </div>

      <p class="text-base mb-4 text-gray-300">Backups include users, user progress, library item details, server settings, and images stored in <span class="font-mono text-gray-100">/metadata/items</span> & <span class="font-mono text-gray-100">/metadata/authors</span>. <br />Backups <strong>do not</strong> include any files stored in your library folders.</p>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="enableBackups" small :disabled="updatingServerSettings" @input="updateBackupsSettings" />
        <ui-tooltip :text="backupsTooltip">
          <p class="pl-4 text-lg">Enable automatic backups <span class="material-icons icon-text">info_outlined</span></p>
        </ui-tooltip>
      </div>

      <div v-if="enableBackups" class="mb-6">
        <div class="flex items-center pl-6">
          <span class="material-icons-outlined text-black-50">schedule</span>
          <p class="text-gray-100 px-2">{{ scheduleDescription }}</p>
          <span class="material-icons text-lg text-black-50 hover:text-yellow-500 cursor-pointer" @click="showCronBuilder = !showCronBuilder">edit</span>
        </div>
      </div>

      <div class="flex items-center py-2">
        <ui-text-input type="number" v-model="backupsToKeep" no-spinner :disabled="updatingServerSettings" :padding-x="1" text-center class="w-10" @change="updateBackupsSettings" />

        <p class="pl-4 text-lg">Number of backups to keep</p>
      </div>

      <div class="flex items-center py-2">
        <ui-text-input type="number" v-model="maxBackupSize" no-spinner :disabled="updatingServerSettings" :padding-x="1" text-center class="w-10" @change="updateBackupsSettings" />

        <ui-tooltip :text="maxBackupSizeTooltip">
          <p class="pl-4 text-lg">Maximum backup size (in GB) <span class="material-icons icon-text">info_outlined</span></p>
        </ui-tooltip>
      </div>

      <tables-backups-table />
    </div>

    <modals-backup-schedule-modal v-model="showCronBuilder" :cron-expression.sync="cronExpression" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      updatingServerSettings: false,
      enableBackups: true,
      backupsToKeep: 2,
      maxBackupSize: 1,
      cronExpression: '',
      newServerSettings: {},
      showCronBuilder: false
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
    backupsTooltip() {
      return 'Backups saved in /metadata/backups'
    },
    maxBackupSizeTooltip() {
      return 'As a safeguard against misconfiguration, backups will fail if they exceed the configured size.'
    },
    serverSettings() {
      return this.$store.state.serverSettings
    },
    scheduleDescription() {
      if (!this.cronExpression) return ''
      const parsed = this.$parseCronExpression(this.cronExpression)
      return parsed ? parsed.description : 'Custom cron expression ' + this.cronExpression
    }
  },
  methods: {
    updateBackupsSettings() {
      if (isNaN(this.maxBackupSize) || this.maxBackupSize <= 0) {
        this.$toast.error('Invalid maximum backup size')
        return
      }
      if (isNaN(this.backupsToKeep) || this.backupsToKeep <= 0 || this.backupsToKeep > 99) {
        this.$toast.error('Invalid number of backups to keep')
        return
      }
      var updatePayload = {
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