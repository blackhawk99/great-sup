import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary, DatePickerModal, DeleteConfirmationModal } from '../helpers.jsx'

describe('Component Tests', () => {
  describe('ErrorBoundary', () => {
    it('renders children when no error', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Hello World</div>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })
  })

  describe('DatePickerModal', () => {
    const mockOnSelect = vi.fn()
    const mockOnClose = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('renders the date picker modal', () => {
      render(
        <DatePickerModal
          currentDate={new Date('2024-06-15')}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Select Date')).toBeInTheDocument()
      expect(screen.getByText('Today')).toBeInTheDocument()
      expect(screen.getByText('Tomorrow')).toBeInTheDocument()
    })

    it('displays the current month and year', () => {
      render(
        <DatePickerModal
          currentDate={new Date('2024-06-15')}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('June 2024')).toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DatePickerModal
          currentDate={new Date('2024-06-15')}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      )

      await user.click(screen.getByText('✕'))
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls onSelect with formatted date when Select is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DatePickerModal
          currentDate={new Date('2024-06-15')}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      )

      await user.click(screen.getByText('Select'))
      expect(mockOnSelect).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    })

    it('navigates to next month', async () => {
      const user = userEvent.setup()
      render(
        <DatePickerModal
          currentDate={new Date('2024-06-15')}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      )

      // Click next month button
      const buttons = screen.getAllByRole('button')
      const nextButton = buttons.find(btn => btn.querySelector('svg'))
      if (nextButton && nextButton.nextElementSibling === null) {
        await user.click(nextButton)
      }
    })

    it('displays day of week headers', () => {
      render(
        <DatePickerModal
          currentDate={new Date('2024-06-15')}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Su')).toBeInTheDocument()
      expect(screen.getByText('Mo')).toBeInTheDocument()
      expect(screen.getByText('Tu')).toBeInTheDocument()
      expect(screen.getByText('We')).toBeInTheDocument()
      expect(screen.getByText('Th')).toBeInTheDocument()
      expect(screen.getByText('Fr')).toBeInTheDocument()
      expect(screen.getByText('Sa')).toBeInTheDocument()
    })

    it('highlights today button', () => {
      render(
        <DatePickerModal
          currentDate={new Date()}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
        />
      )

      const todayButton = screen.getByText('Today')
      expect(todayButton).toBeInTheDocument()
    })
  })

  describe('DeleteConfirmationModal', () => {
    const mockOnConfirm = vi.fn()
    const mockOnCancel = vi.fn()

    const mockBeach = {
      id: '123',
      name: 'Test Beach',
      latitude: 37.5,
      longitude: 23.5,
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('renders delete confirmation with beach name', () => {
      render(
        <DeleteConfirmationModal
          beach={mockBeach}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument()
      expect(screen.getByText(/Test Beach/)).toBeInTheDocument()
    })

    it('calls onConfirm with beach id when Delete is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DeleteConfirmationModal
          beach={mockBeach}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      await user.click(screen.getByText('Delete'))
      expect(mockOnConfirm).toHaveBeenCalledWith('123')
    })

    it('calls onCancel when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DeleteConfirmationModal
          beach={mockBeach}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      await user.click(screen.getByText('Cancel'))
      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })

    it('returns null and calls onCancel for invalid beach', () => {
      vi.useFakeTimers()

      const { container } = render(
        <DeleteConfirmationModal
          beach={null as any}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      vi.runAllTimers()
      expect(container.firstChild).toBeNull()
      expect(mockOnCancel).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('displays Cancel and Delete buttons', () => {
      render(
        <DeleteConfirmationModal
          beach={mockBeach}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })
})
