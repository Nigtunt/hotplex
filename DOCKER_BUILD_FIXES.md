# Docker Build 修复记录

> 2026-05-20 · Windows amd64 构建 `linux/amd64` 镜像

## 修复一：`.dockerignore` 排除规则与 Dockerfile 冲突

**现象**：`COPY scripts/` 失败 —— `scripts/` 被 `.dockerignore` 排除

**原因**：`.dockerignore` 注释写"Scripts (not needed in runtime)"，但 Dockerfile 第 111 行需要 COPY 它

**修复**：移除 `.dockerignore` 中 `scripts/` 的排除规则

---

## 修复二：`go mod download` 找不到 `client/go.mod`

**现象**：`go mod download` 报错 `no such file or directory: /build/client/go.mod`

**原因**：`go.mod` 有 `replace github.com/hrygo/hotplex/client => ./client`，`go mod download` 需要解析 replace 目标。Dockerfile 为了利用 layer cache 只先 COPY 了根 `go.mod go.sum`，没包含 `client/` 目录

**修复**：在 `go mod download` 前加一行 `COPY client/go.mod client/go.sum ./client/`

```dockerfile
 COPY go.mod go.sum ./
+COPY client/go.mod client/go.sum ./client/
 RUN --mount=type=cache,target=/go/pkg/mod go mod download
```

---

## 修复三：`go:embed` 找不到嵌入文件

**现象**：
```
configs/embed.go:8:12: pattern config.yaml: no matching files found
internal/docs/embed.go:5:12: pattern all:out: no matching files found
internal/webchat/embed.go:5:12: pattern all:out: no matching files found
```

**原因**：
1. `.dockerignore` 的 `configs/*.yaml` 排除了 `config.yaml`，但 `configs/embed.go` 需要它
2. `internal/docs/out/` 和 `internal/webchat/out/` 需要预先编译（`make docs-build` + `make webchat-embed`），且 docs 输出被 `.dockerignore` 的 `docs/` 规则排除

**修复**：
1. `.dockerignore` 添加 `!configs/config.yaml` 和 `!internal/docs/out/`
2. 构建镜像前先执行 `make docs-build` 和 `make webchat-embed`

---

## 修复四：Docs 链接含 `%5c`（Windows 反斜杠路径）

**现象**：生成的 HTML 文档中链接为 `<a href="./guides%5centerprise%5ccompliance.html">`，点击 404

**原因**：`cmd/build-docs/main.go` 的 `normalizePath` 函数先用 `strings.ReplaceAll` 把 `\` 替换成 `/`，但随后 `filepath.Clean` 在 Windows 上又改回 `\`

```go
// 修复前
func normalizePath(p string) string {
    return filepath.Clean(strings.ReplaceAll(p, "\\", "/"))
}
```

**修复**：改用 `path.Clean`（始终使用 `/` 分隔符）

```go
// 修复后
func normalizePath(p string) string {
    return path.Clean(strings.ReplaceAll(p, "\\", "/"))
}
```

> Linux 上无此问题，因为 `filepath.Clean` 在 Linux 上本就使用 `/`

---

## 修复五：镜像未安装 Claude Code CLI

**现象**：容器启动后 `claude_code` worker 无法工作

**原因**：Dockerfile 第 91 行 `npm install -g @anthropic-ai/claude-code` 被注释

**修复**：取消注释，启用安装

---

## 修复六：Claude Code CLI 报错 "No suitable shell found"

**现象**：容器内 Claude Code 执行报错 `Command failed: No suitable shell found. Claude CLI requires a Posix shell environment. Please ensure you have a valid shell installed and the SHELL environment variable set.`

**原因**：Alpine 默认只有 busybox `ash`，Claude Code CLI 需要 bash。且 `SHELL` 环境变量未设置。

**修复**：
1. `apk add` 列表加 `bash`
2. 添加 `ENV SHELL=/bin/bash`

---

## 修复七：Docker HEALTHCHECK 调用 `/admin/health/ready` 一直返回 401

**现象**：容器启动后日志每 30 秒打印：
```
"msg":"admin: request" "method":"GET" "path":"/admin/health/ready" "status":401 "duration":14601 "ip":"::1"
```

**原因**：`AdminAPI.Middleware` 对所有路径（包括 `/admin/health/ready`）都强制要求 admin token。Docker HEALTHCHECK（`curl -f http://localhost:9999/admin/health/ready`）不带 token 调用，每次都被拒绝。文档标注该端点"无需认证"但中间件未豁免。

**修复**：`internal/admin/admin.go` 中间件中，在 token 验证前对 `/admin/health/ready` 路径放行：

```go
// readiness probe — no auth required (Docker HEALTHCHECK / K8s readinessProbe)
if r.URL.Path == "/admin/health/ready" {
    next.ServeHTTP(sw, r)
    return
}
```
