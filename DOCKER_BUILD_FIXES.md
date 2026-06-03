# Docker 镜像修复总结

**分支**: `fix/docker-build`  
**基准**: `main` (origin/main)  
**日期**: 2026-06-03  

---

## 修复清单

### 1. Go 模块依赖解析失败

**错误**: `reading client/go.mod: open /build/client/go.mod: no such file or directory`

**原因**: `go.mod` 中有 `replace => ./client` 指令，Dockerfile 只复制了根目录的 `go.mod go.sum`，未复制 `client/` 子模块依赖文件。

**修复**: `Dockerfile` 构建阶段增加一行：
```dockerfile
COPY client/go.mod client/go.sum ./client/
```

### 2. `scripts/` 目录被 `.dockerignore` 排除

**错误**: `no required module provides package github.com/hrygo/hotplex/scripts`

**原因**: `internal/assets/assets.go` 通过 `//go:embed` 嵌入 `scripts/` 下的 Python 脚本，但 `.dockerignore` 排除了 `scripts/`，导致 Go 编译时找不到包。

**修复**: `.dockerignore` 移除 `scripts/` 排除规则。

### 3. 容器启动 `mkdir /run/hotplex` 权限不足

**错误**: `mkdir: cannot create directory '/run/hotplex'`

**原因**: 入口脚本 `docker-entrypoint.sh` 尝试创建 `/run/hotplex/config`，但容器以 `hotplex`（非 root）用户运行，无权限在 `/run/` 下建目录。Dockerfile 未预先创建并授权该目录。

**修复**: `Dockerfile` 运行时阶段 `useradd` 后增加：
```dockerfile
mkdir -p ... /run/hotplex && \
chown -R hotplex:hotplex ... /run/hotplex
```

### 4. Claude Code 安装方式改为 npm

**错误**: 内网部署环境下 GCS 下载的 Claude Code 二进制无法使用。

**原因**: GCS 下载的静态二进制与内网环境不兼容。

**修复**:
- `Dockerfile` ai-tools-collector 阶段注释掉 GCS 下载和 COPY 指令（保留原文以备参考）
- 运行时阶段 npm 安装后增加：
```dockerfile
RUN npm i -g @anthropic-ai/claude-code@2.1.109
```

### 5. 文档链接在 Windows 上生成反斜杠导致 404

**错误**: 生成的 HTML 文档链接为 `./guides%5centerprise%5ccompliance.html`，点击 404。

**原因**: `cmd/build-docs/main.go` 的 `normalizePath` 函数用 `filepath.Clean` 处理路径，Windows 上会 `\` 改回 `/` → `%5c`。

**修复**: `cmd/build-docs/main.go` 改为 `path.Clean`（始终使用 `/`，跨平台一致）：
```go
import "path"  // 新增

func normalizePath(p string) string {
    return path.Clean(strings.ReplaceAll(p, "\\", "/"))
}
```

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `.dockerignore` | 移除 `scripts/` 排除 |
| `Dockerfile` | client/go.mod、/run/hotplex、npm 安装 Claude |
| `cmd/build-docs/main.go` | `filepath.Clean` → `path.Clean` |
