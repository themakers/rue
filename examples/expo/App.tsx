import { StatusBar } from 'expo-status-bar'
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useReactivity } from '@themakers/rue'
import { addTodo, increment, remainingTodos, store, toggleTodo } from '@rue/shared-store'

export default function App() {
  const state = useReactivity(() => ({ store, remainingTodos }))
  const hermes = Boolean((globalThis as { HermesInternal?: unknown }).HermesInternal)

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.eyebrow}>RUE / NATIVE / {hermes ? 'HERMES' : 'JSC'}</Text>
        <Text style={styles.title}>One store. Native surface.</Text>
        <View style={styles.counter}>
          <Text style={styles.number}>{state.store.count}</Text>
          <Pressable accessibilityRole="button" style={styles.primary} onPress={increment}>
            <Text style={styles.primaryText}>Increment</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Tasks / {state.remainingTodos.value} open</Text>
          {state.store.todos.map((todo) => (
            <Pressable key={todo.id} style={styles.todo} onPress={() => toggleTodo(todo.id)}>
              <Text style={todo.done ? styles.done : styles.todoText}>
                {todo.done ? 'DONE' : 'OPEN'} {todo.title}
              </Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => addTodo()}>
            <Text>Add generated task</Text>
          </Pressable>
        </View>
        <View style={styles.log}>
          <Text style={styles.logTitle}>watch() history</Text>
          {state.store.history.map((entry, index) => (
            <Text key={`${entry}-${index}`} style={styles.logText}>
              {entry}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#efe8d8' },
  page: { padding: 24, gap: 18 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: '#47534c' },
  title: { fontSize: 54, lineHeight: 52, fontWeight: '800', color: '#1e2822' },
  counter: {
    minHeight: 220,
    padding: 22,
    backgroundColor: '#d8f15c',
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  number: { fontSize: 96, lineHeight: 100, fontWeight: '800' },
  primary: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e2822',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  primaryText: { color: '#ffffff', fontWeight: '700' },
  card: { padding: 20, borderWidth: 1, gap: 10 },
  heading: { fontSize: 25, fontWeight: '800', marginBottom: 8 },
  todo: { borderTopWidth: 1, paddingVertical: 14 },
  todoText: { color: '#1e2822' },
  done: { color: '#6f776f', textDecorationLine: 'line-through' },
  secondary: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 8,
  },
  log: { padding: 20, backgroundColor: '#232d27', gap: 7 },
  logTitle: { color: '#d8f15c', fontWeight: '700', marginBottom: 5 },
  logText: { color: '#efe8d8' },
})
