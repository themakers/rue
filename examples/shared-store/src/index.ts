import { computed, effectScope, reactive, watch } from '@themakers/rue'

export interface Todo {
  id: number
  title: string
  done: boolean
}

export const store = reactive({
  count: 0,
  nextTodoId: 3,
  todos: [
    { id: 1, title: 'Share one reactive store', done: true },
    { id: 2, title: 'Run it on every renderer', done: false },
  ] as Todo[],
  history: ['Store initialized'],
})

export const remainingTodos = computed(() => store.todos.filter((todo) => !todo.done).length)

const auditScope = effectScope(true)
auditScope.run(() => {
  watch(
    () => store.count,
    (count) => {
      store.history.unshift(`Counter changed to ${count}`)
      store.history.splice(4)
    },
  )
})

export function increment(): void {
  store.count++
}

export function addTodo(title = `Portable task ${store.nextTodoId}`): void {
  store.todos.push({ id: store.nextTodoId++, title, done: false })
}

export function toggleTodo(id: number): void {
  const todo = store.todos.find((item) => item.id === id)
  if (todo) todo.done = !todo.done
}

export function disposeStore(): void {
  auditScope.stop()
}
