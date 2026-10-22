// 模拟主进程启动链路：写 .rdp -> cmdkey -> 启动 mstsc
const { writeFileSync, unlinkSync } = require('fs')
const { join } = require('path')
const { spawn } = require('os') ? require('child_process') : null
const os = require('os')

const cfg = {
  host: '192.168.6.146',
  port: 3389,
  username: 'Administrator',
  password: 'Qwe123!@#',
  width: 1440,
  height: 900
}

const lines = [
  'screen mode id:i:1',
  `desktopwidth:i:${cfg.width}`,
  `desktopheight:i:${cfg.height}`,
  'session bpp:i:32',
  `full address:s:${cfg.host}`,
  `username:s:${cfg.username}`,
  'prompt for credentials:i:0',
  'enablecredsspsupport:i:1',
  'authentication level:i:2',
  'redirectclipboard:i:1',
  'redirectdrives:i:0',
  'audiomode:i:1',
  'redirectprinters:i:0',
  'redirectsmartcards:i:0',
  'compression:i:1',
  'keyboardhook:i:2',
  'connection type:i:7',
  'networkautodetect:i:1',
  'bandwidthautodetect:i:1'
]
const rdp = join(os.tmpdir(), 'rdp-test-debug.rdp')
writeFileSync(rdp, lines.join('\r\n') + '\r\n', 'utf-8')
console.log('[1] rdp written:', rdp)

function run(cmd, args) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { windowsHide: true })
    p.on('close', (code) => { console.log(`[2] ${cmd} exit code=${code}`); res() })
    p.on('error', (e) => { console.log(`[2] ${cmd} ERROR:`, e.message); res() })
  })
}

;(async () => {
  await run('cmdkey.exe', ['/generic:TERMSRV/' + cfg.host, '/user:' + cfg.username, '/pass:' + cfg.password])
  console.log('[3] launching mstsc...')
  const m = spawn('mstsc.exe', [rdp])
  m.on('close', (code) => {
    console.log('[5] mstsc closed, code=', code)
    run('cmdkey.exe', ['/delete:TERMSRV/' + cfg.host]).then(() => { try { unlinkSync(rdp) } catch {} ; console.log('[6] done') })
  })
  m.on('error', (e) => console.log('[4] mstsc ERROR:', e.message))
  setTimeout(() => console.log('[4] mstsc pid=', m.pid, 'still running:', !m.killed), 3000)
})()
