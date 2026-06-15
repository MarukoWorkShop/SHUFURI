#!/usr/bin/env bash
#
#  SHUFURI CI/CD 管线状态检查脚本
#  依次验证：代码拉取 → 依赖安装 → TS 类型检查 → 构建 → Lint → 产物完整性
#  任一阶段失败则输出错误信息并退出；全部通过输出 ✅ 成功标识。
#
#  用法:
#    chmod +x scripts/ci-pipeline-check.sh
#    ./scripts/ci-pipeline-check.sh              # 完整检查
#    ./scripts/ci-pipeline-check.sh --quick      # 只做 TS 检查 + 构建
#    ./scripts/ci-pipeline-check.sh --no-install  # 跳过 npm install
#    ./scripts/ci-pipeline-check.sh --help       # 帮助
# ------------------------------------------------------------------

set -euo pipefail

# ---- 配置 -------------------------------------------------------------
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_OUTPUT_DIR="$PROJECT_ROOT/dist"
LOG_PREFIX="[CI]"
START_TIME=$(date +%s)
PASSED=0
FAILED=0
SKIPPED=0

# ---- 参数解析 ----------------------------------------------------------
QUICK_MODE=false
SKIP_INSTALL=false

for arg in "$@"; do
  case "$arg" in
    --quick)    QUICK_MODE=true ;;
    --no-install) SKIP_INSTALL=true ;;
    --help|-h)
      echo "用法: $0 [--quick] [--no-install]"
      echo "  --quick       仅运行 TS 检查 + 构建（快速模式）"
      echo "  --no-install  跳过依赖安装步骤"
      exit 0
      ;;
  esac
done

# ---- 工具函数 ----------------------------------------------------------

color_reset='\033[0m'
color_green='\033[0;32m'
color_red='\033[0;31m'
color_yellow='\033[0;33m'
color_cyan='\033[0;36m'
color_dim='\033[2m'

log_info()  { printf "${color_cyan}${LOG_PREFIX}${color_reset} %s\n" "$*"; }
log_pass()  { printf "${color_green}${LOG_PREFIX} ✅ PASS${color_reset}  %s\n" "$*";  PASSED=$((PASSED+1)); }
log_fail()  { printf "${color_red}${LOG_PREFIX} ❌ FAIL${color_reset}  %s\n" "$*";  FAILED=$((FAILED+1)); }
log_warn()  { printf "${color_yellow}${LOG_PREFIX} ⚠️  WARN${color_reset}  %s\n" "$*";  SKIPPED=$((SKIPPED+1)); }
log_detail(){ printf "${color_dim}${LOG_PREFIX}       ${color_reset}%s\n" "$*"; }
log_sep()   { echo ''; }

run_stage() {
  local stage_name="$1"
  local stage_cmd="$2"
  shift 2

  log_sep
  log_info "━━━ 阶段: ${stage_name} ━━━"

  local output
  local exit_code=0

  output=$(cd "$PROJECT_ROOT" && eval "$stage_cmd" 2>&1) || exit_code=$?

  if [ "$exit_code" -eq 0 ]; then
    # 输出最后 3 行日志
    echo "$output" | tail -n 3 | while IFS= read -r line; do log_detail "$line"; done
    log_pass "$stage_name"
    return 0
  else
    # 输出错误信息（最后 20 行）
    echo "$output" | tail -n 20 | while IFS= read -r line; do log_detail "$line"; done
    log_fail "$stage_name (exit code: $exit_code)"
    return 1
  fi
}

# ---- 主流程 ------------------------------------------------------------

log_sep
printf "${color_cyan}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║     SHUFURI  CI/CD 管线检查             ║"
echo "  ╚══════════════════════════════════════════╝"
printf "${color_reset}"
log_info "项目根目录: $PROJECT_ROOT"
log_info "模式: $([ "$QUICK_MODE" = true ] && echo '快速' || echo '完整')"
log_info "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"

# ─── 阶段 0: 预检 ──────────────────────────────────────────────────────
log_sep
log_info "━━━ 阶段 0: 环境预检 ━━━"
if ! command -v node &>/dev/null; then
  log_fail "Node.js 未安装"
  exit 1
fi
log_detail "Node.js $(node --version)"

if ! command -v npm &>/dev/null; then
  log_fail "npm 未安装"
  exit 1
