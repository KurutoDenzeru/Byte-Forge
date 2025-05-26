<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
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
      <Card class="shadow-lg">
        <CardHeader>
          <CardTitle class="text-xl text-center">ROM Patcher</CardTitle>
          <CardDescription class="text-center">
            Upload your ROM and patch files to get started
          </CardDescription>
        </CardHeader>
        
        <CardContent class="space-y-6">
          <!-- ROM File Upload -->
          <div class="space-y-2">
            <Label for="rom-file">ROM File</Label>
            <div class="flex items-center space-x-2">
              <Input
                id="rom-file"
                type="file"
                accept=".rom,.nes,.smc,.sfc,.gb,.gbc,.gba,.z64,.n64,.iso"
                ref="romFileInput"
                @change="handleRomFileChange"
                class="flex-1"
              />
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ romFileName || 'No File Chosen' }}
            </p>
          </div>

          <!-- File Hashes -->
          <div class="grid grid-cols-1 gap-4">
            <div class="space-y-2">
              <Label for="crc32">CRC32</Label>
              <Input
                id="crc32"
                v-model="fileHashes.crc32"
                placeholder="CRC32 hash will appear here"
                readonly
                class="font-mono text-sm"
              />
            </div>
            
            <div class="space-y-2">
              <Label for="md5">MD5</Label>
              <Input
                id="md5"
                v-model="fileHashes.md5"
                placeholder="MD5 hash will appear here"
                readonly
                class="font-mono text-sm"
              />
            </div>
            
            <div class="space-y-2">
              <Label for="sha1">SHA-1</Label>
              <Input
                id="sha1"
                v-model="fileHashes.sha1"
                placeholder="SHA-1 hash will appear here"
                readonly
                class="font-mono text-sm"
              />
            </div>
          </div>

          <!-- Patch File Upload -->
          <div class="space-y-2">
            <Label for="patch-file">Patch File</Label>
            <div class="flex items-center space-x-2">
              <Input
                id="patch-file"
                type="file"
                accept=".ips,.ups,.bps,.xdelta,.patch"
                ref="patchFileInput"
                @change="handlePatchFileChange"
                class="flex-1"
              />
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ patchFileName || 'No File Chosen' }}
            </p>
          </div>
        </CardContent>

        <CardFooter>
          <Button 
            @click="applyPatch" 
            :disabled="!romFile || !patchFile || isProcessing"
            class="w-full"
            size="lg"
          >
            <span v-if="isProcessing">Processing...</span>
            <span v-else>Apply Patch</span>
          </Button>
        </CardFooter>
      </Card>

      <!-- Footer -->
      <div class="mt-8 text-center">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Supported formats: IPS, UPS, BPS, xDelta patches
        </p>
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

// File references
const romFile = ref<File | null>(null)
const patchFile = ref<File | null>(null)
const romFileName = ref<string>('')
const patchFileName = ref<string>('')
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

// Handle ROM file selection
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

// Handle patch file selection
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

// Apply patch function
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

// Set page title
useHead({
  title: 'Universal ROM Patcher'
})
</script>