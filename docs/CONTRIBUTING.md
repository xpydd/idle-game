# 项目开发规范

## 📝 代码规范

### Git 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型：**

- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行的变动）
- `refactor`: 重构（既不是新增功能，也不是修改bug的代码变动）
- `perf`: 性能优化
- `test`: 增加测试
- `chore`: 构建过程或辅助工具的变动

**示例：**

```bash
git commit -m "feat(auth): 添加手机号登录功能"
git commit -m "fix(pet): 修复星宠融合概率计算错误"
git commit -m "docs(readme): 更新部署说明文档"
```

### 分支管理策略

采用 Git Flow 工作流：

```
main                生产环境分支
├── develop         开发主分支
│   ├── feature/*   功能开发分支
│   ├── fix/*       bug修复分支
│   └── test/*      测试分支
├── release/*       发布准备分支
└── hotfix/*        紧急修复分支
```

**工作流程：**

1. 从 `develop` 创建 `feature/xxx` 分支开发新功能
2. 开发完成后提交 Pull Request 到 `develop`
3. 代码审查通过后合并到 `develop`
4. 准备发布时从 `develop` 创建 `release/v1.x` 分支
5. 测试通过后合并到 `main` 和 `develop`
6. 紧急修复从 `main` 创建 `hotfix/xxx` 分支

## 🎨 代码风格

### TypeScript

```typescript
// ✅ 好的命名
interface User {
  userId: string;
  userName: string;
  createdAt: Date;
}

function getUserById(userId: string): Promise<User> {
  // ...
}

// ❌ 避免
interface user {  // 接口应该用 PascalCase
  user_id: string;  // 使用 camelCase 而不是 snake_case
  UserName: string;  // 不一致的命名
}

function get_user(id: string) {  // 函数应该用 camelCase
  // ...
}
```

### React 组件

```typescript
// ✅ 好的组件结构
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      {label}
    </button>
  );
}

// ❌ 避免
export function button(props) {  // 组件名应该是 PascalCase
  return <button onClick={props.onClick}>{props.label}</button>;  // 缺少类型定义
}
```

### API 路由

```typescript
// ✅ 好的路由结构
router.get('/api/pets', authenticate, asyncHandler(async (req, res) => {
  const pets = await petService.getUserPets(req.user.userId);
  res.json({
    success: true,
    data: { pets }
  });
}));

// ❌ 避免
router.get('/api/pets', async (req, res) => {  // 缺少认证和错误处理
  const pets = await db.query('SELECT * FROM pets');  // 直接操作数据库
  res.send(pets);  // 响应格式不统一
});
```

## 📁 文件组织

### 前端文件结构

```
src/
├── pages/              # 页面组件（PascalCase + Page后缀）
│   └── game/
│       └── GamePage.tsx
├── components/         # 通用组件（PascalCase）
│   └── common/
│       └── Button.tsx
├── store/              # 状态管理（camelCase + Store后缀）
│   └── userStore.ts
├── utils/              # 工具函数（camelCase）
│   └── format.ts
└── types/              # 类型定义（camelCase）
    └── index.ts
```

### 后端文件结构

```
src/
├── routes/             # 路由（camelCase + .routes后缀）
│   └── auth.routes.ts
├── controllers/        # 控制器（camelCase + .controller后缀）
│   └── auth.controller.ts
├── services/           # 服务层（camelCase + .service后缀）
│   └── auth.service.ts
├── middlewares/        # 中间件（camelCase + .middleware后缀）
│   └── auth.middleware.ts
└── types/              # 类型定义
    └── index.ts
```

## 🧪 测试规范

### 单元测试

```typescript
// auth.service.test.ts
describe('AuthService', () => {
  describe('login', () => {
    it('should return token when credentials are valid', async () => {
      const result = await authService.login('13800138000', '123456');
      expect(result).toHaveProperty('token');
      expect(result.token).toBeTruthy();
    });

    it('should throw error when phone is invalid', async () => {
      await expect(authService.login('invalid', '123456'))
        .rejects.toThrow('无效的手机号');
    });
  });
});
```

### API 测试

```typescript
// auth.routes.test.ts
describe('POST /api/auth/login', () => {
  it('should return 200 with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        phone: '13800138000',
        code: '123456',
        deviceId: 'test-device'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('token');
  });
});
```

## 📚 文档规范

### 代码注释

```typescript
/**
 * 计算星宠挂机收益
 * 
 * @param pet - 星宠信息
 * @param duration - 挂机时长（小时）
 * @param isOnline - 是否在线
 * @returns 收益信息（宝石和贝壳）
 * 
 * @example
 * const rewards = calculateAfkRewards(pet, 12, false);
 * console.log(rewards.gems); // 10.5
 */
export function calculateAfkRewards(
  pet: Pet,
  duration: number,
  isOnline: boolean
): Rewards {
  // 实现代码...
}
```

