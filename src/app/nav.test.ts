import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, isNavItemActive } from './nav'

const item = (to: string) => {
  const found = NAV_ITEMS.find((i) => i.to === to)
  if (!found) throw new Error(`no nav item ${to}`)
  return found
}

describe('isNavItemActive', () => {
  it('keeps "Lectures" active on lecture sub-pages only', () => {
    expect(isNavItemActive(item('/'), '/')).toBe(true)
    expect(isNavItemActive(item('/'), '/lectures/new')).toBe(true)
    expect(isNavItemActive(item('/'), '/lectures/abc')).toBe(true)
    expect(isNavItemActive(item('/'), '/settings')).toBe(false)
    expect(isNavItemActive(item('/'), '/lecturesx')).toBe(false)
  })

  it('matches a section and its sub-pages', () => {
    expect(isNavItemActive(item('/present'), '/present')).toBe(true)
    expect(isNavItemActive(item('/present'), '/present/abc')).toBe(true)
    expect(isNavItemActive(item('/present'), '/practice')).toBe(false)
  })
})
