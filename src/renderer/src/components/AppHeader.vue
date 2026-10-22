<script setup lang="ts">
/**
 * 顶部栏：应用标题 + 操作按钮（导入 / 导出 / 新建连接）。
 * 通过 props 接收按钮可用状态，通过 emit 向外通知点击事件，自身不处理业务逻辑。
 */
defineProps<{
  hasConnections: boolean
}>()

const emit = defineEmits<{
  import: []
  export: []
  create: []
}>()
</script>

<template>
  <div class="topbar">
    <h1><img class="logo" src="/icon.png" alt="" />远程助手</h1>
    <div class="actions">
      <button class="ghost" @click="emit('import')">导入</button>
      <button class="ghost" :disabled="!hasConnections" @click="emit('export')">导出</button>
      <button class="primary" @click="emit('create')">＋ 新建连接</button>
    </div>
  </div>
</template>
