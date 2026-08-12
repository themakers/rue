import { useReactive, useReactivity } from '@themakers/rue'
import { addTodo, increment, remainingTodos, store, toggleTodo } from '@rue/shared-store'

function LocalTodos() {
  const state = useReactive({
    draft: '',
    nextId: 2,
    todos: [{ id: 1, title: 'Owned by this component', done: false }],
  })

  const add = () => {
    const title = state.draft.trim()
    if (!title) return
    state.todos.push({ id: state.nextId++, title, done: false })
    state.draft = ''
  }

  return (
    <section className="todos">
      <div className="section-title">
        <h2>Local useReactive tasks</h2>
        <span>{state.todos.filter((todo) => !todo.done).length} remaining</span>
      </div>
      <input
        aria-label="Local task title"
        value={state.draft}
        onChange={(event) => (state.draft = event.target.value)}
      />
      <button className="add" onClick={add}>
        Add local task
      </button>
      <ul>
        {state.todos.map((todo) => (
          <li key={todo.id}>
            <button className={todo.done ? 'done' : ''} onClick={() => (todo.done = !todo.done)}>
              <span>{todo.done ? 'Done' : 'Open'}</span>
              {todo.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function App() {
  const state = useReactivity(() => ({ store, remainingTodos }))

  return (
    <main>
      <header>
        <p className="eyebrow">Rue / renderer 01</p>
        <h1>
          Mutable state,
          <br />
          ordinary React.
        </h1>
        <p className="lede">
          The same Vue-powered store runs here, in React Native, and through React Strict DOM.
        </p>
      </header>

      <section className="counter" aria-label="Counter demo">
        <div>
          <span className="label">Global counter</span>
          <strong>{state.store.count.toString().padStart(2, '0')}</strong>
        </div>
        <button onClick={increment}>Increment</button>
      </section>

      <section className="todos">
        <div className="section-title">
          <h2>Portable tasks</h2>
          <span>{state.remainingTodos.value} remaining</span>
        </div>
        <ul>
          {state.store.todos.map((todo) => (
            <li key={todo.id}>
              <button className={todo.done ? 'done' : ''} onClick={() => toggleTodo(todo.id)}>
                <span>{todo.done ? 'Done' : 'Open'}</span>
                {todo.title}
              </button>
            </li>
          ))}
        </ul>
        <button className="add" onClick={() => addTodo()}>
          Add generated task
        </button>
      </section>

      <LocalTodos />

      <aside>
        <span className="label">watch() history</span>
        {state.store.history.map((entry, index) => (
          <p key={`${entry}-${index}`}>{entry}</p>
        ))}
      </aside>
    </main>
  )
}
