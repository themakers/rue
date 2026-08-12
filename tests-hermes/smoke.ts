import { computed, effect, reactive, ref } from '@vue/reactivity'

const state = reactive({ count: 1 })
const multiplier = ref(2)
const total = computed(() => state.count * multiplier.value)
let observed = 0

effect(() => {
  observed = total.value
})

state.count = 3
multiplier.value = 4

if (observed !== 12) throw new Error(`Expected 12, received ${observed}`)
if (typeof Proxy !== 'function' || typeof Reflect !== 'object') {
  throw new Error('Hermes is missing required JavaScript primitives')
}

print('Hermes reactivity smoke passed')
