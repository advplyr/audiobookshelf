<template>
  <div class="w-full py-2">
    <div class="flex -mb-px">
      <div class="w-1/2 h-8 rounded-tl-md relative border border-black-200 flex items-center justify-center cursor-pointer" :class="!showAdvancedView ? 'text-white bg-bg hover:bg-bg/60 border-b-bg' : 'text-gray-400 hover:text-gray-300 bg-primary/70 hover:bg-primary/60'" @click="showAdvancedView = false">
        <p class="text-sm">{{ $strings.HeaderSchedule }}</p>
      </div>
      <div class="w-1/2 h-8 rounded-tr-md relative border border-black-200 flex items-center justify-center -ml-px cursor-pointer" :class="showAdvancedView ? 'text-white bg-bg hover:bg-bg/60 border-b-bg' : 'text-gray-400 hover:text-gray-300 bg-primary/70 hover:bg-primary/60'" @click="showAdvancedView = true">
        <p class="text-sm">{{ $strings.HeaderAdvanced }}</p>
      </div>
    </div>
    <div class="px-2 py-4 md:p-4 border border-black-200 rounded-b-md mr-px" style="min-height: 280px">
      <template v-if="!showAdvancedView">
        <ui-dropdown v-model="selectedInterval" @input="updateCron" :label="$strings.LabelInterval" :items="intervalOptions" class="mb-2" />

        <ui-multi-select-dropdown v-if="selectedInterval === 'custom'" v-model="selectedWeekdays" @input="updateCron" :label="$strings.LabelWeekdaysToRun" :items="weekdays" />

        <div v-if="(selectedWeekdays.length && selectedInterval === 'custom') || selectedInterval === 'daily'" class="flex items-center py-2">
          <ui-text-input-with-label v-model="selectedHour" @input="updateCron" @blur="hourBlur" type="number" :label="$strings.LabelHour" class="max-w-20" />
          <p class="text-xl px-2 mt-4">:</p>
          <ui-text-input-with-label v-model="selectedMinute" @input="updateCron" @blur="minuteBlur" type="number" :label="$strings.LabelMinute" class="max-w-20" />
        </div>

        <div v-if="description" class="w-full bg-primary/75 rounded-xl p-2 md:p-4 text-center mt-2">
          <p class="text-base md:text-lg text-gray-200" v-html="description" />
        </div>
      </template>
      <template v-else>
        <p class="px-1 text-sm font-semibold">{{ $strings.LabelCronExpression }}</p>
        <ui-text-input ref="customExpressionInput" v-model="customCronExpression" @blur="cronExpressionBlur" :padding-y="2" text-center class="w-full text-2xl md:text-4xl -tracking-widest mb-4 font-mono" />

        <div class="flex items-center justify-center">
          <widgets-loading-spinner v-if="isValidating" class="mr-2" />
          <span v-else class="material-symbols mr-2 text-xl" :class="isValid ? 'text-success' : 'text-error'">{{ isValid ? 'check_circle_outline' : 'error_outline' }}</span>
          <p v-if="isValidating" class="text-gray-300 text-base md:text-lg text-center">{{ $strings.MessageCheckingCron }}</p>
          <p v-else-if="customCronError" class="text-error text-base md:text-lg text-center">{{ customCronError }}</p>
          <p v-else class="text-success text-base md:text-lg text-center">{{ $strings.MessageValidCronExpression }}</p>
        </div>
      </template>
      <div v-if="cronExpression && isValid" class="flex items-center justify-center text-yellow-400 mt-2">
        <span class="material-symbols mr-2 text-xl">event</span>
        <p>{{ $strings.LabelNextScheduledRun }}: {{ nextRun }}</p>
      </div>
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
      selectedInterval: 'custom',
      showAdvancedView: false,
      selectedHour: 0,
      selectedMinute: 0,
      selectedWeekdays: [],
      cronExpression: '0 0 * * *',
      customCronExpression: '0 0 * * *',
      customCronError: '',
      isValidating: false,
      validatedCron: null,
      isValid: true
    }
  },
  watch: {
    value: {
      immediate: true,
      handler(newVal) {
        this.init()
      }
    }
  },
  computed: {
    minuteIsValid() {
      return !(isNaN(this.selectedMinute) || this.selectedMinute === '' || this.selectedMinute < 0 || this.selectedMinute > 59)
    },
    hourIsValid() {
      return !(isNaN(this.selectedHour) || this.selectedHour === '' || this.selectedHour < 0 || this.selectedHour > 23)
    },
    nextRun() {
      if (!this.cronExpression) return ''
      const parsed = this.$getNextScheduledDate(this.cronExpression)
      return this.$formatJsDatetime(parsed, this.$store.getters['getServerSetting']('dateFormat'), this.$store.getters['getServerSetting']('timeFormat')) || ''
    },
    description() {
      if ((this.selectedInterval !== 'custom' || !this.selectedWeekdays.length) && this.selectedInterval !== 'daily') return ''

      if (!this.hourIsValid) {
        return `<span class="text-error">Invalid hour must be 0-23 | ${this.selectedHour < 0 || this.selectedHour > 23}</span>`
      }
      if (!this.minuteIsValid) {
        return `<span class="text-error">Invalid minute must be 0-59</span>`
      }

      var description = 'Run every '
      var weekdayTexts = ''
      if (this.selectedWeekdays.length === 7 || this.selectedInterval === 'daily') {
        weekdayTexts = 'day'
      } else {
        weekdayTexts = this.selectedWeekdays
          .map((weekday) => {
            return this.weekdays.find((w) => w.value === weekday).text
          })
          .join(', ')
      }
      description += `<span class="font-bold text-white">${weekdayTexts}</span>`

      const hourString = this.selectedHour.toString()
      const minuteString = this.selectedMinute.toString().padStart(2, '0')
      description += ` at <span class="font-bold text-white">${hourString}:${minuteString}</span>`
      return description
    },
    intervalOptions() {
      return [
        {
          text: this.$strings.LabelIntervalCustomDailyWeekly,
          value: 'custom'
        },
        {
          text: this.$strings.LabelIntervalEveryDay,
          value: 'daily'
        },
        {
          text: this.$strings.LabelIntervalEvery12Hours,
          value: '0 */12 * * *'
        },
        {
          text: this.$strings.LabelIntervalEvery6Hours,
          value: '0 */6 * * *'
        },
        {
          text: this.$strings.LabelIntervalEvery2Hours,
          value: '0 */2 * * *'
        },
        {
          text: this.$strings.LabelIntervalEveryHour,
          value: '0 * * * *'
        },
        {
          text: this.$strings.LabelIntervalEvery30Minutes,
          value: '*/30 * * * *'
        },
        {
          text: this.$strings.LabelIntervalEvery15Minutes,
          value: '*/15 * * * *'
        }
      ]
    },
    weekdays() {
      return [
        {
          text: this.$formatJsDate(new Date(2023, 0, 1), 'EEEE'),
          value: 0
        },
        {
          text: this.$formatJsDate(new Date(2023, 0, 2), 'EEEE'),
          value: 1
        },
        {
          text: this.$formatJsDate(new Date(2023, 0, 3), 'EEEE'),
          value: 2
        },
        {
          text: this.$formatJsDate(new Date(2023, 0, 4), 'EEEE'),
          value: 3
        },
        {
          text: this.$formatJsDate(new Date(2023, 0, 5), 'EEEE'),
          value: 4
        },
        {
          text: this.$formatJsDate(new Date(2023, 0, 6), 'EEEE'),
          value: 5
        },
        {
          text: this.$formatJsDate(new Date(2023, 0, 7), 'EEEE'),
          value: 6
        }
      ]
    }
  },
  methods: {
    checkBlurExpressionInput() {
      if (!this.showAdvancedView || !this.$refs.customExpressionInput) return false
      if (this.$refs.customExpressionInput.isFocused) {
        this.$refs.customExpressionInput.blur()
        return true
      }
      return false
    },
    updateCron() {
      if (this.selectedInterval === 'custom') {
        if (!this.minuteIsValid || !this.hourIsValid || !this.selectedWeekdays.length) {
          this.cronExpression = null
          return
        }
        this.selectedWeekdays.sort()

        const daysOfWeekPiece = this.selectedWeekdays.length === 7 ? '*' : this.selectedWeekdays.join(',')
        this.cronExpression = `${this.selectedMinute} ${this.selectedHour} * * ${daysOfWeekPiece}`
      } else if (this.selectedInterval === 'daily') {
        if (!this.minuteIsValid || !this.hourIsValid) {
          this.cronExpression = null
          return
        }
        this.cronExpression = `${this.selectedMinute} ${this.selectedHour} * * *`
      } else {
        this.cronExpression = this.selectedInterval
      }

      this.customCronExpression = this.cronExpression
      this.validatedCron = this.cronExpression
      this.isValid = true
      this.customCronError = ''
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
    async cronExpressionBlur() {
      this.customCronError = ''
      if (!this.customCronExpression || this.customCronExpression.split(' ').length !== 5) {
        this.customCronError = 'Invalid cron expression'
        this.isValid = false
        return
      }

      if (this.customCronExpression !== this.cronExpression) {
        this.selectedWeekdays = []
        this.selectedHour = 0
        this.selectedMinute = 0
        this.cronExpression = this.customCronExpression
      }

      if (!this.validatedCron || this.validatedCron !== this.cronExpression) {
        const validationPayload = await this.validateCron()
        this.isValid = validationPayload.isValid
        this.validatedCron = this.cronExpression
        this.customCronError = validationPayload.error || ''
      }

      if (this.isValid) {
        this.$emit('input', this.cronExpression)
      }
    },
    validateCron() {
      this.isValidating = true
      return this.$axios
        .$post('/api/validate-cron', { expression: this.customCronExpression })
        .then(() => {
          this.isValidating = false
          return {
            isValid: true
          }
        })
        .catch((error) => {
          console.error('Invalid cron', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.isValidating = false
          return {
            isValid: false,
            error: errMsg || 'Invalid cron expression'
          }
        })
    },
    init() {
      this.selectedInterval = 'custom'
      this.selectedHour = 0
      this.selectedMinute = 0
      this.selectedWeekdays = []

      if (!this.value) return
      const pieces = this.value.split(' ')
      if (pieces.length !== 5) {
        console.error('Invalid cron expression input', this.value)
        return
      }

      const intervalMatch = this.intervalOptions.find((opt) => opt.value === this.value)
      if (intervalMatch) {
        this.selectedInterval = this.value
      } else {
        var isCustomCron = false
        if (isNaN(pieces[0]) || isNaN(pieces[1])) {
          isCustomCron = true
        } else if (pieces[2] !== '*' || pieces[3] !== '*') {
          isCustomCron = true
        } else if (pieces[4] !== '*' && pieces[4].split(',').some((num) => isNaN(num))) {
          isCustomCron = true
        }

        if (isCustomCron) {
          this.showAdvancedView = true
        } else {
          if (pieces[4] === '*') this.selectedInterval = 'daily'

          this.selectedWeekdays = pieces[4] === '*' ? [0, 1, 2, 3, 4, 5, 6] : pieces[4].split(',').map((num) => Number(num))
          this.selectedHour = pieces[1]
          this.selectedMinute = pieces[0]
        }
      }
      this.cronExpression = this.value
      this.customCronExpression = this.value
    }
  },
  mounted() {
    this.init()
  }
}
</script>
