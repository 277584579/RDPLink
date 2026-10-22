<script setup lang="ts">
/**
 * 空状态：连接列表为空时显示的占位提示。
 */
defineProps<{
  /** 提示文案 */
  message?: string
}>()
</script>

<template>
  <div class="empty">
    <div style="font-size: 40px">🖥️</div>
    <div>{{ message || '还没有连接，点击右上角「新建连接」开始' }}</div>
  </div>
</template>
