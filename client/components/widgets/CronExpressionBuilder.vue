<template>
  <div class="w-full py-2">
    <template v-if="!showAdvancedView">
      <ui-multi-select-dropdown v-model="selectedWeekdays" @input="updateCron" label="Weekdays to run" :items="weekdays" />

      <div v-show="selectedWeekdays.length" class="flex items-center py-2">
        <ui-text-input-with-label v-model="selectedHour" @input="updateCron" @blur="hourBlur" type="number" label="Hour" class="max-w-20" />
        <p class="text-xl px-2 mt-4">:</p>
        <ui-text-input-with-label v-model="selectedMinute" @input="updateCron" @blur="minuteBlur" type="number" label="Minute" class="max-w-20" />
      </div>

      <div v-if="description" class="w-full bg-primary bg-opacity-75 rounded-xl p-4 text-center mt-2">
        <p class="text-lg text-gray-200" v-html="description" />
      </div>
    </template>
    <template v-else>
      <p class="px-1 text-sm font-semibold">Cron Expression</p>
      <ui-text-input v-model="customCronExpression" @blur="cronExpressionBlur" label="Cron Expression" :padding-y="1" text-center class="w-full text-4xl -tracking-widest mb-2" />
      <ui-btn v-if="!customCronError" small :disabled="isValidating" @click="validateCron">Validate Cron Expression</ui-btn>
      <p v-else class="text-error text-xl">{{ customCronError }}</p>
    </template>
        <div class="flex justify-end mt-4">
      <ui-checkbox v-model="showAdvancedView" small checkbox-bg="bg" label="Advanced" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      showAdvancedView: false,
      selectedHour: 0,
      selectedMinute: 0,
      selectedWeekdays: [],
      cronExpression: '0 0 * * *',
      customCronExpression: '0 0 * * *',
      customCronError: '',
      isValidating: false
    }
  },
  computed: {
    minuteIsValid() {
      return !(isNaN(this.selectedMinute) || this.selectedMinute === '' || this.selectedMinute < 0 || this.selectedMinute > 59)
    },
    hourIsValid() {
      return !(isNaN(this.selectedHour) || this.selectedHour === '' || this.selectedHour < 0 || this.selectedHour > 23)
    },
    description() {
      if (!this.selectedWeekdays.length) return ''

      if (!this.hourIsValid) {
        return `<span class="text-error">Invalid hour must be 0-23 | ${this.selectedHour < 0 || this.selectedHour > 23}</span>`
      }
      if (!this.minuteIsValid) {
        return `<span class="text-error">Invalid minute must be 0-59</span>`
      }

      var description = 'Run every '
      const weekdayTexts =
        this.selectedWeekdays.length === 7
          ? 'day'
          : this.selectedWeekdays
              .map((weekday) => {
                return this.weekdays.find((w) => w.value === weekday).text
              })
              .join(', ')
      description += `<span class="font-bold text-white">${weekdayTexts}</span>`

      const hourString = this.selectedHour.toString()
      const minuteString = this.selectedMinute.toString().padStart(2, '0')
      description += ` at <span class="font-bold text-white">${hourString}:${minuteString}</span>`
      return description
    },
    weekdays() {
      return [
        {
          text: 'Sunday',
          value: 0
        },
        {
          text: 'Monday',
          value: 1
        },
        {
          text: 'Tuesday',
          value: 2
        },
        {
          text: 'Wednesday',
          value: 3
        },
        {
          text: 'Thursday',
          value: 4
        },
        {
          text: 'Friday',
          value: 5
        },
        {
          text: 'Saturday',
          value: 6
        }
      ]
    }
  },
  methods: {
    updateCron() {
      if (!this.minuteIsValid || !this.hourIsValid || !this.selectedWeekdays.length) {
        this.cronExpression = null
        return
      }
      this.selectedWeekdays.sort()
      this.cronExpression = `${this.selectedMinute} ${this.selectedHour} * * ${this.selectedWeekdays.join(',')}`
      this.customCronExpression = this.cronExpression
      this.$emit('input', this.cronExpression)
    },
    minuteBlur() {
      const v = this.selectedMinute
      if (v === '' || v === null || isNaN(v) || v < 0) {
        this.selectedMinute = 0
      } else if (v > 59) {
        this.selectedMinute = 59
      } else {
        this.selectedMinute = Number(v)
      }
      this.updateCron()
    },
    hourBlur() {
      const v = this.selectedHour
      if (v === '' || v === null || isNaN(v) || v < 0) {
        this.selectedHour = 0
      } else if (v > 23) {
        this.selectedHour = 23
      } else {
        this.selectedHour = Number(v)
      }
      this.updateCron()
    },
    simpleValidateCustomCron() {
      return this.customCronExpression && this.customCronExpression.split(' ').length === 5
    },
    cronExpressionBlur() {
      this.customCronError = ''
      if (!this.simpleValidateCustomCron()) {
        this.customCronError = 'Invalid cron expression'
        return
      }

      if (this.customCronExpression !== this.cronExpression) {
        this.selectedWeekdays = []
        this.selectedHour = 0
        this.selectedMinute = 0
        this.cronExpression = this.customCronExpression
      }
      this.$emit('input', this.cronExpression)
    },
    validateCron() {
      this.isValidating = true
      this.$axios
        .$post('/api/validate-cron', { expression: this.customCronExpression })
        .then(() => {
          this.$toast.success('Cron expression is valid!')
          this.isValidating = false
        })
        .catch((error) => {
          console.error('Invalid cron', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error('Invalid cron: ' + errMsg)
          this.isValidating = false
        })
    },
    init() {
      if (!this.value) return
      // TODO: parse
      // const pieces = this.value.split(' ')
      // this.selectedMinute = Number(pieces[0])

    }
  },
  mounted() {
    this.init()
  }
}
</script>