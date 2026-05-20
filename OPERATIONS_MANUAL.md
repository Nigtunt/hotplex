# HotPlex Docker 操作手册

> 适用版本: v1.16.0 | 更新日期: 2026-05-20

## 1. 构建镜像

```bash
# 先编译 docs 和 webchat（必须，否则 go:embed 报错）
make docs-build
make webchat-embed

# 构建
docker build \
  --build-arg GIT_SHA=$(git rev-parse --short HEAD) \
  --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t hotplex:latest .
```

## 2. 启动容器

### 2.1 Docker Compose（推荐）

```bash
# 基本部署
docker compose up -d

# 含监控 (Prometheus + Grafana)
docker compose --profile monitoring up -d

# 生产部署 (Traefik TLS + Let's Encrypt)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 2.2 docker run

```bash
docker run -d \
  --name hotplex \
  --restart unless-stopped \
  -p 8888:8888 \
  -p 9999:9999 \
  -e HOTPLEX_JWT_SECRET="$(openssl rand -base64 32)" \
  -e HOTPLEX_ADMIN_TOKEN_1="your-admin-token" \
  -e HOTPLEX_SECURITY_API_KEY_1="your-api-key" \
  -e CLAUDE_API_KEY="your-claude-api-key" \
  -e HOTPLEX_LOG_LEVEL="info" \
  -v hotplex-data:/var/lib/hotplex/data \
  -v hotplex-logs:/var/log/hotplex \
  -v ./configs:/etc/hotplex:ro \
  hotplex:latest
```

## 3. 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `HOTPLEX_JWT_SECRET` | **必填** | JWT 密钥，Base64 编码 |
| `HOTPLEX_ADMIN_TOKEN_1` | **必填** | Admin API Token |
| `HOTPLEX_ADMIN_TOKEN_2` | 空 | 备用 Admin Token（无缝轮换） |
| `HOTPLEX_SECURITY_API_KEY_1` | **必填** | 客户端 API Key |
| `CLAUDE_API_KEY` | **必填** | Claude API Key |
| `HOTPLEX_LOG_LEVEL` | `info` | debug / info / warn / error |
| `HOTPLEX_PORT` | `8888` | 网关端口映射 |
| `HOTPLEX_ADMIN_PORT` | `9999` | Admin 端口映射 |
| `TZ` | `Asia/Shanghai` | 时区 |
| `GOMEMLIMIT` | `6500MiB` | Go 内存限制 |
| `GRAFANA_PASSWORD` | `admin` | Grafana 密码（monitoring profile） |
| `BACKUP_INTERVAL` | `3600` | 数据库备份间隔（秒） |
| `RETENTION_DAYS` | `30` | 备份保留天数 |

配置优先级：环境变量 > `/etc/hotplex/config.yaml` > 内部默认值

## 4. 容器内路径

| 路径 | 说明 |
|---|---|
| `/etc/hotplex/config.yaml` | 配置文件 |
| `/var/lib/hotplex/data/hotplex.db` | SQLite 数据库 |
| `/var/log/hotplex/` | 日志 |
| `/home/hotplex/.claude/` | Claude Code 会话数据 |
| `/home/hotplex/scripts/` | STT 等工具脚本 |
| `/usr/local/bin/hotplex` | 网关二进制 |

## 5. 启动后调整配置

### 方式一：修改挂载的配置文件 + 重启

```bash
# 编辑宿主机上的配置
vim ./configs/config.yaml

# 重启容器
docker compose restart
# 或
docker restart hotplex
```

### 方式二：热重载（部分字段，无需重启）

直接修改 `./configs/config.yaml` 并保存，容器内 fsnotify 自动检测变更，500ms 去抖后热生效。

**热生效字段**：`log.level`、`pool.max_size`、`pool.max_idle_per_user`、`worker.max_lifetime`、`worker.idle_timeout`、`worker.execution_timeout`、`worker.auto_retry.*`、`security.api_keys`、`admin.tokens`、`admin.requests_per_sec`

**需重启字段**：`gateway.addr`、`log.format`、`security.tls_enabled`、`security.jwt_secret`、`db.path`、`db.wal_mode`

> 校验失败时保留旧配置，不会导致容器异常。

### 方式三：Admin API 配置回滚

```bash
# 回滚到上一个版本
curl -X POST http://localhost:9999/admin/config/rollback \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"version": 1}'
# → {"ok": true, "rolled_back": 1, "history_index": 42}
```

回滚后热字段立即生效，静态字段需重启容器。

### 方式四：Admin API 校验配置

```bash
curl -X POST http://localhost:9999/admin/config/validate \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"pool": {"max_size": 200}}'
# → {"valid": true, "errors": [], "warnings": [...]}
```

## 6. Admin API 常用端点

认证：`Authorization: Bearer <admin-token>`

```bash
# 健康检查（无需认证）
curl http://localhost:9999/admin/health/ready

# 系统统计
curl -H "Authorization: Bearer <token>" http://localhost:9999/admin/stats

# 列出所有会话
curl -H "Authorization: Bearer <token>" http://localhost:9999/admin/sessions

# 终止会话
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:9999/admin/sessions/<session-id>/terminate

# Prometheus 指标
curl -H "Authorization: Bearer <token>" http://localhost:9999/admin/metrics
```

Web UI：`http://<host>:8888/admin`（v1.16，会话管理/Bot 配置/Cron 管理）

## 7. 数据库备份

Compose 部署自带 backup 服务，每小时自动备份到 `backup-storage` 卷。

手动备份：
```bash
docker exec hotplex sqlite3 /var/lib/hotplex/data/hotplex.db ".backup /tmp/backup.db"
docker cp hotplex:/tmp/backup.db ./backup.db
```

## 8. 查看日志

```bash
# compose
docker compose logs -f gateway

# docker run
docker logs -f hotplex
```

## 9. 容器安全

- 非 root 运行（UID 1000）
- `no-new-privileges: true`
- `cap_drop: ALL`，仅保留 `NET_BIND_SERVICE`
- 资源配置：4 CPU / 8G 内存上限
