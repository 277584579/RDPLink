; ============================================================
; RDPLink / 远程助手 — NSIS 自定义注入脚本
; 由 electron-builder 在 NSIS 模板中 !include 本文件。
; 仅自定义文案/品牌文本；位图、图标、语言由 package.json 配置项控制。
; 注意：不要在此 !insertmacro MUI_LANGUAGE 或 !define MUI 位图，
;       那些会与 electron-builder 的 NSIS 模板冲突。
; ============================================================

; ---------- 欢迎页文案 ----------
!define MUI_WELCOMEPAGE_TITLE "欢迎使用「远程助手」安装向导"
!define MUI_WELCOMEPAGE_TEXT "本向导将引导您完成「远程助手」的安装。$\r$\n$\r$\n远程助手是一个便携的 RDP 远程桌面连接管理工具，支持批量管理 RDP 服务器连接、密码加密存储、一键发起远程桌面。$\r$\n$\r$\n建议在继续之前关闭其他正在运行的程序。$\r$\n$\r$\n点击「下一步」继续。"

; ---------- 卸载欢迎页文案 ----------
!define MUI_UNWELCOMEPAGE_TITLE "欢迎使用「远程助手」卸载向导"
!define MUI_UNWELCOMEPAGE_TEXT "本向导将从您的计算机中移除「远程助手」。$\r$\n$\r$\n卸载不会删除您的连接配置文件（connections.json），如需彻底清理请手动删除。$\r$\n$\r$\n点击「下一步」继续。"

; ---------- 目录页文案 ----------
!define MUI_DIRECTORYPAGE_TEXT_TOP "请选择「远程助手」的安装位置，然后点击「安装」。"
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "安装到："

; ---------- 安装完成页文案 ----------
!define MUI_FINISHPAGE_TITLE "「远程助手」安装完成"
!define MUI_FINISHPAGE_TEXT "远程助手已成功安装到您的计算机。$\r$\n$\r$\n点击「完成」退出安装向导。"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动远程助手"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_NOREBOOTSUPPORT

; ---------- 卸载完成页文案 ----------
!define MUI_UNFINISHPAGE_TITLE "「远程助手」卸载完成"
!define MUI_UNFINISHPAGE_TEXT "远程助手已从您的计算机中移除。$\r$\n$\r$\n点击「完成」退出卸载向导。"

; ---------- 底部品牌文案 ----------
BrandingText "RDPLink · 远程助手  |  便携 RDP 连接管理器"
