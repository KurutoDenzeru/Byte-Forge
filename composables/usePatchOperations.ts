import { ref, type Ref } from 'vue'
import { BinFile } from '~/lib/core/binary-file'
import { RomPatcher } from '~/lib/core/rom-patcher'
import { PatchFormat } from '~/lib/types/rom-patcher'
import type { BinaryFile, PatchFile, PatchOptions } from '~/lib/types/rom-patcher'

export const usePatchOperations = () => {
  const isProcessing = ref(false)
  const selectedPatchType = ref<PatchFormat>(PatchFormat.IPS)
  const operationProgress = ref(0)
  const operationError = ref<string | null>(null)
  const operationSuccess = ref<string | null>(null)

  // Apply patch function (patcher mode)
  const applyPatch = async (
    romFile: Ref<File | null>,
    patchFile: Ref<File | null>,
    options?: Partial<PatchOptions>
  ) => {
    if (!romFile.value || !patchFile.value) {
      throw new Error('Both ROM and patch files are required')
    }

    isProcessing.value = true
    operationProgress.value = 0
    operationError.value = null
    operationSuccess.value = null

    try {
      // Convert files to BinaryFile objects
      operationProgress.value = 10
      const romBinFile = await BinFile.fromFile(romFile.value)
      
      operationProgress.value = 20
      const patchBinFile = await BinFile.fromFile(patchFile.value)

      // Parse patch file
      operationProgress.value = 30
      const patch = RomPatcher.parsePatchFile(patchBinFile)

      // Validate ROM if required
      operationProgress.value = 40
      if (options?.requireValidation) {
        const isValid = RomPatcher.validateRom(romBinFile, patch)
        if (!isValid) {
          throw new Error('ROM validation failed - this patch may not be compatible with the selected ROM')
        }
      }

      // Apply patch
      operationProgress.value = 60
      const patchedRom = RomPatcher.applyPatch(romBinFile, patch, options)

      // Trigger download
      operationProgress.value = 90
      patchedRom.save()

      operationProgress.value = 100
      operationSuccess.value = `Patch applied successfully! File saved as: ${patchedRom.fileName}`

    } catch (error) {
      console.error('Error applying patch:', error)
      operationError.value = error instanceof Error ? error.message : 'Unknown error occurred while applying patch'
    } finally {
      isProcessing.value = false
    }
  }

  // Create patch function (creator mode)
  const createPatch = async (
    originalRomFile: Ref<File | null>,
    modifiedRomFile: Ref<File | null>,
    patchType: Ref<PatchFormat>,
    metadata?: Record<string, string>
  ) => {
    if (!originalRomFile.value || !modifiedRomFile.value) {
      throw new Error('Both original and modified ROM files are required')
    }

    isProcessing.value = true
    operationProgress.value = 0
    operationError.value = null
    operationSuccess.value = null

    try {
      // Convert files to BinaryFile objects
      operationProgress.value = 10
      const originalBinFile = await BinFile.fromFile(originalRomFile.value)
      
      operationProgress.value = 20
      const modifiedBinFile = await BinFile.fromFile(modifiedRomFile.value)

      // Create patch
      operationProgress.value = 50
      const patch = RomPatcher.createPatch(
        originalBinFile,
        modifiedBinFile,
        patchType.value,
        metadata
      )

      // Export patch
      operationProgress.value = 80
      const baseName = originalBinFile.getName()
      const patchFile = patch.export(baseName)

      // Trigger download
      operationProgress.value = 95
      patchFile.save()

      operationProgress.value = 100
      operationSuccess.value = `${patchType.value.toUpperCase()} patch created successfully! File saved as: ${patchFile.fileName}`

    } catch (error) {
      console.error('Error creating patch:', error)
      operationError.value = error instanceof Error ? error.message : 'Unknown error occurred while creating patch'
    } finally {
      isProcessing.value = false
    }
  }

  // Validate patch file
  const validatePatchFile = async (patchFile: File): Promise<{ isValid: boolean; format?: string; info?: string; error?: string }> => {
    try {
      const patchBinFile = await BinFile.fromFile(patchFile)
      const patch = RomPatcher.parsePatchFile(patchBinFile)
      
      return {
        isValid: true,
        format: selectedPatchType.value,
        info: patch.toString()
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid patch file'
      }
    }
  }

  // Get supported patch formats
  const getSupportedFormats = (): PatchFormat[] => {
    return Object.values(PatchFormat)
  }

  // Reset operation state
  const resetOperationState = () => {
    operationProgress.value = 0
    operationError.value = null
    operationSuccess.value = null
  }

  return {
    isProcessing: readonly(isProcessing),
    selectedPatchType,
    operationProgress: readonly(operationProgress),
    operationError: readonly(operationError),
    operationSuccess: readonly(operationSuccess),
    applyPatch,
    createPatch,
    validatePatchFile,
    getSupportedFormats,
    resetOperationState
  }
}
