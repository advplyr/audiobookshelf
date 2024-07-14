<template>
  <modals-modal v-model="show" name="sleep-timer" :width="350" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate pointer-events-none">{{ $strings.HeaderSleepTimer }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div class="w-full">
        <template v-for="time in sleepTimes">
          <div :key="time.text" class="flex items-center px-6 py-3 justify-center cursor-pointer hover:bg-bg relative" @click="setTime(time)">
            <p class="text-xl text-center">{{ time.text }}</p>
          </div>
        </template>
        <form class="flex items-center justify-center px-6 py-3" @submit.prevent="submitCustomTime">
          <ui-text-input v-model="customTime" type="number" step="any" min="0.1" placeholder="Time in minutes" class="w-48" />
          <ui-btn color="success" type="submit" :padding-x="0" class="h-9 w-12 flex items-center justify-center ml-1">Set</ui-btn>
        </form>
      </div>
      <div class="w-full p-4">
        <div v-if="timerType === $constants.SleepTimerTypes.COUNTDOWN" class="mb-4 flex items-center justify-center">
          <ui-btn :padding-x="2" small :disabled="remaining < 30 * 60" class="flex items-center mr-4" @click="decrement(30 * 60)">
            <span class="material-symbols text-lg">remove</span>
            <span class="pl-1 text-base font-mono">30m</span>
          </ui-btn>

          <ui-icon-btn icon="remove" @click="decrement(60 * 5)" />

          <p class="mx-6 text-2xl font-mono">{{ $secondsToTimestamp(remaining) }}</p>

          <ui-icon-btn icon="add" @click="increment(60 * 5)" />

          <ui-btn :padding-x="2" small class="flex items-center ml-4" @click="increment(30 * 60)">
            <span class="material-symbols text-lg">add</span>
            <span class="pl-1 text-base font-mono">30m</span>
          </ui-btn>
        </div>
        <ui-btn v-if="timerSet" class="w-full" @click="$emit('cancel')">{{ $strings.ButtonCancel }}</ui-btn>
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
    remaining: Number
  },
  data() {
    return {
      customTime: null,
      sleepTimes: [
        {
          seconds: 60 * 5,
          text: '5 minutes',
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 15,
          text: '15 minutes',
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 20,
          text: '20 minutes',
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 30,
          text: '30 minutes',
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 45,
          text: '45 minutes',
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 60,
          text: '60 minutes',
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 90,
          text: '90 minutes',
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        {
          seconds: 60 * 120,
          text: '2 hours',
          timerType: this.$constants.SleepTimerTypes.COUNTDOWN
        },
        { seconds: -1, text: 'End of chapter', timerType: this.$constants.SleepTimerTypes.CHAPTER }
      ]
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
