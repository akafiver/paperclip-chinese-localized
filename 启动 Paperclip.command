#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/leon/Documents/CodeProjects/paperclip"
PNPM_VERSION="9.15.4"
NODE_VERSION="22"

echo "========================================"
echo " Paperclip 中文本地化版启动器"
echo "========================================"
echo
echo "项目目录: ${PROJECT_DIR}"
echo "启动前清理旧进程..."
echo

cd "${PROJECT_DIR}"

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "释放端口 ${port}: ${pids}"
    kill ${pids} 2>/dev/null || true
    sleep 1
    pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "强制释放端口 ${port}: ${pids}"
      kill -9 ${pids} 2>/dev/null || true
    fi
  fi
}

kill_pattern() {
  local pattern="$1"
  local pids
  pids="$(pgrep -f "${pattern}" 2>/dev/null | grep -v "^$$$" || true)"
  if [[ -n "${pids}" ]]; then
    echo "结束旧进程: ${pattern}"
    echo "${pids}" | xargs kill 2>/dev/null || true
    sleep 1
    pids="$(pgrep -f "${pattern}" 2>/dev/null | grep -v "^$$$" || true)"
    if [[ -n "${pids}" ]]; then
      echo "${pids}" | xargs kill -9 2>/dev/null || true
    fi
  fi
}

# Paperclip 本地默认 UI 在 3100；同时清理常见 dev runner / vite / tsx 进程。
kill_port 3100
kill_pattern "${PROJECT_DIR}.*dev-runner"
kill_pattern "${PROJECT_DIR}.*dev-service"
kill_pattern "${PROJECT_DIR}.*@paperclipai/server"
kill_pattern "${PROJECT_DIR}.*@paperclipai/ui"
kill_pattern "${PROJECT_DIR}.*vite"
kill_pattern "${PROJECT_DIR}.*tsx"

echo
echo "旧进程清理完成。"
echo

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  source "${HOME}/.nvm/nvm.sh"
  nvm use "${NODE_VERSION}" >/dev/null
else
  echo "未找到 nvm: ${HOME}/.nvm/nvm.sh"
  echo "将使用当前系统 Node。"
fi

echo "Node: $(node -v)"
echo "pnpm: corepack pnpm@${PNPM_VERSION}"
echo
echo "启动 Paperclip..."
echo "浏览器地址通常是: http://127.0.0.1:3100"
echo

corepack pnpm@${PNPM_VERSION} dev

