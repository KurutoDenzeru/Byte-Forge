import { reactive, ref } from 'vue'
import { HashCalculator } from '~/lib/core/hash-calculator'
import type { FileHashes, HashProgress } from '~/lib/types/rom-patcher'

export const useHashCalculator = () => {
  // File hashes
  const fileHashes = reactive<FileHashes>({
    crc32: '',
    md5: '',
    sha1: ''
  })

  // Progress tracking
  const isCalculating = ref(false)
  const calculationProgress = ref(0)
  const calculationError = ref<string | null>(null)

  // Calculate file hashes with progress tracking
  const calculateHashes = async (file: File) => {
    isCalculating.value = true
    calculationProgress.value = 0
    calculationError.value = null

    // Reset hashes
    fileHashes.crc32 = 'Calculating...'
    fileHashes.md5 = 'Calculating...'
    fileHashes.sha1 = 'Calculating...'

    try {
      // Convert File to Uint8Array
      const arrayBuffer = await file.arrayBuffer()
      const data = new Uint8Array(arrayBuffer)

      // Progress callback
      const onProgress = (progress: HashProgress) => {
        calculationProgress.value = Math.round(progress.percentage)
      }

      // Calculate all hashes
      const hashes = await HashCalculator.calculateHashes(data, onProgress)

      // Update reactive hashes
      fileHashes.crc32 = hashes.crc32
      fileHashes.md5 = hashes.md5
      fileHashes.sha1 = hashes.sha1

      calculationProgress.value = 100
    } catch (error) {
      console.error('Hash calculation error:', error)
      calculationError.value = error instanceof Error ? error.message : 'Unknown error occurred'
      
      // Reset to empty on error
      resetHashes()
    } finally {
      isCalculating.value = false
    }
  }

  // Calculate hashes for binary data directly
  const calculateHashesFromData = async (data: Uint8Array) => {
    isCalculating.value = true
    calculationProgress.value = 0
    calculationError.value = null

    try {
      const onProgress = (progress: HashProgress) => {
        calculationProgress.value = Math.round(progress.percentage)
      }

      const hashes = await HashCalculator.calculateHashes(data, onProgress)
      
      fileHashes.crc32 = hashes.crc32
      fileHashes.md5 = hashes.md5
      fileHashes.sha1 = hashes.sha1

      calculationProgress.value = 100
      return hashes
    } catch (error) {
      console.error('Hash calculation error:', error)
      calculationError.value = error instanceof Error ? error.message : 'Unknown error occurred'
      resetHashes()
      throw error
    } finally {
      isCalculating.value = false
    }
  }

  // Reset hashes
  const resetHashes = () => {
    fileHashes.crc32 = ''
    fileHashes.md5 = ''
    fileHashes.sha1 = ''
    calculationProgress.value = 0
    calculationError.value = null
  }

  return {
    fileHashes,
    isCalculating: readonly(isCalculating),
    calculationProgress: readonly(calculationProgress),
    calculationError: readonly(calculationError),
    calculateHashes,
    calculateHashesFromData,
    resetHashes
  }
}
