<script setup lang="ts">
/**
 * 全局 Toast 提示组件。
 * 状态来自 useToast 单例，任何组件调用 showToast() 都会在这里显示。
 */
import { useToast } from '../composables/useToast'
const { toast } = useToast()
</script>

<template>
  <div v-if="toast" class="toast">{{ toast }}</div>
</template>
