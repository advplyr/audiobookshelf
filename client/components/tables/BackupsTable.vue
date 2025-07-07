<template>
  <div class="text-center mt-4 relative">
    <div class="flex py-4">
      <ui-file-input ref="fileInput" class="mr-2" accept=".audiobookshelf" @change="backupUploaded">{{ $strings.ButtonUploadBackup }}</ui-file-input>
      <div class="grow" />
      <ui-btn :loading="isBackingUp" @click="clickCreateBackup">{{ $strings.ButtonCreateBackup }}</ui-btn>
    </div>
    <div class="relative">
      <table id="backups">
        <tr>
          <th>{{ $strings.LabelFile }}</th>
          <th class="hidden sm:table-cell w-32 md:w-56">{{ $strings.LabelDatetime }}</th>
          <th class="hidden sm:table-cell w-20 md:w-28">{{ $strings.LabelSize }}</th>
          <th class="w-36"></th>
        </tr>
        <tr v-for="backup in backups" :key="backup.id" :class="!backup.serverVersion ? 'bg-error/10' : ''">
          <td>
            <p class="truncate text-xs sm:text-sm md:text-base">/{{ backup.path.replace(/\\/g, '/') }}</p>
          </td>
          <td class="hidden sm:table-cell font-sans text-sm">{{ $formatDatetime(backup.createdAt, dateFormat, timeFormat) }}</td>
          <td class="hidden sm:table-cell font-mono md:text-sm text-xs">{{ $bytesPretty(backup.fileSize) }}</td>
          <td>
            <div class="w-full flex flex-row items-center justify-center">
              <ui-btn v-if="backup.serverVersion && backup.key" small color="bg-primary" @click="applyBackup(backup)">{{ $strings.ButtonRestore }}</ui-btn>
              <ui-tooltip v-else text="This backup was created with an old version of audiobookshelf no longer supported" direction="bottom" class="mx-2 flex items-center">
                <span class="material-symbols text-2xl text-error">error_outline</span>
              </ui-tooltip>

              <button aria-label="Download backup" class="inline-flex material-symbols text-xl mx-1 mt-1 text-white/70 hover:text-white/100" @click.stop="downloadBackup(backup)">download</button>

              <button aria-label="Delete backup" class="inline-flex material-symbols text-xl mx-1 text-white/70 hover:text-error" @click.stop="deleteBackupClick(backup)">delete</button>
            </div>
          </td>
        </tr>
        <tr v-if="!backups.length" class="staticrow">
          <td colspan="4" class="text-lg">{{ $strings.MessageNoBackups }}</td>
        </tr>
      </table>
      <div v-show="processing" class="absolute top-0 left-0 w-full h-full bg-black/25 flex items-center justify-center">
        <ui-loading-indicator />
      </div>
    </div>

    <prompt-dialog v-model="showConfirmApply" :width="675">
      <div v-if="selectedBackup" class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300">
        <p class="text-error text-lg font-semibold">{{ $strings.MessageImportantNotice }}</p>
        <p class="text-base py-1" v-html="$strings.MessageRestoreBackupWarning" />

        <p class="text-lg text-center my-8">{{ $strings.MessageRestoreBackupConfirm }} {{ $formatDatetime(selectedBackup.createdAt, dateFormat, timeFormat) }}?</p>
        <div class="flex px-1 items-center">
          <ui-btn color="bg-primary" @click="showConfirmApply = false">{{ $strings.ButtonNevermind }}</ui-btn>
          <div class="grow" />
          <ui-btn color="bg-success" @click="confirm">{{ $strings.ButtonRestore }}</ui-btn>
        </div>
      </div>
    </prompt-dialog>

    <div v-if="isApplyingBackup" class="absolute inset-0 w-full h-full flex items-center justify-center bg-black/20 rounded-md">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      showConfirmApply: false,
      selectedBackup: null,
      isBackingUp: false,
      isApplyingBackup: false,
      processing: false,
      backups: []
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    },
    timeFormat() {
      return this.$store.getters['getServerSetting']('timeFormat')
    }
  },
  methods: {
    downloadBackup(backup) {
      this.$downloadFile(`${process.env.serverUrl}/api/backups/${backup.id}/download?token=${this.userToken}`)
    },
    confirm() {
      this.showConfirmApply = false
      this.isApplyingBackup = true

      this.$axios
        .$get(`/api/backups/${this.selectedBackup.id}/apply`)
        .then(() => {
          location.replace('/config/backups?backup=1')
        })
        .catch((error) => {
          console.error('Failed to apply backup', error)
          const errorMsg = error.response.data || this.$strings.ToastBackupRestoreFailed
          this.$toast.error(errorMsg)
        })
        .finally(() => {
          this.isApplyingBackup = false
        })
    },
    deleteBackupClick(backup) {
      const payload = {
        message: this.$getString('MessageConfirmDeleteBackup', [this.$formatDatetime(backup.createdAt, this.dateFormat, this.timeFormat)]),
        callback: (confirmed) => {
          if (confirmed) {
            this.deleteBackup(backup)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    deleteBackup(backup) {
      this.processing = true
      this.$axios
        .$delete(`/api/backups/${backup.id}`)
        .then((data) => {
          this.setBackups(data.backups || [])
          this.$toast.success(this.$strings.ToastBackupDeleteSuccess)
        })
        .catch((error) => {
          console.error(error)
          this.$toast.error(this.$strings.ToastBackupDeleteFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    applyBackup(backup) {
      this.selectedBackup = backup
      this.showConfirmApply = true
    },
    clickCreateBackup() {
      this.isBackingUp = true
      this.$axios
        .$post('/api/backups')
        .then((data) => {
          this.isBackingUp = false
          this.$toast.success(this.$strings.ToastBackupCreateSuccess)
          this.setBackups(data.backups || [])
        })
        .catch((error) => {
          this.isBackingUp = false
          console.error('Failed', error)
          this.$toast.error(this.$strings.ToastBackupCreateFailed)
        })
    },
    backupUploaded(file) {
      var form = new FormData()
      form.set('file', file)

      this.processing = true

      this.$axios
        .$post('/api/backups/upload', form)
        .then((data) => {
          this.setBackups(data.backups || [])
          this.$toast.success(this.$strings.ToastBackupUploadSuccess)
          this.processing = false
        })
        .catch((error) => {
          console.error(error)
          var errorMessage = error.response && error.response.data ? error.response.data : this.$strings.ToastBackupUploadFailed
          this.$toast.error(errorMessage)
          this.processing = false
        })
    },
    setBackups(backups) {
      backups.sort((a, b) => b.createdAt - a.createdAt)
      this.backups = backups
    },
    loadBackups() {
      this.processing = true
      this.$axios
        .$get('/api/backups')
        .then((data) => {
          this.$emit('loaded', data)
          this.setBackups(data.backups || [])
        })
        .catch((error) => {
          console.error('Failed to load backups', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
        })
        .finally(() => {
          this.processing = false
        })
    }
  },
  mounted() {
    this.loadBackups()
    if (this.$route.query.backup) {
      this.$toast.success(this.$strings.ToastBackupAppliedSuccess)
    }
  }
}
</script>

<style>
#backups {
  table-layout: fixed;
  border-collapse: collapse;
  width: 100%;
}

#backups td,
#backups th {
  border: 1px solid #2e2e2e;
  padding: 8px 8px;
  text-align: left;
}

#backups tr.staticrow td {
  text-align: center;
}

#backups tr:nth-child(even):not(.bg-error) {
  background-color: #3a3a3a;
}

#backups tr:not(.staticrow):not(.bg-error):hover {
  background-color: #444;
}

#backups th {
  font-size: 0.8rem;
  font-weight: 600;
  padding-top: 5px;
  padding-bottom: 5px;
  background-color: #333;
}
</style>
