import { ref, computed, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>('system')
const systemTheme = ref<'light' | 'dark'>('light')

// Check if we're running in the browser
const isBrowser = process.client

// Initialize theme from localStorage if available
if (isBrowser) {
  const savedTheme = localStorage.getItem('theme') as Theme
  if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
    theme.value = savedTheme
  }

  // Set up system theme detection
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemTheme.value = mediaQuery.matches ? 'dark' : 'light'
  
  // Listen for system theme changes
  mediaQuery.addEventListener('change', (e) => {
    systemTheme.value = e.matches ? 'dark' : 'light'
  })
}

// Computed property for the actual theme to apply
const actualTheme = computed(() => {
  if (theme.value === 'system') {
    return systemTheme.value
  }
  return theme.value
})

// Apply theme to document
const applyTheme = (newTheme: 'light' | 'dark') => {
  if (!isBrowser) return
  
  const root = document.documentElement
  
  if (newTheme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// Watch for theme changes and apply them
if (isBrowser) {
  watch(
    actualTheme,
    (newTheme) => {
      applyTheme(newTheme)
    },
    { immediate: true }
  )

  // Save theme preference to localStorage
  watch(
    theme,
    (newTheme) => {
      localStorage.setItem('theme', newTheme)
    },
    { immediate: true }
  )
}

export const useTheme = () => {
  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
  }

  return {
    theme: readonly(theme),
    actualTheme: readonly(actualTheme),
    setTheme,
    themes: ['light', 'dark', 'system'] as const
  }
}
