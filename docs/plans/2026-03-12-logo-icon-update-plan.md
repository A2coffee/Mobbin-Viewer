# Mobbin Viewer LOGO 图标替换执行记录

## 背景
- 目标是使用 `design.pen` 中的 `Frame: LOGO` 作为插件图标来源。
- 本次执行直接替换扩展 `manifest (清单)` 当前引用的 32、72、128、512 四个 `PNG` 图标文件，保持文件名不变。

## To-Do
- [x] 确认 `design.pen` 中的 `LOGO` 节点与现有图标引用
- [x] 导出 `LOGO` 节点为高分辨率源图
- [x] 生成并覆盖 32/72/128/512 图标资源
- [x] 运行 `build (构建)` 验证输出
