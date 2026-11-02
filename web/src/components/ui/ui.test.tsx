import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, Field, IconButton, Input, Menu } from '.'

describe('Menu', () => {
  const setup = () => {
    const archive = vi.fn()
    const remove = vi.fn()
    render(
      <Menu
        trigger={(props) => (
          <button type="button" {...props}>
            Actions
          </button>
        )}
        items={[
          { label: 'Archive', onSelect: archive },
          { label: 'Remove', onSelect: remove, danger: true }
        ]}
      />
    )
    return { archive, remove }
  }

  it('opens on click, focuses the first item and runs the chosen action', async () => {
    const user = userEvent.setup()
    const { remove } = setup()
    const trigger = screen.getByRole('button', { name: 'Actions' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(remove).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus()
  })
})

describe('Field', () => {
  it('labels the control and announces the error', () => {
    render(<Field label="Email" error="Required">{(a11y) => <Input {...a11y} />}</Field>)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Required')
  })
})

describe('Button', () => {
  it('is disabled while loading', () => {
    render(<Button loading>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('gives icon-only buttons an accessible name', () => {
    render(<IconButton label="Close" icon={<span>x</span>} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
