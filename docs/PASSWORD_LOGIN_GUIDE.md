# 账号密码登录改造说明

## 一、数据库迁移

新增字段：`User.username`、`User.email`、`User.passwordHash`

执行命令（在 idle-game-backend 目录）：

```
npx prisma generate
npx prisma migrate dev --name add_password_login_fields
```

> 生产环境用：`npx prisma migrate deploy`

## 二、后端接口

- 注册（账号/邮箱 + 密码）
  - `POST /api/auth/register-password`
  - Body: `{ "username": "demo", "email": "a@b.com", "password": "123456" }`（`username` 或 `email` 至少提供一个）

- 登录（用户名或邮箱 + 密码）
  - `POST /api/auth/login-password`
  - Body: `{ "identifier": "demo", "password": "123456", "deviceId": "your-device-id" }`

响应体与原验证码登录一致：`token`、`refreshToken`、`userId`、`needKYC`

## 三、前端使用

- 登录页面 `src/pages/auth/LoginPage.tsx` 默认显示“账号密码”模式，可切换到“短信验证码”。
- 新增 API：
  - `api.auth.registerPassword(username?, email?, password?)`
  - `api.auth.loginPassword(identifier, password)`

## 四、常见问题

- 报错“用户名/邮箱已被占用”：检查唯一性，换一个 `username` 或 `email`。
- 报错“账号或密码错误”：确认使用的 `identifier` 与密码正确，或先通过注册接口创建账户。