### API 文档

```typescript
/**
 * @api {post} /api/afk/start 开启挂机
 * @apiName StartAfk
 * @apiGroup Afk
 * @apiVersion 1.0.0
 * 
 * @apiHeader {String} Authorization Bearer token
 * @apiHeader {String} X-Device-Id 设备ID
 * 
 * @apiParam {String} petId 星宠ID
 * @apiParam {Boolean} [autoRefill=false] 是否自动补充能量
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {String} message 提示信息
 * 
 * @apiError (401) Unauthorized 未授权
 * @apiError (400) BadRequest 参数错误
 */
router.post('/start', authenticate, asyncHandler(async (req, res) => {
  // ...
}));
```

## 🔒 安全规范

### 1. 输入验证

```typescript
// ✅ 使用 Zod 进行输入验证
import { z } from 'zod';

const loginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '无效的手机号'),
  code: z.string().length(6, '验证码必须是6位'),
  deviceId: z.string().min(1, '设备ID不能为空')
});

router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  // ...
});
```

### 2. 敏感信息处理

```typescript
// ✅ 不要记录敏感信息
logger.info('用户登录', {
  userId: user.id,
  // ❌ phone: user.phone,  // 不要记录手机号
  // ❌ password: req.body.password,  // 永远不要记录密码
});

// ✅ 密码加密
import bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 3. SQL 注入防护

```typescript
// ✅ 使用 Prisma ORM（自动防护）
const user = await prisma.user.findUnique({
  where: { phone: phone }
});

// ❌ 避免原始 SQL 拼接
const query = `SELECT * FROM users WHERE phone = '${phone}'`;  // 危险！
```

## 🔧 性能优化

### 1. 数据库查询

```typescript
// ✅ 只查询需要的字段
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    // 不查询不需要的字段
  }
});

// ✅ 使用索引
// @prisma/client 会自动使用定义的索引

// ✅ 批量操作
await prisma.pet.createMany({
  data: pets,
  skipDuplicates: true
});
```

### 2. 缓存策略

```typescript
// ✅ 缓存热点数据
async function getUserProfile(userId: string) {
  const cacheKey = `user:${userId}`;
  
  // 先从缓存读取
  let user = await redis.get(cacheKey);
  if (user) {
    return JSON.parse(user);
  }
  
  // 缓存未命中，查询数据库
  user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  // 写入缓存
  await redis.setex(cacheKey, 1800, JSON.stringify(user));  // 30分钟
  
  return user;
}
```

### 3. 前端优化

```typescript
// ✅ 使用 React.memo 避免不必要的重渲染
export const PetCard = React.memo(({ pet }: { pet: Pet }) => {
  return <div>{pet.name}</div>;
});

// ✅ 使用 useMemo 缓存计算结果
const sortedPets = useMemo(() => {
  return pets.sort((a, b) => b.level - a.level);
}, [pets]);

// ✅ 使用 useCallback 缓存函数
const handleClick = useCallback(() => {
  onClick(pet.id);
}, [pet.id, onClick]);
```

## 📊 监控与日志

### 日志级别

```typescript
// ERROR - 错误，需要立即处理
logger.error('数据库连接失败', { error: err.message });

// WARN - 警告，需要注意但不紧急
logger.warn('API 请求超时', { url, duration });

// INFO - 重要信息，正常业务流程
logger.info('用户登录成功', { userId });

// DEBUG - 调试信息，仅在开发环境使用
logger.debug('请求参数', { params: req.params });
```

### 监控指标

需要监控的关键指标：

- **性能指标**: API 响应时间、数据库查询时间
- **业务指标**: DAU、注册数、充值金额
- **错误指标**: 错误率、异常数量
- **资源指标**: CPU、内存、磁盘使用率

## ✅ Code Review 检查清单

提交 PR 前自查：

- [ ] 代码符合命名规范
- [ ] 已添加必要的注释
- [ ] 已编写单元测试
- [ ] 所有测试通过
- [ ] 无 ESLint 警告
- [ ] 无 TypeScript 错误
- [ ] 敏感信息已移除
- [ ] 已更新相关文档
- [ ] 提交信息符合规范

审查他人代码时关注：

- [ ] 代码逻辑正确性
- [ ] 是否有安全隐患
- [ ] 性能是否可以优化
- [ ] 代码可读性和可维护性
- [ ] 错误处理是否完善
- [ ] 是否有重复代码

---

**文档版本**: 1.0.0  
**最后更新**: 2025-10-10

