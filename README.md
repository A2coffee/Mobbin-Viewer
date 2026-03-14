# Mobbin Viewer

Mobbin Viewer 是一个面向 `mobbin.com` 的 Chrome 扩展，提供去模糊浏览、全屏查看、复制素材与批量下载能力。  
Mobbin Viewer is a Chrome extension for `mobbin.com`, focused on deblurring, fullscreen viewing, asset copying, and bulk downloading.

> [!WARNING]
> This extension is for educational purposes only. I am not responsible for any misuse, violations of terms of service, or any consequences resulting from its use. Use it at your own risk.

## Features

- `Visual Restoration` (视觉还原): 去除 Mobbin 页面素材的模糊遮罩，恢复正常浏览体验。
- `Fullscreen Preview` (全屏预览): 支持更直接地查看页面素材内容。
- `Asset Copy` (素材复制): 提供便捷复制能力，减少手动提取成本。
- `Bulk Download` (批量下载): 支持批量导出当前页面素材。

## Install

1. 运行 `pnpm install`
2. 运行 `pnpm build`
3. 打开 Chrome 的 `chrome://extensions`
4. 开启开发者模式并选择“加载已解压的扩展程序”
5. 选择项目内的 `dist/` 目录

## Development

- 安装依赖: `pnpm install`
- 构建扩展: `pnpm build`
- 构建输出目录: `dist/`

## Preview

![Function demonstration](https://github.com/A2coffee/Mobbin-Viewer/blob/main/Function%20demonstration.png?raw=true "Function demonstration")
