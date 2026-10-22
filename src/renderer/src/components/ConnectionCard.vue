<script setup lang="ts">
/**
 * 单个连接卡片：展示连接信息 + 操作按钮（连接 / 编辑 / 删除）。
 * 通过 props 接收连接数据与启动状态，通过 emit 通知外层操作，自身不处理业务逻辑。
 */
import type { ConnectionConfig } from '@shared/types'
import { fmtTime, fmtAddress, fmtDisplay } from '../utils/format'

const props = defineProps<{
  connection: ConnectionConfig
  /** 是否正在启动该连接（用于禁用按钮 + 显示"启动中"） */
  launching: boolean
}>()

const emit = defineEmits<{
  connect: [ConnectionConfig]
  edit: [ConnectionConfig]
  remove: [ConnectionConfig]
}>()
</script>

<template>
  <div class="card">
    <div class="row1">
      <span class="name">{{ connection.name }}</span>
      <span class="tag" :class="{ recent: !!connection.lastConnectedAt }">
        {{ connection.lastConnectedAt ? '上次连接 ' + fmtTime(connection.lastConnectedAt) : '未连接过' }}
      </span>
    </div>
    <div class="addr">{{ fmtAddress(connection.host, connection.port) }}</div>
    <div class="meta">
      {{ connection.username || '未设置账号' }} · {{ fmtDisplay(connection.fullscreen, connection.width, connection.height) }}
    </div>
    <div class="ops">
      <button class="connect" :disabled="launching" @click="emit('connect', connection)">
        {{ launching ? '启动中…' : '连 接' }}
      </button>
      <button @click="emit('edit', connection)">编辑</button>
      <button class="ghost danger-text" @click="emit('remove', connection)">删除</button>
    </div>
  </div>
</template>
