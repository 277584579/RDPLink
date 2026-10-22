<script setup lang="ts">
/**
 * 应用主界面：组合顶栏、连接卡片列表、空状态、弹窗、Toast。
 * 业务逻辑通过 useConnections composable 封装，App 只做编排。
 */
import { ref, onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ConnectionCard from './components/ConnectionCard.vue'
import EmptyState from './components/EmptyState.vue'
import Toast from './components/Toast.vue'
import ConnectionModal from './components/ConnectionModal.vue'
import { useConnections } from './composables/useConnections'
import { showToast } from './composables/useToast'
import type { ConnectionConfig } from '@shared/types'

const {
  list,
  sortedList,
  launchingId,
  refresh,
  saveConnection,
  removeConnection,
  launch,
  exportAll,
  importAll
} = useConnections()

const showModal = ref(false)
const editing = ref<ConnectionConfig | null>(null)
const version = ref('')

// 启动加速：挂载后并行加载连接列表与版本号，避免串行等待
onMounted(() => {
  void refresh()
  void window.api.getVersion().then((v) => (version.value = v))
})

function openCreate(): void {
  editing.value = null
  showModal.value = true
}
function openEdit(c: ConnectionConfig): void {
  editing.value = { ...c }
  showModal.value = true
}

async function onSaved(): Promise<void> {
  showModal.value = false
  await refresh()
  showToast('已保存')
}
</script>

<template>
  <AppHeader
    :has-connections="list.length > 0"
    @import="importAll"
    @export="exportAll"
    @create="openCreate"
  />

  <div class="main">
    <EmptyState v-if="list.length === 0" />
    <div v-else class="cards">
      <ConnectionCard
        v-for="c in sortedList"
        :key="c.id"
        :connection="c"
        :launching="launchingId === c.id"
        @connect="launch"
        @edit="openEdit"
        @remove="removeConnection"
      />
    </div>
  </div>

  <ConnectionModal v-if="showModal" :initial="editing" @close="showModal = false" @saved="onSaved" />

  <Toast />

  <div class="version-badge">v{{ version }}</div>
</template>
