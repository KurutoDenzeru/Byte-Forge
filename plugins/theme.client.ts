export default defineNuxtPlugin(() => {
  // Initialize theme on client side to prevent flash
  if (process.client) {
    const savedTheme = localStorage.getItem('theme')
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    
    let themeToApply = 'light'
    
    if (savedTheme === 'dark') {
      themeToApply = 'dark'
    } else if (savedTheme === 'system' || !savedTheme) {
      themeToApply = systemTheme
    }
    
    if (themeToApply === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
})
