<template>
  <div class="relative min-h-screen flex flex-col">
    <div
      class="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-gray-900 [background:radial-gradient(125%_125%_at_50%_10%,#ffffff_40%,#10b981_100%)] dark:[background:radial-gradient(125%_125%_at_50%_10%,#111827_40%,#34d399_100%)]">
    </div>
    <div class="fixed top-4 right-4 z-50">
      <ThemeSwitcher />
    </div>

    <!-- Floating Settings Button -->
    <div class="fixed bottom-4 right-4 z-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon"
              class="h-9 w-9 dark:bg-emerald-600 hover:dark:bg-emerald-500 cursor-pointer">
              <Settings class="h-4 w-4" variant="outline" />
              <span class="sr-only">Settings</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Settings</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <!-- Main content -->
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="w-full max-w-lg">
        <!-- Header -->
        <div class="text-center mb-8">
          <img src="/logo.webp" alt="Byte Forge Logo"
            class="mx-auto h-20 w-auto sm:h-24 md:h-28 lg:h-32 mb-4 max-w-full object-contain" loading="lazy"
            decoding="async" />
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Byte Forge - ROM Patcher
          </h1>
        </div>
        <!-- Main Card -->
        <div class="flex items-center space-x-3 justify-end mb-4">
          <Label for="creator-mode" class="text-sm font-medium cursor-pointer">Creator Mode</Label>
          <Switch id="creator-mode"
            class="cursor-pointer data-[state=checked]:bg-emerald-600 hover:data-[state=checked]:bg-emerald-500 [&_[data-state]]:dark:bg-white"
            v-model="isCreatorMode" />
        </div>
        <Card class="shadow-lg">
          <CardHeader>
            <CardTitle class="text-xl text-center">
              {{ isCreatorMode ? 'Patch Creator' : 'ROM Patcher' }}
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Patcher Mode Content -->
            <div v-if="!isCreatorMode">
              <!-- ROM File Upload -->
              <div class="flex flex-col sm:flex-row sm:items-center pb-4 space-y-2 sm:space-y-0 sm:space-x-2">
                <Label for="rom-file" class="min-w-[80px]">ROM File:</Label>
                <Input id="rom-file" type="file" accept=".rom,.nes,.smc,.sfc,.gb,.gbc,.gba,.z64,.n64,.iso"
                  ref="romFileInput" @change="handleRomFileChange" class="w-full cursor-pointer" />
              </div>
              <!-- File Hashes -->
              <div class="grid grid-cols-1">
                <div class="flex items-center space-x-2">
                  <Label class="min-w-[60px] text-gray-600 dark:text-gray-200 indent-8">CRC32:</Label>
                  <p class="font-mono text-sm text-gray-700 dark:text-gray-300 px-3 py-2 flex-1">
                    {{ fileHashes.crc32 || 'CRC32 hash will appear here' }}
                  </p>
                </div>

                <div class="flex items-center space-x-2">
                  <Label class="min-w-[60px] text-gray-600 dark:text-gray-200 indent-8 pr-2.5">MD5:</Label>
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
              <div class="flex flex-col sm:flex-row sm:items-center pt-4 space-y-2 sm:space-y-0 sm:space-x-2">
                <Label for="patch-file" class="min-w-[80px]">Patch File:</Label>
                <Input id="patch-file" type="file" accept=".ips,.ups,.bps,.xdelta,.patch" ref="patchFileInput"
                  @change="handlePatchFileChange" class="w-full cursor-pointer" />
              </div>
            </div>

            <!-- Creator Mode Content -->
            <div v-else>
              <!-- Original ROM File Upload -->
              <div class="flex flex-col sm:flex-row sm:items-center pb-4 space-y-2 sm:space-y-0 sm:space-x-8">
                <Label for="original-rom-file" class="min-w-[80px] whitespace-nowrap">Original ROM:</Label>
                <Input id="original-rom-file" type="file" accept=".rom,.nes,.smc,.sfc,.gb,.gbc,.gba,.z64,.n64,.iso"
                  ref="originalRomFileInput" @change="handleOriginalRomFileChange" class="w-full cursor-pointer" />
              </div>

              <!-- Modified ROM File Upload -->
              <div class="flex flex-col sm:flex-row sm:items-center pb-4 space-y-2 sm:space-y-0 sm:space-x-8">
                <Label for="modified-rom-file" class="min-w-[80px] whitespace-nowrap">Modified ROM:</Label>
                <Input id="modified-rom-file" type="file" accept=".rom,.nes,.smc,.sfc,.gb,.gbc,.gba,.z64,.n64,.iso"
                  ref="modifiedRomFileInput" @change="handleModifiedRomFileChange" class="w-full cursor-pointer" />
              </div>

              <!-- Patch Type Selection -->
              <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-8">
                <Label for="patch-type" class="min-w-[80px] whitespace-nowrap">Patch Type:</Label>
                <Select v-model="selectedPatchType" class="w-full">
                  <SelectTrigger id="patch-type" class="w-full">
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
              class="w-full bg-emerald-600 dark:text-gray-200 cursor-pointer hover:bg-emerald-500" size="lg">
              <span v-if="isProcessing">Processing...</span>
              <span v-else-if="isCreatorMode">Create Patch</span>
              <span v-else>Apply Patch</span>
            </Button>
          </CardFooter>
        </Card>
        <!-- Format Support Info -->
        <div class="mt-8 text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Supported formats: IPS, UPS, BPS, xDelta patches
          </p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="py-6 mt-auto">
      <div class="max-w-md mx-auto px-4">
        <!-- Social Links -->
        <div class="flex justify-center space-x-6 mb-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="https://www.instagram.com/krtclcdy/" target="_blank" rel="noopener noreferrer"
                  class="text-gray-700 hover:text-pink-500 dark:text-gray-400 dark:hover:text-pink-400 transition-colors duration-200">
                  <Instagram class="h-5 w-5" />
                  <span class="sr-only">Instagram</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Follow on Instagram</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="https://www.linkedin.com/in/kurtcalacday/" target="_blank" rel="noopener noreferrer"
                  class="text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors duration-200">
                  <Linkedin class="h-5 w-5" />
                  <span class="sr-only">LinkedIn</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Connect on LinkedIn</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="https://github.com/KurutoDenzeru/Byte-Forge" target="_blank" rel="noopener noreferrer"
                  class="text-gray-700 hover:text-gray-600 dark:text-gray-400 dark:hover:text-white transition-colors duration-200">
                  <Github class="h-5 w-5" />
                  <span class="sr-only">GitHub</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>View on GitHub</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <!-- Copyright -->
        <div class="text-center">
          <p class="text-sm text-gray-700 dark:text-gray-400">
            © {{ currentYear }} Byte Forge. KurutoDenzeru. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from "vue";
  import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Button } from "@/components/ui/button";
  import { Switch } from "@/components/ui/switch";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@/components/ui/tooltip";
  import { Settings, Instagram, Linkedin, Github } from "lucide-vue-next";
  import ThemeSwitcher from "@/components/ThemeSwitcher.vue";

  const { theme } = useTheme();

  // Current year for copyright
  const currentYear = computed(() => new Date().getFullYear());

  // ...existing code...

  // Creator mode toggle
  const isCreatorMode = ref(false);

  // File references for patcher mode
  const romFile = ref<File | null>(null);
  const patchFile = ref<File | null>(null);
  const romFileName = ref<string>("");
  const patchFileName = ref<string>("");

  // File references for creator mode
  const originalRomFile = ref<File | null>(null);
  const modifiedRomFile = ref<File | null>(null);
  const originalRomFileName = ref<string>("");
  const modifiedRomFileName = ref<string>("");
  const selectedPatchType = ref<string>("ips");

  const isProcessing = ref(false);

  // File hashes
  const fileHashes = reactive({
    crc32: "",
    md5: "",
    sha1: "",
  });

  // Template refs
  const romFileInput = ref<HTMLInputElement>();
  const patchFileInput = ref<HTMLInputElement>();
  const originalRomFileInput = ref<HTMLInputElement>();
  const modifiedRomFileInput = ref<HTMLInputElement>();

  // Handle ROM file selection (patcher mode)
  const handleRomFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      romFile.value = file;
      romFileName.value = file.name;

      // Calculate hashes (placeholder for now)
      await calculateHashes(file);
    } else {
      romFile.value = null;
      romFileName.value = "";
      resetHashes();
    }
  };

  // Handle patch file selection (patcher mode)
  const handlePatchFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      patchFile.value = file;
      patchFileName.value = file.name;
    } else {
      patchFile.value = null;
      patchFileName.value = "";
    }
  };

  // Handle original ROM file selection (creator mode)
  const handleOriginalRomFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      originalRomFile.value = file;
      originalRomFileName.value = file.name;
    } else {
      originalRomFile.value = null;
      originalRomFileName.value = "";
    }
  };

  // Handle modified ROM file selection (creator mode)
  const handleModifiedRomFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      modifiedRomFile.value = file;
      modifiedRomFileName.value = file.name;
    } else {
      modifiedRomFile.value = null;
      modifiedRomFileName.value = "";
    }
  };

  // Calculate file hashes (placeholder implementation)
  const calculateHashes = async (file: File) => {
    // This is a placeholder - in a real implementation, you'd calculate actual hashes
    fileHashes.crc32 = "Calculating...";
    fileHashes.md5 = "Calculating...";
    fileHashes.sha1 = "Calculating...";

    // Simulate hash calculation delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Placeholder values - replace with actual hash calculation
    fileHashes.crc32 = "A1B2C3D4";
    fileHashes.md5 = "5d41402abc4b2a76b9719d911017c592";
    fileHashes.sha1 = "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d";
  };

  // Reset hashes
  const resetHashes = () => {
    fileHashes.crc32 = "";
    fileHashes.md5 = "";
    fileHashes.sha1 = "";
  };

  // Apply patch function (patcher mode)
  const applyPatch = async () => {
    if (!romFile.value || !patchFile.value) {
      return;
    }

    isProcessing.value = true;

    try {
      // Placeholder for patch application logic
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Here you would implement the actual patch application logic
      console.log(
        "Applying patch:",
        patchFile.value.name,
        "to ROM:",
        romFile.value.name,
      );

      // Show success message or download result
      alert("Patch applied successfully!");
    } catch (error) {
      console.error("Error applying patch:", error);
      alert("Error applying patch. Please try again.");
    } finally {
      isProcessing.value = false;
    }
  };

  // Create patch function (creator mode)
  const createPatch = async () => {
    if (
      !originalRomFile.value ||
      !modifiedRomFile.value ||
      !selectedPatchType.value
    ) {
      return;
    }

    isProcessing.value = true;

    try {
      // Placeholder for patch creation logic
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Here you would implement the actual patch creation logic
      console.log(
        "Creating",
        selectedPatchType.value.toUpperCase(),
        "patch from:",
        originalRomFile.value.name,
        "to:",
        modifiedRomFile.value.name,
      );

      // Show success message or download result
      alert(
        `${selectedPatchType.value.toUpperCase()} patch created successfully!`,
      );
    } catch (error) {
      console.error("Error creating patch:", error);
      alert("Error creating patch. Please try again.");
    } finally {
      isProcessing.value = false;
    }
  };

  // Set page title
  useHead({
    title: "Universal ROM Patcher",
  });
</script>