# new_RPG_demo

甲骨文探索、收集与占卜学习项目（RPG 2.0）。项目使用 Cocos Creator 3.8.8 和 TypeScript 开发，目标平台为 Android 横屏学习设备。

当前游戏主体位于 [`assets/scripts/YinXuCity.ts`](assets/scripts/YinXuCity.ts)，学习大厅位于 [`assets/scripts/LearningHall.ts`](assets/scripts/LearningHall.ts)。地图、角色、甲骨文和界面素材均位于 `assets/`，不能只复制单个脚本文件运行。

## 项目内容

- 殷墟世界地图、城内外场景与动态环境
- 玩家、村民、碰撞遮挡和移动系统
- 甲骨文挖掘、辨识、收集与复习模块
- 宗庙占卜交互和学习大厅
- 背包、工具、天气与本地存档

## 开发环境

- Cocos Creator 3.8.8
- TypeScript
## 团队协作

本仓库是当前可运行 Cocos 项目的团队开发主仓库。协作者可 Fork 本仓库，在自己的分支完成开发后通过 Pull Request 合并。

`library/`、`temp/`、`build/`、Android 安装包和签名文件属于本机生成内容，不提交到仓库；克隆后使用 Cocos Creator 3.8.8 打开项目即可重新生成。
