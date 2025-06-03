<template>
  <DialogPortal v-bind="forwarded">
    <slot />
  </DialogPortal>
</template>

<script setup lang="ts">
import { DialogPortal, useForwardProps } from 'radix-vue'
import type { DialogPortalProps } from 'radix-vue'

const props = defineProps<DialogPortalProps>()
const forwarded = useForwardProps(props)
</script>
