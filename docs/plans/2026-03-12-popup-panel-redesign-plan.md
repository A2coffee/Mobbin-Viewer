# Mobbin Viewer Popup 面板重构执行记录

## 背景
- 目标是将插件 `popup (弹窗)` 整体替换为 `design.pen` 中的 `Panel / Dist Popup/ on` 与 `Panel / Dist Popup / off` 两套深色面板设计。
- 本次改造仅覆盖 `src/popup` 入口的界面与展示文案，不调整 `chrome.storage (本地存储)`、`content script (内容脚本)` 消息协议和启停逻辑。

## To-Do
- [x] 确认现有 `popup (弹窗)` 结构、构建入口与 `design.pen` 目标节点
- [x] 重写 `index.html` 为单一面板结构
- [x] 重写 `popup.css` 以匹配设计稿视觉
- [x] 调整 `popup.ts` 以输出 on/off 两态及运行时提示
- [x] 运行 `build (构建)` 验证输出
