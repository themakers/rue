import '@expo/metro-runtime'
import './strict.css'
import { css, html } from 'react-strict-dom'
import { useReactivity } from '@themakers/rue'
import { addTodo, increment, remainingTodos, store, toggleTodo } from '@rue/shared-store'

export default function App() {
  const state = useReactivity(() => ({ store, remainingTodos }))
  const hermes = Boolean((globalThis as { HermesInternal?: unknown }).HermesInternal)

  return (
    <html.div data-layoutconformance="strict" style={styles.page}>
      <html.p style={styles.eyebrow}>RUE / STRICT DOM / {hermes ? 'HERMES' : 'WEB'}</html.p>
      <html.h1 style={styles.title}>Universal UI, identical state.</html.h1>
      <html.section style={styles.counter}>
        <html.strong style={styles.number}>{state.store.count}</html.strong>
        <html.button style={styles.primary} onClick={increment}>
          Increment
        </html.button>
      </html.section>
      <html.section style={styles.card}>
        <html.h2 style={styles.heading}>Tasks / {state.remainingTodos.value} open</html.h2>
        {state.store.todos.map((todo) => (
          <html.button key={todo.id} style={styles.todo} onClick={() => toggleTodo(todo.id)}>
            {todo.done ? 'DONE' : 'OPEN'} / {todo.title}
          </html.button>
        ))}
        <html.button style={styles.secondary} onClick={() => addTodo()}>
          Add generated task
        </html.button>
      </html.section>
      <html.aside style={styles.log}>
        <html.strong>watch() history</html.strong>
        {state.store.history.map((entry, index) => (
          <html.p key={`${entry}-${index}`}>{entry}</html.p>
        ))}
      </html.aside>
    </html.div>
  )
}

const styles = css.create({
  page: { minHeight: '100vh', padding: 24, gap: 18, backgroundColor: '#efe8d8', color: '#1e2822' },
  eyebrow: { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: 52, lineHeight: 1, marginBlock: 8 },
  counter: {
    minHeight: 220,
    padding: 22,
    backgroundColor: '#d8f15c',
    borderWidth: 1,
    borderStyle: 'solid',
    justifyContent: 'space-between',
  },
  number: { fontSize: 96, lineHeight: 1 },
  primary: { alignSelf: 'flex-start', backgroundColor: '#1e2822', color: '#ffffff', padding: 14 },
  card: { padding: 20, borderWidth: 1, borderStyle: 'solid', gap: 10 },
  heading: { fontSize: 26, marginBlock: 4 },
  todo: {
    paddingBlock: 14,
    borderWidth: 0,
    borderBlockEndWidth: 1,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    textAlign: 'start',
  },
  secondary: {
    alignSelf: 'flex-start',
    padding: 12,
    backgroundColor: '#f5a94a',
    borderWidth: 1,
    borderStyle: 'solid',
  },
  log: { padding: 20, backgroundColor: '#232d27', color: '#efe8d8' },
})
