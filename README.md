<div align="center">
    <a href="https://github.com/WangQueXL/PixR2"><img width="15%" src="docs/screenshot/logo.png"/></a>
    <h1>PixR2</h1>
    <p>基于 Cloudflare Workers + R2 的多入口文件托管与网盘管理平台</p>
</div>


## 项目简介

PixR2 是一个 **无服务器部署（Serverless）** 的在线文件托管工具，基于 **Cloudflare Workers** 和 **R2** 构建
支持 **网页端上传** 与 **Telegram Bot 上传** 两种方式，帮助你快速、安全地将文件存储到云端，并提供管理与分享功能

- 📤 支持上传图片、文档、压缩包、音视频和其他常见文件
- 🌐 支持网页上传与 Telegram Bot 上传双入口  
- 🖼 支持图片在线预览与文件管理
- 🔗 支持创建与管理分享链接，快速将指定文件夹对外分享  
- ⚡ 使用 Cloudflare Workers 部署，无需传统服务器  


## 项目预览

<p align="left">
<img src="docs/screenshot/1.png" width="30%" />
<img src="docs/screenshot/2.png" width="30%" />
<img src="docs/screenshot/3.png" width="30%" />
</p>

<p align="left">
<img src="docs/screenshot/4.jpg" width="8%" />
<img src="docs/screenshot/5.png" width="29%" />
<img src="docs/screenshot/6.png" width="29%" />
<img src="docs/screenshot/7.png" width="29%" />
</p>


## Workers 部署教程

### 0. 准备工作  
- 准备一个可用的域名（Cloudflare 提供的 workers.dev 域名在中国大陆无法访问）
- [可选]创建一个 Telegram 机器人（在 Telegram 中搜索 @BotFather，按照指引创建你的机器人）
- [可选]获取你的 Telegram 用户 ID（ID 为纯数字，用于限制哪些用户可以使用该机器人）

### 1. 创建 KV 与 R2 存储桶  
- 在 Cloudflare 侧边栏中找到 **存储与数据库**
- 选择 **Workers KV**
- 创建一个任意名称的 KV 命名空间 
- 再选择 **R2 对象存储** 
- 创建一个任意名称的 R2 存储桶

### 2. 从 GitHub Repo 部署
- Fork 或上传本项目到你自己的 GitHub 仓库
- 在 Cloudflare 侧边栏找到 **计算和 AI**
- 选择 **Workers 和 Pages**
- 创建应用，选择 **Import a repository**
- 选择你的 PixR2 仓库并创建 Worker
- Worker 名称填写 `pixr2`，或同步修改 [wrangler.toml](wrangler.toml) 里的 `name`
- 项目入口已经写在 [wrangler.toml](wrangler.toml) 中：`main = "src/index.js"`
- 如果 Cloudflare 让你填写构建设置，项目根目录保持 `/`，Build command 填写 `npm run build`，Deploy command 填写 `npm run deploy`
- Worker 创建完成后，进入项目设置，点击 **绑定** -> **添加绑定**
  - 选择 **R2 存储桶**，变量名填写 `BUCKET_R2`，选择之前创建的 R2 存储桶  
  - 再次添加绑定，选择 **KV 命名空间**，变量名填写 `SHARES_KV`，选择之前创建的 KV  
  - 再次添加绑定，选择 **KV 命名空间**，变量名填写 `INDEXES_KV`，选择之前创建的 KV  
- 点击 **设置** -> **变量和机密**，添加以下环境变量：

| 变量名           | 说明                              |
|------------------|---------------------------------|
| SECRET_KEY       | Web 面板登陆密码（请不要使用弱密码） |
| ENABLE_TELEGRAM_BOT | 是否启用 Telegram 机器人功能 ( `true` / `false` ）仅在启用时需要填写以下变量|
| TELEGRAM_BOT_TOKEN | Telegram 机器人 Token |
| TELEGRAM_WEBHOOK_SECRET | Telegram Webhook 校验密钥，建议使用 32 位以上随机字符串 |
| USER_ID          | 允许使用此机器人的 Telegram 用户 ID，多个用户使用英文逗号分隔 |

- `TELEGRAM_WEBHOOK_SECRET` 可以使用 `openssl rand -hex 32` 生成，并作为 Secret/机密变量保存。
- 最后在 **域和路由** 为你的 Workers 项目添加自定义域  
- 登录 Web 面板后访问 `https://<你的自定义域>/setWebhook` 激活 Telegram Webhook
- 现在就可以通过 Telegram Bot 和 Web 面板开始使用了  
- 在 Telegram 里发送任意消息即可获得 Bot 指令帮助  

### 3. 项目结构
- [_worker.js](_worker.js)：兼容入口，转发到模块化 Worker 入口
- [src/index.js](src/index.js)：Worker 主入口与路由注册
- [src/api/files.js](src/api/files.js)：文件上传、分片上传、目录、分享和文件操作 API
- [src/api/telegram.js](src/api/telegram.js)：Telegram Bot Webhook 与消息处理
- [src/pages/explorer.js](src/pages/explorer.js)：文件管理页面
- [src/pages](src/pages)：登录和分享页面
- [src/utils/files.js](src/utils/files.js)：文件名、类型、R2 列表和直链工具函数


## 其他

> 本项目基于 [cloudflare-r2-telegram-bot](https://github.com/xinycai/cloudflare-r2-telegram-bot) 二次开发

采用 MIT 许可协议，详见 LICENSE 文件
