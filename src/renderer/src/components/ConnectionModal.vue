<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { ConnectionConfig } from '@shared/types'
import { validateConnection } from '../utils/validator'
import { DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_PORT } from '../composables/useConnections'

const props = defineProps<{ initial: ConnectionConfig | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const isEdit = computed(() => !!props.initial?.id)

const form = reactive({
  id: props.initial?.id || '',
  name: props.initial?.name || '',
  host: props.initial?.host || '',
  port: props.initial?.port ?? DEFAULT_PORT,
  username: props.initial?.username || '',
  domain: props.initial?.domain || '',
  fullscreen: props.initial?.fullscreen ?? true,
  width: props.initial?.width ?? DEFAULT_WIDTH,
  height: props.initial?.height ?? DEFAULT_HEIGHT,
  redirectClipboard: props.initial?.redirectClipboard ?? true,
  redirectDrives: props.initial?.redirectDrives ?? false,
  // 选中的盘符列表；空数组表示重定向所有盘
  redirectDrivesList: (props.initial?.redirectDrivesList ?? []) as string[],
  audioMode: (props.initial?.audioMode ?? 1) as 0 | 1 | 2,
  // 编辑时不回显密码，留空表示不修改
  password: '',
  hasExistingPassword: !!props.initial?.passwordEnc
})
const keepPassword = ref(isEdit.value && !!props.initial?.passwordEnc)
const showPassword = ref(false)
const error = ref('')
const saving = ref(false)

// 本机可用盘符列表（从主进程获取）
const drives = ref<{ letter: string; label: string }[]>([])

onMounted(async () => {
  try {
    drives.value = await window.api.listDrives()
  } catch {
    drives.value = []
  }
})

// 编辑时自动回显已保存的密码（以密文圆点显示，点眼睛可看明文）
if (props.initial?.id && props.initial?.passwordEnc) {
  void window.api.revealPassword(props.initial.id).then((pw) => {
    if (pw && !form.password) form.password = pw
  })
}

// 切换明文/密文显示
function togglePassword(): void {
  showPassword.value = !showPassword.value
}

// 切换盘符选中
function toggleDrive(letter: string): void {
  const idx = form.redirectDrivesList.indexOf(letter)
  if (idx >= 0) form.redirectDrivesList.splice(idx, 1)
  else form.redirectDrivesList.push(letter)
}

async function save(): Promise<void> {
  error.value = ''
  const v = validateConnection(form)
  if (!v.ok) {
    error.value = v.error!
    return
  }

  let passwordEnc = props.initial?.passwordEnc
  if (form.password) {
    passwordEnc = await window.api.encryptPassword(form.password)
  } else if (!keepPassword.value) {
    passwordEnc = undefined
  }

  saving.value = true
  await window.api.saveConnection({
    id: form.id,
    name: form.name.trim(),
    host: form.host.trim().split(':')[0],
    port: form.port || DEFAULT_PORT,
    username: form.username.trim(),
    domain: form.domain?.trim() || undefined,
    passwordEnc,
    fullscreen: form.fullscreen,
    width: Number(form.width) || DEFAULT_WIDTH,
    height: Number(form.height) || DEFAULT_HEIGHT,
    redirectClipboard: form.redirectClipboard,
    redirectDrives: form.redirectDrives,
    redirectDrivesList: form.redirectDrives ? form.redirectDrivesList : [],
    audioMode: form.audioMode,
    createdAt: props.initial?.createdAt || 0,
    updatedAt: 0
  })
  saving.value = false
  emit('saved')
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <h2>{{ isEdit ? '编辑连接' : '新建连接' }}</h2>

      <div class="form-grid">
        <div class="form-row full">
          <label>连接名称 *</label>
          <input v-model="form.name" placeholder="例如：公司电脑" />
        </div>
        <div class="form-row">
          <label>服务器地址 *</label>
          <input v-model="form.host" placeholder="192.168.1.100" />
        </div>
        <div class="form-row">
          <label>端口</label>
          <input v-model.number="form.port" type="number" min="1" max="65535" />
        </div>
        <div class="form-row">
          <label>账号 *</label>
          <input v-model="form.username" placeholder="administrator" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>密码</label>
          <div class="pw-wrap">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              autocomplete="new-password"
            />
            <button
              type="button"
              class="pw-eye"
              :title="showPassword ? '隐藏密码' : '显示密码'"
              @click="togglePassword"
            >
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
        </div>
        <div class="form-row">
          <label>域（可选）</label>
          <input v-model="form.domain" placeholder="留空表示本地账号" />
        </div>
        <div class="form-row">
          <label>音频</label>
          <select v-model.number="form.audioMode">
            <option :value="0">在这台电脑播放</option>
            <option :value="1">不播放</option>
            <option :value="2">在远程电脑播放</option>
          </select>
        </div>

        <div class="form-row full checks">
          <label><input v-model="form.fullscreen" type="checkbox" />启动即全屏</label>
          <label v-if="!form.fullscreen">
            宽 <input v-model.number="form.width" type="number" style="width:70px" />
            高 <input v-model.number="form.height" type="number" style="width:70px" />
          </label>
        </div>
        <div class="form-row full checks">
          <label><input v-model="form.redirectClipboard" type="checkbox" />剪贴板重定向</label>
          <label><input v-model="form.redirectDrives" type="checkbox" />磁盘重定向</label>
          <label v-if="isEdit"><input v-model="keepPassword" type="checkbox" />保留已存密码</label>
        </div>
        <div v-if="form.redirectDrives" class="form-row full">
          <label>重定向磁盘（不选则重定向所有盘）</label>
          <div class="drive-grid">
            <label v-for="d in drives" :key="d.letter" class="drive-item">
              <input
                type="checkbox"
                :checked="form.redirectDrivesList.includes(d.letter)"
                @change="toggleDrive(d.letter)"
              />
              {{ d.label }}
            </label>
            <span v-if="drives.length === 0" class="hint">未检测到可用磁盘</span>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-text">{{ error }}</div>
      <div class="hint">窗口模式下可随意拉伸/最大化窗口，远程画面会自动缩放；连接后按 Ctrl+Alt+Pause 可随时切换全屏。密码使用 Windows DPAPI 加密后保存在本机，仅当前 Windows 用户可解密。</div>

      <div class="footer">
        <button @click="emit('close')">取消</button>
        <button class="primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保 存' }}</button>
      </div>
    </div>
  </div>
</template>
