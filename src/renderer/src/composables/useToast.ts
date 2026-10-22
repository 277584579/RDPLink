/**
 * Toast 提示 composable：全局轻量消息提示。
 *
 * 用法：
 *   const { toast, showToast } = useToast()
 *   showToast('已保存')
 *   <div v-if="toast" class="toast">{{ toast }}</div>
 */
import { ref } from 'vue'

// 模块级单例：多个组件共享同一个 toast 状态，避免每个组件各自维护
const toast = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

/** 显示一条 toast，2.5s 后自动清除；连续调用会覆盖前一条 */
export function showToast(msg: string, duration = 2500): void {
  toast.value = msg
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => (toast.value = ''), duration)
}

/** 获取 toast 响应式状态 */
export function useToast() {
  return { toast, showToast }
}
