import React, { useState, useRef, useEffect } from 'react'

import './style.scss'

export interface DropdownOption {
  value: string
  label: string
}

interface CustomDropdownProps {
  options: DropdownOption[]
  onSelect: (option: DropdownOption) => void
  children: React.ReactNode
  placeholder?: string
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  onSelect,
  children,
  placeholder = "Select an option..."
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<DropdownOption | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTriggerClick = () => {
    setIsOpen(!isOpen)
  }

  const handleOptionClick = (option: DropdownOption) => {
    setSelectedOption(option)
    onSelect(option)
    setIsOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className="CustomDropdown" ref={dropdownRef}>
      {/* Trigger Element */}
      <div
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className="CustomDropdown__trigger"
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {children ?? placeholder}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="CustomDropdown__list">
          <div
            className="CustomDropdown__list__wrapper"
            role="listbox"
            // style={{
            //   // Native select styling
            //   fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            //   fontSize: '14px',
            //   lineHeight: '1.4',
            // }}
          >
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => handleOptionClick(option)}
                className="CustomDropdown__list__option"
                role="option"
                aria-selected={selectedOption?.value === option.value}
                // style={{
                //   // Match native option styling
                //   backgroundColor: selectedOption?.value === option.value ? '#e6f3ff' : 'transparent',
                //   color: selectedOption?.value === option.value ? '#1e40af' : '#374151',
                // }}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden native select for form compatibility (optional) */}
      {/*<select
        value={selectedOption?.value || ''}
        onChange={() => {}} // Controlled by our custom logic
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>*/}
    </div>
  )
}

export default CustomDropdown