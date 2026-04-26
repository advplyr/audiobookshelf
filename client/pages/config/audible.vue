<template>
  <div>
    <!-- Connect account panel -->
    <app-settings-content header-text="Audible Accounts">
      <div class="mb-4 text-sm text-gray-300">
        Connect your Audible account to track preorders. You'll need an access token — see instructions below.
      </div>

      <details class="mb-6 text-sm">
        <summary class="cursor-pointer text-blue-400 hover:text-blue-300">How to get your tokens</summary>
        <div class="mt-2 pl-4 border-l border-white/10 text-gray-300 space-y-2">
          <p>Use <code>audible-cli</code> (Python) to authenticate once:</p>
          <pre class="bg-black/30 rounded p-2 text-xs overflow-x-auto">pip install audible-cli
audible quickstart</pre>
          <p>After setup, run the following to extract your tokens:</p>
          <pre class="bg-black/30 rounded p-2 text-xs overflow-x-auto">cat ~/.audible/*.json | jq '{access_token, refresh_token, device_serial: .device_info.device_serial_number}'</pre>
          <p>Paste the <code>access_token</code>, <code>refresh_token</code>, and <code>device_serial</code> values into the fields below.</p>
        </div>
      </details>

      <form @submit.prevent="connectAccount" class="space-y-3 max-w-md">
        <ui-text-input v-model="form.email" label="Audible Email" placeholder="you@example.com" type="email" :disabled="connecting" />
        <ui-dropdown v-model="form.region" label="Region" :items="regionOptions" small :disabled="connecting" />
        <ui-text-input v-model="form.accessToken" label="Access Token" placeholder="Atna|..." :disabled="connecting" />
        <ui-text-input v-model="form.refreshToken" label="Refresh Token (optional, for auto-renewal)" placeholder="Atnr|..." :disabled="connecting" />
        <ui-text-input v-model="form.deviceSerial" label="Device Serial (optional)" placeholder="from tokens.json" :disabled="connecting" />
        <div class="flex justify-end pt-1">
          <ui-btn type="submit" :loading="connecting" small>Connect</ui-btn>
        </div>
      </form>
    </app-settings-content>

    <!-- Connected accounts -->
    <app-settings-content v-if="accounts.length" header-text="Connected Accounts">
      <div v-for="account in accounts" :key="account.id" class="py-3 border-b border-white/10 last:border-0">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">{{ account.email }}</p>
            <p class="text-xs text-gray-400">Region: {{ account.region }} &bull; Last sync: {{ account.lastSync ? formatDate(account.lastSync) : 'Never' }}</p>
          </div>
          <div class="flex gap-2">
            <ui-btn small :loading="syncingId === account.id" color="bg-primary" @click="syncAccount(account)">Sync</ui-btn>
            <ui-btn small color="bg-error" @click="removeAccount(account)">Remove</ui-btn>
          </div>
        </div>
        <!-- Shelf display settings -->
        <div class="mt-2 flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-40">
            <label class="block text-xs text-gray-400 mb-1">Show preorders row on library</label>
            <select :value="account.libraryId || ''" @change="updateAccountSetting(account, 'libraryId', $event.target.value || null)" class="w-full bg-primary/20 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none">
              <option value="">— None —</option>
              <option v-for="lib in libraries" :key="lib.id" :value="lib.id">{{ lib.name }}</option>
            </select>
          </div>
          <div class="w-28">
            <label class="block text-xs text-gray-400 mb-1">Row position</label>
            <input type="number" min="0" max="20" :value="account.shelfPosition || 0" @change="updateAccountSetting(account, 'shelfPosition', parseInt($event.target.value) || 0)" class="w-full bg-primary/20 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none" />
          </div>
        </div>
      </div>
    </app-settings-content>

    <!-- Preorders -->
    <app-settings-content header-text="Preorders">
      <div v-if="!accounts.length" class="text-sm text-gray-400 py-2">Connect an Audible account above to see preorders.</div>
      <div v-else-if="!preorders.length" class="text-sm text-gray-400 py-2">No preorders found. Click "Sync" to refresh.</div>
      <div v-else>
        <p class="text-xs text-gray-400 mb-3">{{ preorders.length }} preorder{{ preorders.length !== 1 ? 's' : '' }} found</p>
        <div class="grid gap-3">
          <div v-for="book in preorders" :key="book.id" class="flex gap-3 p-3 bg-primary/10 rounded-lg border border-white/5">
            <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-16 h-16 object-cover rounded flex-shrink-0" />
            <div v-else class="w-16 h-16 bg-primary/30 rounded flex items-center justify-center flex-shrink-0">
              <span class="material-symbols text-2xl text-white/30">headphones</span>
            </div>
            <div class="min-w-0">
              <p class="font-medium text-sm truncate">{{ book.title }}</p>
              <p v-if="book.subtitle" class="text-xs text-gray-400 truncate">{{ book.subtitle }}</p>
              <p class="text-xs text-gray-300">{{ book.authors.join(', ') }}</p>
              <p v-if="book.seriesName" class="text-xs text-gray-400">{{ book.seriesName }}<span v-if="book.seriesPosition"> #{{ book.seriesPosition }}</span></p>
              <p v-if="book.releaseDate" class="text-xs text-yellow-400 mt-1">Releases: {{ formatReleaseDate(book.releaseDate) }}</p>
              <p v-if="book.publisherName" class="text-xs text-gray-500">{{ book.publisherName }}</p>
            </div>
          </div>
        </div>
      </div>
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
      accounts: [],
      preorders: [],
      libraries: [],
      connecting: false,
      syncingId: null,
      form: {
        email: '',
        region: 'us',
        accessToken: '',
        refreshToken: '',
        deviceSerial: ''
      },
      regionOptions: [
        { value: 'us', text: 'United States' },
        { value: 'ca', text: 'Canada' },
        { value: 'uk', text: 'United Kingdom' },
        { value: 'au', text: 'Australia' },
        { value: 'de', text: 'Germany' },
        { value: 'fr', text: 'France' },
        { value: 'it', text: 'Italy' },
        { value: 'es', text: 'Spain' },
        { value: 'jp', text: 'Japan' },
        { value: 'in', text: 'India' }
      ]
    }
  },
  async mounted() {
    await Promise.all([this.loadAccounts(), this.loadLibraries()])
    if (this.accounts.length) await this.loadPreorders()
  },
  methods: {
    async loadLibraries() {
      try {
        const data = await this.$axios.$get('/api/libraries')
        this.libraries = (data.libraries || []).map((l) => ({ id: l.id, name: l.name }))
      } catch (err) {
        console.error('Failed to load libraries', err)
      }
    },
    async loadAccounts() {
      try {
        const data = await this.$axios.$get('/api/audible/accounts')
        this.accounts = data.accounts || []
      } catch (err) {
        console.error('Failed to load Audible accounts', err)
      }
    },
    async loadPreorders() {
      try {
        const data = await this.$axios.$get('/api/audible/preorders')
        this.preorders = data.preorders || []
      } catch (err) {
        console.error('Failed to load preorders', err)
      }
    },
    async connectAccount() {
      if (!this.form.email || !this.form.accessToken) {
        this.$toast.error('Email and access token are required')
        return
      }
      this.connecting = true
      try {
        const data = await this.$axios.$post('/api/audible/accounts', {
          email: this.form.email,
          region: this.form.region,
          accessToken: this.form.accessToken,
          refreshToken: this.form.refreshToken || undefined,
          deviceSerial: this.form.deviceSerial || undefined
        })
        this.accounts.push(data.account)
        this.form = { email: '', region: 'us', accessToken: '', refreshToken: '', deviceSerial: '' }
        this.$toast.success('Account connected')
      } catch (err) {
        console.error('Failed to connect Audible account', err)
        this.$toast.error(err.response?.data || 'Failed to connect account')
      } finally {
        this.connecting = false
      }
    },
    async syncAccount(account) {
      this.syncingId = account.id
      try {
        const data = await this.$axios.$post(`/api/audible/accounts/${account.id}/sync`)
        this.$toast.success(`Synced ${data.synced} preorder(s)`)
        await this.loadAccounts()
        await this.loadPreorders()
      } catch (err) {
        console.error('Sync failed', err)
        this.$toast.error(err.response?.data || 'Sync failed')
      } finally {
        this.syncingId = null
      }
    },
    async removeAccount(account) {
      if (!confirm(`Remove Audible account ${account.email}?`)) return
      try {
        await this.$axios.$delete(`/api/audible/accounts/${account.id}`)
        this.accounts = this.accounts.filter((a) => a.id !== account.id)
        this.preorders = this.preorders.filter((b) => b.audibleAccountId !== account.id)
        this.$toast.success('Account removed')
      } catch (err) {
        console.error('Failed to remove account', err)
        this.$toast.error('Failed to remove account')
      }
    },
    async updateAccountSetting(account, field, value) {
      try {
        const data = await this.$axios.$patch(`/api/audible/accounts/${account.id}`, { [field]: value })
        const idx = this.accounts.findIndex((a) => a.id === account.id)
        if (idx !== -1) this.$set(this.accounts, idx, data.account)
      } catch (err) {
        console.error('Failed to update account setting', err)
        this.$toast.error('Failed to save setting')
      }
    },
    formatDate(d) {
      return new Date(d).toLocaleDateString()
    },
    formatReleaseDate(d) {
      if (!d) return ''
      // d may be 'YYYY-MM-DD' or a full ISO string
      const date = new Date(d.length === 10 ? d + 'T00:00:00' : d)
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    }
  }
}
</script>
