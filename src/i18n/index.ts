import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import el from './locales/el.json'

// Detect browser language
const detectLanguage = (): string => {
  // Check localStorage first
  const saved = localStorage.getItem('sup-language')
  if (saved && ['en', 'el'].includes(saved)) {
    return saved
  }

  // Check browser language
  const browserLang = navigator.language.split('-')[0]
  if (['en', 'el'].includes(browserLang)) {
    return browserLang
  }

  return 'en' // Default to English
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      el: { translation: el },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  })

// Save language preference when changed
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('sup-language', lng)
  document.documentElement.lang = lng
})

export default i18n