fi
log_detail "npm $(npm --version)"

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  log_fail "package.json 不存在"
  exit 1
fi
log_pass "环境预检"

# ─── 阶段 1: 代码拉取检查 ─────────────────────────────────────────────
run_stage "代码拉取检查" "git status --porcelain" || {
  # git status 失败意味着不在 git 仓库中——这在 CI 环境可能是正常的
  if [ ! -d "$PROJECT_ROOT/.git" ]; then
    log_warn "非 Git 仓库，跳过 Git 检查"
  else
    exit 1
  fi
}

# ─── 阶段 2: 依赖安装 ──────────────────────────────────────────────────
if [ "$SKIP_INSTALL" = true ]; then
  log_warn "依赖安装（已跳过 --no-install）"
else
  # 检查 node_modules 是否已安装且版本匹配
  if [ -d "$PROJECT_ROOT/node_modules" ] && [ -f "$PROJECT_ROOT/package-lock.json" ]; then
    local_sha=$(cd "$PROJECT_ROOT" && npm ls --depth=0 --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('problems',['ok']))" 2>/dev/null || echo "unknown")
    if [ "$local_sha" = "['ok']" ] || [ "$local_sha" = "ok" ]; then
      log_info "node_modules 已存在且完整，跳过安装"
      log_pass "依赖安装（使用缓存）"
    else
      run_stage "依赖安装" "npm ci --prefer-offline --no-audit --no-fund"
    fi
  else
    run_stage "依赖安装" "npm ci --prefer-offline --no-audit --no-fund"
  fi
fi

# ─── 阶段 3: TypeScript 类型检查 ───────────────────────────────────────
run_stage "TypeScript 类型检查" "npx tsc --noEmit"

# ─── 阶段 4: Vite 构建 ─────────────────────────────────────────────────
run_stage "Vite 构建" "npm run build"

# ─── 阶段 5: 构建产物检查 ─────────────────────────────────────────────
log_sep
log_info "━━━ 阶段 5: 构建产物验证 ━━━"
if [ -d "$BUILD_OUTPUT_DIR" ]; then
  html_count=$(find "$BUILD_OUTPUT_DIR" -name "*.html" | wc -l | tr -d ' ')
  js_count=$(find "$BUILD_OUTPUT_DIR" -name "*.js" | wc -l | tr -d ' ')
  css_count=$(find "$BUILD_OUTPUT_DIR" -name "*.css" | wc -l | tr -d ' ')

  if [ "$html_count" -gt 0 ] && [ "$js_count" -gt 0 ]; then
    log_detail "HTML: ${html_count}   JS: ${js_count}   CSS: ${css_count}"
    log_pass "构建产物完整性（${html_count} html, ${js_count} js, ${css_count} css）"
  else
    log_fail "构建产物不完整（HTML:${html_count} JS:${js_count}）"
    exit 1
  fi
else
  log_fail "构建产物目录不存在: $BUILD_OUTPUT_DIR"
  exit 1
fi

# ─── 阶段 6: Lint（可选，非阻断）──────────────────────────────────────
if [ "$QUICK_MODE" = true ]; then
  log_warn "Lint 检查（快速模式跳过）"
elif command -v npx &>/dev/null && npx eslint --version &>/dev/null 2>&1; then
  run_stage "ESLint 检查" "npx eslint 'src/**/*.{ts,tsx}' --max-warnings 0" || true
else
  log_warn "ESLint 未配置，跳过 Lint 检查"
fi

# ─── 汇总 ──────────────────────────────────────────────────────────────
ELAPSED=$(($(date +%s) - START_TIME))
log_sep
printf "${color_cyan}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║            管线检查完毕                  ║"
echo "  ╚══════════════════════════════════════════╝"
printf "${color_reset}"

printf "${color_green}✅ 通过: %d${color_reset}  " "$PASSED"
printf "${color_red}❌ 失败: %d${color_reset}  " "$FAILED"
printf "${color_yellow}⚠️  跳过: %d${color_reset}\n" "$SKIPPED"
log_info "总耗时: ${ELAPSED}s"

if [ "$FAILED" -gt 0 ]; then
  log_sep
  log_fail "管线检查未通过 — 请修复上方 ❌ 标记的阶段后重试"
  exit 1
fi

log_sep
echo "  🎉  全部通过 — 管线状态正常，可部署"
exit 0
