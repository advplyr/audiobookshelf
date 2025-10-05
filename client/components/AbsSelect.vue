<template>
  <div class="relative" @keydown.stop>
    <button ref="btn" type="button" class="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left"
      :class="triggerClasses" :aria-expanded="open?'true':'false'" aria-haspopup="listbox"
      @click="toggle()" @keydown.down.prevent="openAndMove(1)" @keydown.up.prevent="openAndMove(-1)"
      @keydown.enter.prevent="commitActive()" @keydown.esc.prevent="open=false">
      <span class="truncate">{{ currentLabel || placeholder }}</span>
      <svg class="ml-2 h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clip-rule="evenodd"/>
      </svg>
    </button>

    <transition name="fade">
      <ul v-if="open" ref="list" role="listbox"
          class="absolute z-[10000] mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-2xl focus:outline-none"
          :class="listClasses" :aria-activedescendant="activeId" tabindex="0"
          @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="commitActive()" @keydown.esc.prevent="open=false">
        <li v-for="(opt,i) in options" :key="opt.value ?? opt.slug ?? i" :id="optionId(i)" role="option"
            :aria-selected="isSelected(opt)"
            class="cursor-pointer px-3 py-2 text-sm" :class="optionClasses(i)"
            @mouseenter="activeIndex=i" @mouseleave="activeIndex=-1" @click="select(opt)">
          {{ opt.label }}
        </li>
        <li v-if="!options?.length" class="px-3 py-2 text-sm opacity-70">No options</li>
      </ul>
    </transition>
  </div>
</template>

<script>
export default {
  name: 'AbsSelect',
  props: { modelValue: [String, Number, null], options: { type:Array, default:()=>[] }, placeholder: { type:String, default:'Select…' }, theme: { type:String, default:'auto' } },
  emits: ['update:modelValue','change'],
  data:()=>({ open:false, activeIndex:-1 }),
  computed:{
    isDark(){ if(this.theme==='dark') return true; if(this.theme==='light') return false; const el=document.documentElement, bd=document.body; return el.classList.contains('dark')||bd.classList.contains('dark') },
    currentLabel(){ const v=this.modelValue; return (this.options.find(o=>(o.value??o.slug)===v)?.label)||'' },
    activeId(){ return this.activeIndex>=0?this.optionId(this.activeIndex):null },
    triggerClasses(){ return this.isDark?'border-gray-600 bg-gray-800 text-gray-100':'border-gray-300 bg-white text-gray-900' },
    listClasses(){ return this.isDark?'bg-[#111827] text-[#e5e7eb] border-gray-700':'bg-white text-gray-900 border-gray-300' }
  },
  mounted(){ window.addEventListener('click',this.onOutside,true) },
  beforeUnmount(){ window.removeEventListener('click',this.onOutside,true) },
  methods:{
    optionId(i){ return `abs-opt-${i}` },
    isSelected(opt){ return (opt.value??opt.slug)===this.modelValue },
    toggle(){ this.open=!this.open; if(this.open){ const idx=Math.max(this.options.findIndex(o=>this.isSelected(o)),0); this.activeIndex=idx; this.$nextTick(()=>this.$refs.list?.focus()) }},
    onOutside(e){ if(this.open && !this.$el.contains(e.target)) this.open=false },
    openAndMove(d){ if(!this.open) this.toggle(); this.move(d) },
    move(d){ if(!this.options.length) return; const n=this.options.length; this.activeIndex=(((this.activeIndex===-1?0:this.activeIndex)+d)%n+n)%n },
    commitActive(){ if(this.activeIndex>=0) this.select(this.options[this.activeIndex]) },
    optionClasses(i){ return i===this.activeIndex?'bg-[#2563eb] text-white':(this.isDark?'hover:bg-[#1f2937]':'hover:bg-gray-100') },
    select(opt){ const v=opt.value??opt.slug; this.$emit('update:modelValue',v); this.$emit('change',v); this.open=false; this.$nextTick(()=>this.$refs.btn?.focus()) }
  }
}
</script>

<style scoped>
.fade-enter-active,.fade-leave-active{transition:opacity .12s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
</style>
