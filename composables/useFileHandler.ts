import { ref } from 'vue'
import { HashCalculator } from '../core/hash-calculator'

export const useFileHandler = () => {
  // File references for patcher mode
  const romFile = ref<File | null>(null)
  const patchFile = ref<File | null>(null)
  const romFileName = ref<string>('')
  const patchFileName = ref<string>('')

  // File references for creator mode
  const originalRomFile = ref<File | null>(null)
  const modifiedRomFile = ref<File | null>(null)
  const originalRomFileName = ref<string>('')
  const modifiedRomFileName = ref<string>('')

  // File validation and error states
  const romFileError = ref<string | null>(null)
  const patchFileError = ref<string | null>(null)
  const originalRomFileError = ref<string | null>(null)
  const modifiedRomFileError = ref<string | null>(null)

  // Template refs
  const romFileInput = ref<HTMLInputElement>()
  const patchFileInput = ref<HTMLInputElement>()
  const originalRomFileInput = ref<HTMLInputElement>()
  const modifiedRomFileInput = ref<HTMLInputElement>()

  // File size limits (in bytes)
  const MAX_ROM_SIZE = 64 * 1024 * 1024 // 64MB
  const MAX_PATCH_SIZE = 16 * 1024 * 1024 // 16MB

  // Supported file extensions
  const SUPPORTED_ROM_EXTENSIONS = [
    'nes', 'smc', 'sfc', 'gb', 'gbc', 'gba', 'z64', 'n64', 'v64',
    'md', 'bin', 'fds', 'lnx', 'swc', 'fig'
  ]
  
  const SUPPORTED_PATCH_EXTENSIONS = [
    'ips', 'ups', 'bps', 'aps', 'rup', 'ppf', 'mod', 'xdelta', 'vcdiff', 'ebp'
  ]

  // File validation functions
  const validateRomFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_ROM_SIZE) {
      return `ROM file is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is ${MAX_ROM_SIZE / 1024 / 1024}MB.`
    }

    if (file.size === 0) {
      return 'ROM file is empty.'
    }

    // Check file extension
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !SUPPORTED_ROM_EXTENSIONS.includes(extension)) {
      return `Unsupported ROM file format. Supported formats: ${SUPPORTED_ROM_EXTENSIONS.join(', ')}`
    }

    return null
  }

  const validatePatchFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_PATCH_SIZE) {
      return `Patch file is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is ${MAX_PATCH_SIZE / 1024 / 1024}MB.`
    }

    if (file.size === 0) {
      return 'Patch file is empty.'
    }

    // Check file extension
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !SUPPORTED_PATCH_EXTENSIONS.includes(extension)) {
      return `Unsupported patch file format. Supported formats: ${SUPPORTED_PATCH_EXTENSIONS.join(', ')}`
    }

    return null
  }

  // Handle ROM file selection (patcher mode)
  const handleRomFileChange = async (
    event: Event, 
    calculateHashes: (file: File) => Promise<void>, 
    resetHashes: () => void
  ) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]

    // Reset previous state
    romFileError.value = null

    if (file) {
      // Validate file
      const validationError = validateRomFile(file)
      if (validationError) {
        romFileError.value = validationError
        romFile.value = null
        romFileName.value = ''
        resetHashes()
        return
      }

      romFile.value = file
      romFileName.value = file.name

      try {
        // Calculate hashes
        const hashes = await HashCalculator.calculateHashes(file);
        console.log('File hashes:', hashes);
      } catch (error) {
        console.error('Error calculating hashes:', error)
        romFileError.value = 'Failed to calculate file hashes. The file may be corrupted.'
      }
    } else {
      romFile.value = null
      romFileName.value = ''
      resetHashes()
    }
  }

  // Handle patch file selection (patcher mode)
  const handlePatchFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]

    // Reset previous state
    patchFileError.value = null

    if (file) {
      // Validate file
      const validationError = validatePatchFile(file)
      if (validationError) {
        patchFileError.value = validationError
        patchFile.value = null
        patchFileName.value = ''
        return
      }

      patchFile.value = file
      patchFileName.value = file.name
    } else {
      patchFile.value = null
      patchFileName.value = ''
    }
  }

  // Handle original ROM file selection (creator mode)
  const handleOriginalRomFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]

    // Reset previous state
    originalRomFileError.value = null

    if (file) {
      // Validate file
      const validationError = validateRomFile(file)
      if (validationError) {
        originalRomFileError.value = validationError
        originalRomFile.value = null
        originalRomFileName.value = ''
        return
      }

      originalRomFile.value = file
      originalRomFileName.value = file.name
    } else {
      originalRomFile.value = null
      originalRomFileName.value = ''
    }
  }

  // Handle modified ROM file selection (creator mode)
  const handleModifiedRomFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]

    // Reset previous state
    modifiedRomFileError.value = null

    if (file) {
      // Validate file
      const validationError = validateRomFile(file)
      if (validationError) {
        modifiedRomFileError.value = validationError
        modifiedRomFile.value = null
        modifiedRomFileName.value = ''
        return
      }

      modifiedRomFile.value = file
      modifiedRomFileName.value = file.name
    } else {
      modifiedRomFile.value = null
      modifiedRomFileName.value = ''
    }
  }

  // Clear all files and reset state
  const clearAllFiles = () => {
    // Patcher mode files
    romFile.value = null
    patchFile.value = null
    romFileName.value = ''
    patchFileName.value = ''
    romFileError.value = null
    patchFileError.value = null

    // Creator mode files
    originalRomFile.value = null
    modifiedRomFile.value = null
    originalRomFileName.value = ''
    modifiedRomFileName.value = ''
    originalRomFileError.value = null
    modifiedRomFileError.value = null

    // Clear file inputs
    if (romFileInput.value) romFileInput.value.value = ''
    if (patchFileInput.value) patchFileInput.value.value = ''
    if (originalRomFileInput.value) originalRomFileInput.value.value = ''
    if (modifiedRomFileInput.value) modifiedRomFileInput.value.value = ''
  }

  // Get file size in human readable format
  const getHumanReadableSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return {
    // Patcher mode files
    romFile: readonly(romFile),
    patchFile: readonly(patchFile),
    romFileName: readonly(romFileName),
    patchFileName: readonly(patchFileName),
    
    // Creator mode files
    originalRomFile: readonly(originalRomFile),
    modifiedRomFile: readonly(modifiedRomFile),
    originalRomFileName: readonly(originalRomFileName),
    modifiedRomFileName: readonly(modifiedRomFileName),
    
    // Error states
    romFileError: readonly(romFileError),
    patchFileError: readonly(patchFileError),
    originalRomFileError: readonly(originalRomFileError),
    modifiedRomFileError: readonly(modifiedRomFileError),
    
    // Template refs
    romFileInput,
    patchFileInput,
    originalRomFileInput,
    modifiedRomFileInput,
    
    // Event handlers
    handleRomFileChange,
    handlePatchFileChange,
    handleOriginalRomFileChange,
    handleModifiedRomFileChange,
    
    // Utility functions
    clearAllFiles,
    getHumanReadableSize,
    
    // Constants
    SUPPORTED_ROM_EXTENSIONS,
    SUPPORTED_PATCH_EXTENSIONS,
    MAX_ROM_SIZE,
    MAX_PATCH_SIZE
  }
}
