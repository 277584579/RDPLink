<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ConnectionModal from './components/ConnectionModal.vue'

interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  username: string
  domain?: string
  passwordEnc?: string
  fullscreen: boolean
  width: number
  height: number
  redirectClipboard: boolean
  redirectDrives: boolean
  audioMode: 0 | 1 | 2
  lastConnectedAt?: number
  createdAt: number
  updatedAt: number
}

const list = ref<ConnectionConfig[]>([])
const showModal = ref(false)
const editing = ref<ConnectionConfig | null>(null)
const toast = ref('')
const launchingId = ref('')
const version = ref('')

onMounted(async () => {
  await refresh()
  version.value = await window.api.getVersion()
})

// 按最近连接时间排序，连过的排前面（最近在前），没连过的按创建时间排后面
const sortedList = computed(() =>
  [...list.value].sort((a, b) => (b.lastConnectedAt || b.createdAt) - (a.lastConnectedAt || a.createdAt))
)

function fmtTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `今天 ${hm}` : d.toLocaleDateString('zh-CN') + ' ' + hm
}

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 2500)
}

async function refresh() {
  list.value = await window.api.listConnections()
}

onMounted(async () => {
  await refresh()
  version.value = await window.api.getVersion()
})

function openCreate() {
  editing.value = null
  showModal.value = true
}
function openEdit(c: ConnectionConfig) {
  editing.value = { ...c }
  showModal.value = true
}

async function onSaved() {
  showModal.value = false
  await refresh()
  showToast('已保存')
}

async function remove(c: ConnectionConfig) {
  if (!confirm(`确定删除「${c.name}」吗？`)) return
  await window.api.deleteConnection(c.id)
  await refresh()
  showToast('已删除')
}

async function connect(c: ConnectionConfig) {
  launchingId.value = c.id
  try {
    // Vue 响应式对象是 Proxy，无法被 IPC 结构化克隆，先转成纯对象
    const plain = JSON.parse(JSON.stringify(c)) as ConnectionConfig
    const r = await window.api.launchConnection(plain)
    if (!r.ok) showToast('连接失败：' + (r.error || '未知错误'))
    else showToast(`正在连接「${c.name}」…`)
  } catch (err: any) {
    showToast('连接异常：' + (err?.message || String(err)))
  } finally {
    launchingId.value = ''
    await refresh() // 刷新"上次连接"时间与排序
  }
}

async function doExport() {
  const r = await window.api.exportConnections()
  if (r.ok) showToast(`已导出 ${r.count} 条连接`)
  else if (!r.canceled) showToast('导出失败')
}
async function doImport() {
  const r = await window.api.importConnections()
  if (r.ok) {
    await refresh()
    showToast(`已导入 ${r.count} 条连接`)
  } else if (!r.canceled) {
    showToast('导入失败：' + (r.error || '未知错误'))
  }
}
</script>

<template>
  <div class="topbar">
    <h1><img class="logo" src="/icon.png" alt="" />远程助手</h1>
    <div class="actions">
      <button class="ghost" @click="doImport">导入</button>
      <button class="ghost" @click="doExport">导出</button>
      <button class="primary" @click="openCreate">＋ 新建连接</button>
    </div>
  </div>

  <div class="main">
    <div v-if="list.length === 0" class="empty">
      <div style="font-size: 40px">🖥️</div>
      <div>还没有连接，点击右上角「新建连接」开始</div>
    </div>
    <div v-else class="cards">
      <div v-for="c in sortedList" :key="c.id" class="card">
        <div class="row1">
          <span class="name">{{ c.name }}</span>
          <span class="tag" :class="{ recent: !!c.lastConnectedAt }">
            {{ c.lastConnectedAt ? '上次连接 ' + fmtTime(c.lastConnectedAt) : '未连接过' }}
          </span>
        </div>
        <div class="addr">{{ c.host }}{{ c.port && c.port !== 3389 ? ':' + c.port : '' }}</div>
        <div class="meta">
          {{ c.username || '未设置账号' }} · {{ c.fullscreen ? '全屏' : c.width + '×' + c.height }}
        </div>
        <div class="ops">
          <button class="connect" :disabled="launchingId === c.id" @click="connect(c)">
            {{ launchingId === c.id ? '启动中…' : '连 接' }}
          </button>
          <button @click="openEdit(c)">编辑</button>
          <button class="ghost danger-text" @click="remove(c)">删除</button>
        </div>
      </div>
    </div>
  </div>

  <ConnectionModal
    v-if="showModal"
    :initial="editing"
    @close="showModal = false"
    @saved="onSaved"
  />

  <div v-if="toast" class="toast">{{ toast }}</div>

  <div class="version-badge">v{{ version }}</div>
</template>
