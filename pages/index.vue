<template>
  <div
    class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
    <!-- Top navigation with theme switcher and creator mode -->
    <div class="flex justify-end items-center p-4">

      <ThemeSwitcher />
    </div>

    <!-- Main content -->
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <!-- Header -->
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Universal ROM Patcher
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            Apply patches to your ROM files with ease
          </p>
        </div>

        <!-- Main Card -->
        <div class="flex items-center space-x-3 space-y-3 justify-end">
          <Label for="creator-mode" class="text-sm font-medium">Creator Mode</Label>
          <Switch id="creator-mode" class="mb-3" v-model:checked="isCreatorMode" />
        </div>
        <Card class="shadow-lg">
          <CardHeader>
            <CardTitle class="text-xl text-center">
              {{ isCreatorMode ? 'Patch Creator' : 'ROM Patcher' }}
            </CardTitle>
            <CardDescription class="text-center">
              {{ isCreatorMode ? 'Create patches from ROM differences' : 'Upload your ROM and patch files to get started' }}
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Patcher Mode Content -->
            <div v-if="!isCreatorMode">
              <!-- ROM File Upload -->
              <div class="space-y-4 pb-4">
                <Label for="rom-file">ROM File</Label>
                <div class="flex items-center space-x-2">
                  <Input id="rom-file" type="file" accept=".rom,.nes,.smc,.sfc,.gb,.gbc,.gba,.z64,.n64,.iso"
                    ref="romFileInput" @change="handleRomFileChange" class="flex-1" />
                </div>
              </div>              <!-- File Hashes -->
              <div class="grid grid-cols-1">
                <div class="flex items-center space-x-2">
                  <Label class="min-w-[60px] text-gray-600 dark:text-gray-200 indent-8">CRC32:</Label>
                  <p class="font-mono text-sm text-gray-700 dark:text-gray-300 px-3 py-2 flex-1">
                    {{ fileHashes.crc32 || 'CRC32 hash will appear here' }}
                  </p>
                </div>

                <div class="flex items-center space-x-2">
                  <Label class="min-w-[60px] text-gray-600 dark:text-gray-200 indent-8">MD5:</Label>
                  <p class="font-mono text-sm text-gray-700 dark:text-gray-300 px-3 py-2 flex-1">
                    {{ fileHashes.md5 || 'MD5 hash will appear here' }}
                  </p>
                </div>

                <div class="flex items-center space-x-2">
                  <Label class="min-w-[60px] text-gray-600 dark:text-gray-200 indent-8">SHA-1:</Label>
                  <p class="font-mono text-sm text-gray-700 dark:text-gray-300 px-3 py-2 flex-1">
                    {{ fileHashes.sha1 || 'SHA-1 hash will appear here' }}
                  </p>
                </div>
              </div>

              <!-- Patch File Upload -->
              <div class="space-y-2 pt-4">
                <Label for="patch-file">Patch File</Label>
                <div class="flex items-center space-x-2">
                  <Input id="patch-file" type="file" accept=".ips,.ups,.bps,.xdelta,.patch" ref="patchFileInput"
                    @change="handlePatchFileChange" class="flex-1" />
                </div>
                <!-- <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ patchFileName || 'No File Chosen' }}
              </p> -->
              </div>
            </div>

            <!-- Creator Mode Content -->
            <div v-else>
              <!-- Original ROM File Upload -->
              <div class="space-y-2">
                <Label for="original-rom-file">Original ROM</Label>
                <div class="flex items-center space-x-2">
                  <Input id="original-rom-file" type="file" accept=".rom,.nes,.smc,.sfc,.gb,.gbc,.gba,.z64,.n64,.iso"
                    ref="originalRomFileInput" @change="handleOriginalRomFileChange" class="flex-1" />
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ originalRomFileName || 'No File Chosen' }}
                </p>
              </div>

              <!-- Modified ROM File Upload -->
              <div class="space-y-2">
                <Label for="modified-rom-file">Modified ROM</Label>
                <div class="flex items-center space-x-2">
                  <Input id="modified-rom-file" type="file" accept=".rom,.nes,.smc,.sfc,.gb,.gbc,.gba,.z64,.n64,.iso"
                    ref="modifiedRomFileInput" @change="handleModifiedRomFileChange" class="flex-1" />
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ modifiedRomFileName || 'No File Chosen' }}
                </p>
              </div>

              <!-- Patch Type Selection -->
              <div class="space-y-2">
                <Label for="patch-type">Patch Type</Label>
                <Select v-model="selectedPatchType">
                  <SelectTrigger id="patch-type">
                    <SelectValue placeholder="Select patch type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ips">IPS</SelectItem>
                    <SelectItem value="bps">BPS</SelectItem>
                    <SelectItem value="ppf">PPF</SelectItem>
                    <SelectItem value="ups">UPS</SelectItem>
                    <SelectItem value="aps">APS</SelectItem>
                    <SelectItem value="rup">RUP</SelectItem>
                    <SelectItem value="ebp">EBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button @click="isCreatorMode ? createPatch() : applyPatch()"
              :disabled="isCreatorMode ? (!originalRomFile || !modifiedRomFile || !selectedPatchType || isProcessing) : (!romFile || !patchFile || isProcessing)"
              class="w-full" size="lg">
              <span v-if="isProcessing">Processing...</span>
              <span v-else-if="isCreatorMode">Create Patch</span>
              <span v-else>Apply Patch</span>
            </Button>
          </CardFooter>
        </Card> <!-- Footer -->
        <div class="mt-8 text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Supported formats: IPS, UPS, BPS, xDelta patches
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'

