import { computed } from 'vue'

// Common utility functions and constants
export const useAppUtils = () => {
  // Current year for copyright
  const currentYear = computed(() => new Date().getFullYear())

  // Supported patch formats
  const supportedFormats = [
    { value: 'ips', label: 'IPS' },
    { value: 'ups', label: 'UPS' },
    { value: 'bps', label: 'BPS' },
    { value: 'xdelta', label: 'xDelta' }
  ]

  // Format support text
  const formatSupportText = 'Supported formats: IPS, UPS, BPS, xDelta patches'

  return {
    currentYear,
    supportedFormats,
    formatSupportText
  }
}
