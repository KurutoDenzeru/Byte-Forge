import { ref } from 'vue'

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

  // Template refs
  const romFileInput = ref<HTMLInputElement>()
  const patchFileInput = ref<HTMLInputElement>()
  const originalRomFileInput = ref<HTMLInputElement>()
  const modifiedRomFileInput = ref<HTMLInputElement>()

  // Handle ROM file selection (patcher mode)
  const handleRomFileChange = async (event: Event, calculateHashes: (file: File) => Promise<void>, resetHashes: () => void) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]

    if (file) {
      romFile.value = file
      romFileName.value = file.name

      // Calculate hashes
      await calculateHashes(file)
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

    if (file) {
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

    if (file) {
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

    if (file) {
      modifiedRomFile.value = file
      modifiedRomFileName.value = file.name
    } else {
      modifiedRomFile.value = null
      modifiedRomFileName.value = ''
    }
  }

  return {
    // Patcher mode files
    romFile,
    patchFile,
    romFileName,
    patchFileName,
    
    // Creator mode files
    originalRomFile,
    modifiedRomFile,
    originalRomFileName,
    modifiedRomFileName,
    
    // Template refs
    romFileInput,
    patchFileInput,
    originalRomFileInput,
    modifiedRomFileInput,
    
    // Event handlers
    handleRomFileChange,
    handlePatchFileChange,
    handleOriginalRomFileChange,
    handleModifiedRomFileChange
  }
}
