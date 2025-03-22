<template>
  <modals-modal v-model="show" name="sleep-timer" :width="350" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate pointer-events-none">{{ $strings.HeaderSleepTimer }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div class="w-full">
        <template v-for="time in sleepTimes">
          <div :key="time.text" class="flex items-center px-6 py-3 justify-center cursor-pointer hover:bg-primary/25 relative" @click="setTime(time)">
            <p class="text-lg text-center">{{ time.text }}</p>
          </div>
        </template>
        <form class="flex items-center justify-center px-6 py-3" @submit.prevent="submitCustomTime">
          <ui-text-input v-model="customTime" type="number" step="any" min="0.1" :placeholder="$strings.LabelTimeInMinutes" class="w-48" />
          <ui-btn color="bg-success" type="submit" :padding-x="0" class="h-9 w-18 flex items-center justify-center ml-1">{{ $strings.ButtonSubmit }}</ui-btn>
        </form>
      </div>
      <div v-if="timerSet" class="w-full p-4">
        <div class="mb-4 h-px w-full bg-white/10" />

        <div v-if="timerType === $constants.SleepTimerTypes.COUNTDOWN" class="mb-4 flex items-center justify-center space-x-4">
          <ui-btn :padding-x="2" small :disabled="remaining < 30 * 60" class="flex items-center h-9" @click="decrement(30 * 60)">
            <span class="material-symbols text-lg">remove</span>
            <span class="pl-1 text-sm">30m</span>
          </ui-btn>

          <ui-icon-btn icon="remove" class="min-w-9" @click="decrement(60 * 5)" />

          <p class="text-2xl font-mono">{{ $secondsToTimestamp(remaining) }}</p>

          <ui-icon-btn icon="add" class="min-w-9" @click="increment(60 * 5)" />

          <ui-btn :padding-x="2" small class="flex items-center h-9" @click="increment(30 * 60)">
            <span class="material-symbols text-lg">add</span>
            <span class="pl-1 text-sm">30m</span>
          </ui-btn>
        </div>
        <ui-btn class="w-full" @click="$emit('cancel')">{{ $strings.ButtonCancel }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    timerSet: Boolean,
    timerType: String,
    remaining: Number,
    hasChapters: Boolean
  },
  data() {
    return {
      customTime: null
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
    sleepTimes() {
      const times = [
        {
          seconds: 60 * 5,
          text: this.$getString('LabelTimeDurationXMinutes', ['5']),
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 15,
          text: this.$getString('LabelTimeDurationXMinutes', ['15']),
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 20,
          text: this.$getString('LabelTimeDurationXMinutes', ['20']),
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 30,
          text: this.$getString('LabelTimeDurationXMinutes', ['30']),
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 45,
          text: this.$getString('LabelTimeDurationXMinutes', ['45']),
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 60,
          text: this.$getString('LabelTimeDurationXMinutes', ['60']),
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 90,
          text: this.$getString('LabelTimeDurationXMinutes', ['90']),
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 120,
          text: this.$getString('LabelTimeDurationXHours', ['2']),
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        }
      ]
      if (this.hasChapters) {
        times.push({ seconds: -1, text: this.$strings.LabelEndOfChapter, timerType: this.$constants.SleepTimerTypes.CHAPTER })
      }
      return times
    }
  },
  methods: {
    submitCustomTime() {
      if (!this.customTime || isNaN(this.customTime) || Number(this.customTime) <= 0) {
        this.customTime = null
        return
      }

      const timeInSeconds = Math.round(Number(this.customTime) * 60)
      const time = {
        seconds: timeInSeconds,
        timerType: this.$constants.SleepTimerTypes.COUNTDOWN
      }
      this.setTime(time)
    },
    setTime(time) {
      this.$emit('set', time)
    },
    increment(amount) {
      this.$emit('increment', amount)
    },
    decrement(amount) {
      if (amount > this.remaining) {
        if (this.remaining > 60) amount = 60
        else amount = 5
      }
      this.$emit('decrement', amount)
    }
  }
}
</script>
