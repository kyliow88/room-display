# 会议室显示系统 - 安装部署指南

## 概述
这是一个连接 Microsoft 365 日历的会议室状态显示系统，可在 Android 平板上运行。

**支持两种登录方式：**
- **代码登录**（推荐）: 平板显示代码，用手机/电脑输入代码完成授权
- **弹窗登录**: 直接在平板上输入账号密码

## 第一步：在 Azure Portal 注册应用

### 1. 登录 Azure Portal
访问 https://portal.azure.com 并使用你的 Microsoft 365 管理员账号登录。

### 2. 注册新应用
1. 在搜索栏搜索 **"App registrations"**
2. 点击 **"+ New registration"**
3. 填写应用信息：
   - **Name**: `Room Display System`
   - **Supported account types**: 选择 `Accounts in this organizational directory only`（单租户）
   - **Redirect URI**:
     - Platform 选择 `Single-page application (SPA)`
     - URL 填写 `http://localhost:3000`（本地测试）
4. 点击 **"Register"**

### 3. 获取应用信息
注册成功后，在 **"Overview"** 页面记录：
- **Application (client) ID** → 这是 `NEXT_PUBLIC_AZURE_CLIENT_ID`
- **Directory (tenant) ID** → 这是 `NEXT_PUBLIC_AZURE_TENANT_ID`

### 4. 配置 API 权限
1. 在左侧菜单点击 **"API permissions"**
2. 点击 **"Add a permission"** → **"Microsoft Graph"** → **"Delegated permissions"**
3. 添加以下权限：
   - `User.Read` - 读取用户信息
   - `Calendars.Read` - 读取日历
   - `Calendars.ReadWrite` - 读写日历（用于快速预订）
   - `offline_access` - 保持登录状态
4. 点击 **"Add permissions"**
5. 点击 **"Grant admin consent for xxx"**（需要管理员权限）

### 5. 启用设备代码流（重要！）
1. 在左侧菜单点击 **"Authentication"**
2. 滚动到底部找到 **"Advanced settings"**
3. 将 **"Allow public client flows"** 设为 **Yes**
4. 点击 **"Save"**

### 6. 配置身份验证
1. 在 **"Authentication"** 页面
2. 确保已添加重定向 URI: `http://localhost:3000`
3. 在 **"Implicit grant and hybrid flows"** 部分，勾选：
   - ✅ Access tokens
   - ✅ ID tokens
4. 保存设置

---

## 第二步：配置项目

### 1. 编辑环境变量
打开项目目录下的 `.env.local` 文件：

```
NEXT_PUBLIC_AZURE_CLIENT_ID=你的应用程序客户端ID
NEXT_PUBLIC_AZURE_TENANT_ID=你的目录租户ID
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. 安装依赖
```bash
cd room-display
npm install
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 访问测试
- **代码登录**（推荐）: http://localhost:3000/display
- **弹窗登录**: http://localhost:3000

---

## 第三步：配置会议室

1. 访问 http://localhost:3000/admin
2. 登录后设置：
   - **房间名称**: 显示在大屏幕上的名称（如"会议室 A"）
   - **关联日历**: 选择对应的会议室资源日历
3. 保存设置
4. 返回主页查看效果

---

## 第四步：部署到生产环境

### 方案 A：部署到 Vercel（推荐）

1. 将代码推送到 GitHub
2. 访问 https://vercel.com
3. 导入 GitHub 仓库
4. 配置环境变量：
   - `NEXT_PUBLIC_AZURE_CLIENT_ID`
   - `NEXT_PUBLIC_AZURE_TENANT_ID`
5. 部署完成后，回到 Azure Portal 添加新的重定向 URI：
   - `https://your-app.vercel.app`

### 方案 B：本地服务器部署

```bash
npm run build
npm start
```

---

## 第五步：在平板上使用

### 代码登录方式（推荐）

1. 平板打开 Chrome 浏览器
2. 访问 `https://your-app.vercel.app/display`
3. 点击 **"使用代码登录"**
4. 屏幕会显示一个代码，例如 `ABC123`
5. 用手机或电脑访问 **https://microsoft.com/devicelogin**
6. 输入屏幕上显示的代码
7. 登录你的 Microsoft 365 账号并授权
8. 平板自动完成登录！

### 设置全屏模式（Kiosk Mode）

**方法 1：Chrome 全屏**
- 点击右上角菜单 → "添加到主屏幕"
- 从主屏幕打开，会以全屏模式运行

**方法 2：使用 Kiosk 应用**
- 安装 "Fully Kiosk Browser" 应用
- 设置启动 URL 为你的应用地址
- 启用全屏模式和自动启动

---

## 多个会议室部署

每个会议室需要一个独立的平板，各自配置不同的：
- 房间名称
- 关联的日历

配置信息存储在平板本地的 localStorage 中，互不影响。

**每个平板的设置步骤：**
1. 访问 `/display` 使用代码登录
2. 访问 `/admin` 设置房间名称
3. 返回 `/display` 显示状态

---

## 页面说明

| 路径 | 说明 |
|------|------|
| `/display` | 代码登录 + 会议室状态显示（推荐用于平板） |
| `/` | 弹窗登录 + 会议室状态显示 |
| `/admin` | 后台设置（房间名称、日历选择） |

---

## 常见问题

### Q: 代码登录显示失败？
A: 确保在 Azure Portal 启用了 "Allow public client flows"。

### Q: 登录时提示权限不足？
A: 需要管理员在 Azure Portal 点击 "Grant admin consent"。

### Q: 看不到会议室日历？
A: 确保账号有权限访问会议室资源日历，或让管理员共享日历权限。

### Q: 屏幕不会自动更新？
A: 系统每分钟自动刷新一次。如果长时间不更新，检查网络连接。

### Q: Token 过期怎么办？
A: 系统会自动刷新 token，如果刷新失败会提示重新登录。

---

## 技术支持

如有问题，请检查：
1. Azure App 注册配置是否正确
2. 是否启用了 "Allow public client flows"
3. 环境变量是否正确设置
4. 浏览器控制台是否有错误信息
