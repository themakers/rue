import { expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { isRef, useTemplateRef, type TemplateRef } from '../src'

test('<useTemplateRef> binds one Vue ref directly to a JSX ref', () => {
  let templateRef!: TemplateRef<HTMLDivElement>

  function Fixture() {
    templateRef = useTemplateRef<HTMLDivElement>()
    return <div ref={templateRef}>template ref</div>
  }

  const fixture = render(<Fixture />)
  const element = fixture.getByText('template ref')

  expect(isRef(templateRef)).toBe(true)
  expect(templateRef.value).toBe(element)
  expect(templateRef.current).toBe(element)

  fixture.unmount()

  expect(templateRef.value).toBeNull()
  expect(templateRef.current).toBeNull()
})
