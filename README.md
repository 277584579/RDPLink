<div align="center">

# RDPLink · 远程助手

便携的 Windows RDP 远程桌面连接管理工具，批量管理 RDP 服务器连接，一键发起远程桌面，支持密码加密存储、剪贴板/驱动器重定向、全屏及音频等 RDP 参数配置。

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D6.svg)](#)
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg)](#)
[![Vue](https://img.shields.io/badge/Vue-3-42b883.svg)](#)

</div>

---

## 目录

- [简介](#简介)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [构建与打包](#构建与打包)
- [配置说明](#配置说明)
- [数据存储与安全](#数据存储与安全)
- [导入 / 导出](#导入--导出)
- [常见问题](#常见问题)
- [参与贡献](#参与贡献)
- [许可协议](#许可协议)

---

## 简介

RDPLink（远程助手）是一个基于 Electron 的轻量级 RDP 连接管理器。它把 Windows 自带的 `mstsc.exe`（远程桌面连接）包装成可视化的连接列表，让你像管理书签一样管理多台 RDP 服务器，无需每次手动输入 IP、账号、密码，也无需重复配置显示、剪贴板、音频等参数。

核心思路：

1. 在界面中维护「连接配置」（主机、端口、账号、密码、显示、重定向等）。
2. 密码通过 Electron `safeStorage`（底层为 Windows DPAPI）加密后存储在本机。
3. 发起连接时，自动生成 `.rdp` 文件、通过 `cmdkey` 注入凭据、调用 `mstsc.exe` 拉起远程桌面会话；会话结束后自动清理临时凭据与 `.rdp` 文件。

> 仅适用于 Windows 平台（依赖 `mstsc.exe` 与 `cmdkey.exe`）。

---

## 功能特性

- **连接列表管理**：新增、编辑、删除连接；按主机/端口/账号去重；记录最近一次连接时间。
- **一键发起远程**：双击或点击「连接」直接拉起 `mstsc`，全屏模式自动附加 `/f`。
- **密码加密存储**：使用 Electron `safeStorage` + Windows DPAPI 本机加密；不支持加密时退化提示，绝不以明文落盘。
- **丰富的 RDP 参数**：
  - 显示：全屏 / 自定义分辨率（默认 1440×900）、智能缩放（窗口拖动自适应）。
  - 重定向：剪贴板、本地驱动器。
  - 音频：本地播放 / 不播放 / 远程播放。
  - 连接质量：自动检测网络与带宽、32 位色深、位图缓存、压缩、字体平滑、桌面合成等。
- **凭据自动注入与清理**：连接前用 `cmdkey` 写入 `TERMSRV/<host>` 凭据，`mstsc` 退出后自动删除，避免凭据残留。
- **便携版数据跟随 exe**：Portable 打包模式下配置文件 `connections.json` 存放在 exe 同级目录，换机携带不丢配置。
- **配置导入 / 导出**：一键导出为 JSON 分享给同事；支持「含密码 / 不含密码」两种模式，导入时自动按主机+端口+账号去重。
- **单实例运行**：二次启动时唤起已有窗口，而不是开新进程。

---

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 桌面框架 | [Electron 33](https://www.electronjs.org/) |
| 渲染层 | [Vue 3](https://vuejs.org/) + TypeScript |
| 构建 | [electron-vite](https://electron-vite.org/) + [Vite 6](https://vitejs.dev/) |
| 打包 | [electron-builder](https://www.electron.build/)（Windows Portable） |
| 加密 | Electron `safeStorage`（Windows DPAPI） |
| 远程桌面 | Windows `mstsc.exe` + `.rdp` 文件 + `cmdkey.exe` |

---

## 项目结构

```
RDPLink/
├── build/                      # 打包资源（图标等）
├── release/                    # 打包输出（dist 产物，已忽略）
├── out/                        # electron-vite 构建产物（已忽略）
├── src/
│   ├── main/
│   │   └── index.ts            # 主进程：窗口、IPC、RDP 生成、凭据注入、加密
│   ├── preload/
│   │   └── index.ts            # 预加载：安全暴露 IPC 给渲染层
│   └── renderer/
│       ├── index.html
│       ├── public/
│       │   └── icon.png
│       └── src/
│           ├── App.vue         # 主界面：连接列表
│           ├── components/
│           │   └── ConnectionModal.vue  # 新增/编辑连接弹窗
│           ├── main.ts
│           ├── style.css
│           └── env.d.ts
├── electron.vite.config.ts     # electron-vite 配置
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── .gitignore
└── LICENSE
```

---

## 环境要求

- **操作系统**：Windows 10 / 11（需内置 `mstsc.exe`，即已启用「远程桌面客户端」功能）
- **Node.js**：≥ 18（推荐 20 LTS）
- **包管理器**：[pnpm](https://pnpm.io/)（项目附带 `pnpm-lock.yaml`，建议使用 pnpm 以保证依赖版本一致）

---

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/277584579/RDPLink.git
cd RDPLink

# 2. 安装依赖（推荐 pnpm）
pnpm install

# 3. 启动开发模式（热更新）
pnpm dev
```

开发模式下，Electron 主进程、预加载脚本与 Vue 渲染层均带热更新，修改代码会自动重载。

---

## 构建与打包

```bash
# 仅构建产物到 out/
pnpm build

# 预览构建产物
pnpm start

# 打包为 Windows Portable 可执行文件
pnpm dist
```

执行 `pnpm dist` 后，便携版 exe 会输出到 `release/` 目录，文件名形如：

```
远程助手-Portable-0.2.3.exe
```

便携版运行时，配置文件 `connections.json` 会保存在 **exe 同级目录**（通过 `PORTABLE_EXECUTABLE_DIR` 定位），可直接随 exe 一起拷贝到其他 Windows 机器使用。

---

## 配置说明

每个连接支持以下字段：

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `name` | 连接名称（显示用） | — |
| `host` | 主机地址，支持 `host` 或 `host:port` | — |
| `port` | RDP 端口 | `3389` |
| `username` | 登录用户名 | — |
| `domain` | 域（可选） | — |
| `password` | 登录密码（DPAPI 加密存储） | — |
| `fullscreen` | 是否全屏启动 | `false` |
| `width` / `height` | 窗口模式分辨率 | `1440` × `900` |
| `redirectClipboard` | 剪贴板重定向 | `true` |
| `redirectDrives` | 本地驱动器重定向 | `false` |
| `audioMode` | 音频模式：`0` 本地播放 / `1` 不播放 / `2` 远程播放 | `1` |

生成的 `.rdp` 文件还会预设：智能缩放 `smart sizing:i:1`、32 位色深、位图缓存、压缩、自动网络与带宽检测、字体平滑、桌面合成等，以保证流畅的远程体验。

---

## 数据存储与安全

- **存储位置**
  - 开发 / 普通安装版：`app.getPath('userData')` 下 `connections.json`
  - Portable 便携版：exe 同级目录下 `connections.json`
- **密码加密**：使用 Electron `safeStorage`，在 Windows 上底层调用 DPAPI，密钥绑定当前用户账户。只有在本机、本用户身份下才能解密。
- **凭据注入**：连接时通过 `cmdkey /generic:TERMSRV/<host>` 临时写入凭据，`mstsc` 退出后立即 `/delete` 清理，不在系统凭据管理器中残留。
- **退路策略**：若 `safeStorage` 不可用（极少见），密码会以 `plain:` 前缀的 base64 存储**并视为不安全**，仅用于提示用户尽快在支持 DPAPI 的环境使用。

> ⚠️ 导出配置时若选择「包含密码」，密码会以**明文**写入 JSON 文件，请妥善保管导出文件。

---

## 导入 / 导出

- **导出**：在界面中导出全部连接为 JSON，可选「包含密码」或「不含密码」。
- **导入**：选择导出的 JSON 文件，自动按 `host:port:username` 去重后追加到现有连接列表；含密码的条目会重新用本机 DPAPI 加密存储。

导出文件格式示例：

```json
{
  "app": "rdp-assistant",
  "version": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "connections": [
    {
      "name": "测试服务器",
      "host": "192.168.1.10",
      "port": 3389,
      "username": "Administrator",
      "domain": "",
      "fullscreen": false,
      "width": 1440,
      "height": 900,
      "redirectClipboard": true,
      "redirectDrives": false,
      "audioMode": 1,
      "password": ""
    }
  ]
}
```

---

## 常见问题

**Q：为什么打包后配置不见了？**
A：Portable 版每次运行会解压到随机临时目录，程序通过 `PORTABLE_EXECUTABLE_DIR` 定位 exe 原始目录来持久化 `connections.json`。请确保 exe 放在可写目录下运行，不要放在只读位置。

**Q：换台电脑还能用保存的密码吗？**
A：不能。密码用本机 DPAPI 加密，密钥绑定原用户账户，换电脑/换用户后无法解密，需要重新输入密码。如需迁移，请用「导出（含密码）」生成明文 JSON，在新机器上「导入」后会自动重新加密。

**Q：连接时提示「无法启动 mstsc.exe」？**
A：请确认系统为 Windows 且已启用远程桌面客户端功能。部分精简版 Windows 可能移除了 `mstsc.exe`。

**Q：端口不是 3389 怎么办？**
A：在连接配置中填写自定义端口，生成的 `.rdp` 与 `cmdkey` 凭据会自动带上端口（`TERMSRV/host:port`）。

---

## 参与贡献

欢迎提交 Issue 与 Pull Request。

1. Fork 本仓库
2. 新建分支：`git checkout -b feature/your-feature`
3. 提交改动：`git commit -m "feat: your feature"`
4. 推送分支：`git push origin feature/your-feature`
5. 发起 Pull Request

请确保提交前 `pnpm build` 能正常通过。

---

## 许可协议

本项目基于 [Apache License 2.0](LICENSE) 开源。在遵守协议前提下，你可以自由使用、修改和分发，但需保留原始版权与许可声明。
