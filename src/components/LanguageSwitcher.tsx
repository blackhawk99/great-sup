import React from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

interface LanguageSwitcherProps {
  className?: string
  showLabel?: boolean
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  showLabel = false
}) => {
  const { i18n } = useTranslation()

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  ]

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0]

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'el' : 'en'
    i18n.changeLanguage(nextLang)
  }

  return (
    <button
      onClick={toggleLanguage}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
        bg-white/10 hover:bg-white/20 text-white ${className}`}
      aria-label={`Switch language to ${i18n.language === 'en' ? 'Greek' : 'English'}`}
    >
      <Globe className="h-4 w-4" />
      <span className="text-lg">{currentLang.flag}</span>
      {showLabel && <span className="text-sm font-medium">{currentLang.name}</span>}
    </button>
  )
}

// Dropdown version for settings page
export const LanguageDropdown: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  ]

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code)
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 w-full rounded-lg border
          border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      >
        <Globe className="h-4 w-4" />
        <span className="text-lg">{languages.find(l => l.code === i18n.language)?.flag}</span>
        <span className="flex-1 text-left">
          {languages.find(l => l.code === i18n.language)?.name}
        </span>
        <svg className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white
          border border-gray-300 rounded-lg shadow-lg z-50">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`flex items-center gap-2 px-4 py-2 w-full text-left
                hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg
                ${lang.code === i18n.language ? 'bg-blue-50' : ''}`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span className="text-gray-700">{lang.name}</span>
              {lang.code === i18n.language && (
                <svg className="h-4 w-4 ml-auto text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LanguageSwitcher
