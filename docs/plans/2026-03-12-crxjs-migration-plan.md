# Mobbin Viewer CRXJS 迁移执行记录

## 背景
- 当前项目依赖 `@crxjs/vite-plugin (CRXJS Vite 插件)` 生成 Chrome Extension (Chrome 扩展) 构建产物。
- 本次执行目标是移除 `CRXJS`，统一使用 `pnpm (包管理器)`，并改为原生 `MV3 (Manifest V3)` 构建输出。

## To-Do
- [x] 记录当前基线并确认现有 `tsc (TypeScript 编译器)` / `build (构建)` 状态
- [x] 设计替代 `CRXJS` 的 `Vite (构建工具)` 多阶段构建方案
- [x] 新增静态 `manifest.json` 与扩展构建脚本
- [x] 调整 `package.json`、`vite.config.ts` 与相关源文件
- [x] 清理 `npm (包管理器)` 遗留文件并改用 `pnpm`
- [x] 运行类型检查、构建与审计验证