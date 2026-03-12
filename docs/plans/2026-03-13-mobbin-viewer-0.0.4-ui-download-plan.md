# Mobbin Viewer 0.0.4 UI 与下载流程改造计划

## 背景
- 基于 `Mobbin Viewer-0.0.3` 创建 `Mobbin Viewer-0.0.4` 副本。
- 参考 `C:\VibeCoding\Mobbin\design.pen` 中的 `On`、`Off`、`Download content_*`、`Download progress pop-up_step*` 设计稿，重做 `popup（弹出页）` 和批量下载状态浮窗。
- 移除原有全屏遮罩下载方案，改为右上角 `toast（消息浮窗）`，并支持失败重试、部分保留后继续打包、打开系统默认下载目录。
- 保持 Mobbin 页头注入的“打包下载”按钮现有视觉不变。

## To-Do
- [x] 更新版本号与扩展权限，补齐共享消息与后台下载目录能力
- [x] 重构批量下载状态机，支持失败细分、失败项重试与部分保留打包
- [x] 将下载状态 UI 改为右上角浮窗，并移除旧遮罩样式
- [x] 按设计稿重写 `popup（弹出页）` 的结构、文案映射与开关样式
- [x] 运行 `pnpm build` 验证 `0.0.4` 构建产物