// Creator mode toggle
const isCreatorMode = ref(false)

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
const selectedPatchType = ref<string>('')

const isProcessing = ref(false)

// File hashes
const fileHashes = reactive({
  crc32: '',
  md5: '',
  sha1: ''
})

// Template refs
const romFileInput = ref<HTMLInputElement>()
const patchFileInput = ref<HTMLInputElement>()
const originalRomFileInput = ref<HTMLInputElement>()
const modifiedRomFileInput = ref<HTMLInputElement>()

// Handle ROM file selection (patcher mode)
const handleRomFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    romFile.value = file
    romFileName.value = file.name
    
    // Calculate hashes (placeholder for now)
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

// Calculate file hashes (placeholder implementation)
const calculateHashes = async (file: File) => {
  // This is a placeholder - in a real implementation, you'd calculate actual hashes
  fileHashes.crc32 = 'Calculating...'
  fileHashes.md5 = 'Calculating...'
  fileHashes.sha1 = 'Calculating...'
  
  // Simulate hash calculation delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Placeholder values - replace with actual hash calculation
  fileHashes.crc32 = 'A1B2C3D4'
  fileHashes.md5 = '5d41402abc4b2a76b9719d911017c592'
  fileHashes.sha1 = 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'
}

// Reset hashes
const resetHashes = () => {
  fileHashes.crc32 = ''
  fileHashes.md5 = ''
  fileHashes.sha1 = ''
}

// Apply patch function (patcher mode)
const applyPatch = async () => {
  if (!romFile.value || !patchFile.value) {
    return
  }
  
  isProcessing.value = true
  
  try {
    // Placeholder for patch application logic
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Here you would implement the actual patch application logic
    console.log('Applying patch:', patchFile.value.name, 'to ROM:', romFile.value.name)
    
    // Show success message or download result
    alert('Patch applied successfully!')
  } catch (error) {
    console.error('Error applying patch:', error)
    alert('Error applying patch. Please try again.')
  } finally {
    isProcessing.value = false
  }
}

// Create patch function (creator mode)
const createPatch = async () => {
  if (!originalRomFile.value || !modifiedRomFile.value || !selectedPatchType.value) {
    return
  }
  
  isProcessing.value = true
  
  try {
    // Placeholder for patch creation logic
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Here you would implement the actual patch creation logic
    console.log('Creating', selectedPatchType.value.toUpperCase(), 'patch from:', originalRomFile.value.name, 'to:', modifiedRomFile.value.name)
    
    // Show success message or download result
    alert(`${selectedPatchType.value.toUpperCase()} patch created successfully!`)
  } catch (error) {
    console.error('Error creating patch:', error)
    alert('Error creating patch. Please try again.')
  } finally {
    isProcessing.value = false
  }
}

// Set page title
useHead({
  title: 'Universal ROM Patcher'
})
</script>