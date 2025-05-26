<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon" class="h-9 w-9">
        <Sun 
          class="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" 
        />
        <Moon 
          class="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" 
        />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    
    <DropdownMenuContent align="end" class="min-w-36">
      <DropdownMenuItem @click="setTheme('light')" class="cursor-pointer">
        <Sun class="mr-2 h-4 w-4" />
        <span>Light</span>
        <Check 
          v-if="theme === 'light'" 
          class="ml-auto h-4 w-4" 
        />
      </DropdownMenuItem>
      
      <DropdownMenuItem @click="setTheme('dark')" class="cursor-pointer">
        <Moon class="mr-2 h-4 w-4" />
        <span>Dark</span>
        <Check 
          v-if="theme === 'dark'" 
          class="ml-auto h-4 w-4" 
        />
      </DropdownMenuItem>
      
      <DropdownMenuItem @click="setTheme('system')" class="cursor-pointer">
        <Monitor class="mr-2 h-4 w-4" />
        <span>System</span>
        <Check 
          v-if="theme === 'system'" 
          class="ml-auto h-4 w-4" 
        />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sun, Moon, Monitor, Check } from 'lucide-vue-next'

const { theme, setTheme } = useTheme()
</script>
