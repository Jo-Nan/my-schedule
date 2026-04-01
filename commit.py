#!/usr/bin/env python3
"""
一键提交脚本 - 自动化 git 工作流
使用: python commit.py "commit message"
或者: python commit.py （使用默认消息）
"""

import subprocess
import sys
import datetime
import time

DEFAULT_GIT_NAME = "Jo-Nan"
DEFAULT_GIT_EMAIL = "nanqiao.ai@gmail.com"
BACKUP_DIR = "backups"
EXCLUDED_PATHSPECS = [f":(exclude){BACKUP_DIR}", f":(exclude){BACKUP_DIR}/**"]

def is_non_fast_forward_error(output):
    """判断是否为远端领先导致的 push 拒绝"""
    text = (output or "").lower()
    return (
        "non-fast-forward" in text
        or "fetch first" in text
        or "failed to push some refs" in text
        or "updates were rejected because the remote contains work that you do not have locally" in text
    )

def is_auth_error(output):
    """判断是否为鉴权/权限问题"""
    text = (output or "").lower()
    return (
        "authentication" in text
        or "permission denied" in text
        or "publickey" in text
        or "could not read from remote repository" in text
    )

def normalize_status_path(path_text):
    """解析 git status --short 的路径字段"""
    path = (path_text or "").strip()
    if " -> " in path:
        path = path.split(" -> ", 1)[1].strip()
    if path.startswith('"') and path.endswith('"') and len(path) >= 2:
        path = path[1:-1]
    return path

def extract_status_paths(status_output):
    """从 git status --short 输出中提取路径"""
    paths = []
    for line in (status_output or "").splitlines():
        if not line.strip():
            continue
        path_part = line[3:] if len(line) > 3 else line.strip()
        normalized = normalize_status_path(path_part)
        if normalized:
            paths.append(normalized)
    return paths

def is_backup_path(path):
    normalized = (path or "").replace("\\", "/").strip()
    return normalized == BACKUP_DIR or normalized.startswith(f"{BACKUP_DIR}/")

def extract_staged_backup_paths():
    """获取已暂存的 backups/ 目录下路径"""
    staged_result = run_cmd(["git", "diff", "--cached", "--name-only"], check=False, capture_output=True)
    staged_paths = []
    for line in (staged_result.stdout or "").splitlines():
        normalized = normalize_status_path(line.strip())
        if normalized:
            staged_paths.append(normalized)
    return [path for path in staged_paths if is_backup_path(path)]

def unstage_backup_changes_if_any():
    """确保 backups/ 改动不会进入提交（即使之前被手动 git add）"""
    staged_backup_paths = extract_staged_backup_paths()
    if not staged_backup_paths:
        return
    print(f"ℹ️  检测到 {len(staged_backup_paths)} 项 backups/ 已暂存，正在自动移出暂存区...")
    run_cmd(["git", "restore", "--staged", "--", BACKUP_DIR], check=False, capture_output=True)
    remaining_backup_paths = extract_staged_backup_paths()
    if remaining_backup_paths:
        print("❌ 无法完全移除 backups/ 暂存改动，请手动执行：git restore --staged -- backups")
        sys.exit(1)
    print("✅ backups/ 暂存改动已移除")

def run_cmd(cmd, check=True, capture_output=False):
    """执行命令"""
    printable_cmd = " ".join(cmd)
    print(f"🚀 {printable_cmd}")
    result = subprocess.run(cmd, text=True, capture_output=capture_output)
    if check and result.returncode != 0:
        print(f"❌ 命令执行失败")
        if capture_output and result.stderr:
            print(result.stderr.strip())
        sys.exit(1)
    return result

def ensure_git_identity():
    """确保当前仓库 Git 身份正确"""
    print("\n✅ 检查 Git 用户信息...")

    name_result = run_cmd(["git", "config", "--get", "user.name"], check=False, capture_output=True)
    email_result = run_cmd(["git", "config", "--get", "user.email"], check=False, capture_output=True)

    current_name = (name_result.stdout or "").strip()
    current_email = (email_result.stdout or "").strip()

    if current_name != DEFAULT_GIT_NAME:
        run_cmd(["git", "config", "user.name", DEFAULT_GIT_NAME])

    if current_email != DEFAULT_GIT_EMAIL:
        run_cmd(["git", "config", "user.email", DEFAULT_GIT_EMAIL])

    print(f"ℹ️  当前提交身份: {DEFAULT_GIT_NAME} <{DEFAULT_GIT_EMAIL}>")

def push_with_auto_rebase(current_branch):
    """推送；若远端领先则自动 rebase 后重试"""
    push_result = run_cmd(["git", "push"], check=False, capture_output=True)
    if push_result.returncode == 0:
        if push_result.stdout:
            print(push_result.stdout.strip())
        return True

    stderr = (push_result.stderr or "").strip()
    stdout = (push_result.stdout or "").strip()
    combined_output = f"{stdout}\n{stderr}".strip()

    print("❌ 推送失败")
    print(combined_output)

    if is_auth_error(combined_output):
        print("\n💡 提示：鉴权失败。请检查 SSH key / ssh-agent / 仓库访问权限。")
        return False

    if not is_non_fast_forward_error(combined_output):
        return False

    print("\nℹ️  检测到远端有新提交，尝试自动同步（pull --rebase）后重试推送...")

    fetch_result = run_cmd(["git", "fetch", "origin"], check=False, capture_output=True)
    if fetch_result.returncode != 0:
        fetch_stderr = (fetch_result.stderr or "").strip()
        fetch_stdout = (fetch_result.stdout or "").strip()
        print("❌ 获取远端失败")
        print(f"{fetch_stdout}\n{fetch_stderr}".strip())
        return False

    rebase_result = run_cmd(["git", "pull", "--rebase", "origin", current_branch], check=False, capture_output=True)
    if rebase_result.returncode != 0:
        rebase_stderr = (rebase_result.stderr or "").strip()
        rebase_stdout = (rebase_result.stdout or "").strip()
        print("❌ 自动 rebase 失败，可能有冲突，请手动处理：")
        print(f"{rebase_stdout}\n{rebase_stderr}".strip())
        print("\n💡 建议：")
        print("   1) 解决冲突后执行 git rebase --continue")
        print("   2) 若想放弃本次 rebase，执行 git rebase --abort")
        print("   3) 处理完成后再执行 git push")
        return False

    print("✅ 已完成 rebase，同步成功，正在重试推送...")
    retry_push_result = run_cmd(["git", "push"], check=False, capture_output=True)
    if retry_push_result.returncode != 0:
        retry_stderr = (retry_push_result.stderr or "").strip()
        retry_stdout = (retry_push_result.stdout or "").strip()
        print("❌ 重试推送失败")
        print(f"{retry_stdout}\n{retry_stderr}".strip())
        if is_auth_error(f"{retry_stdout}\n{retry_stderr}"):
            print("\n💡 提示：鉴权失败。请检查 SSH key / ssh-agent / 仓库访问权限。")
        return False

    if retry_push_result.stdout:
        print(retry_push_result.stdout.strip())
    return True

def main():
    start_time = time.time()
    
    # 获取提交信息
    if len(sys.argv) > 1:
        message = sys.argv[1]
    else:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        message = f"update: {timestamp}"
    
    print("\n" + "="*50)
    print("📝 一键提交 (add + commit + push)")
    print("="*50)
    print(f"💬 提交信息: \"{message}\"")
    
    # 1. 检查 git 状态
    print("\n✅ 检查 Git 状态...")
    status_all_result = run_cmd(["git", "status", "--short"], check=False, capture_output=True)
    status_filtered_result = run_cmd(
        ["git", "status", "--short", "--", ".", *EXCLUDED_PATHSPECS],
        check=False,
        capture_output=True,
    )

    status_all_output = (status_all_result.stdout or "").strip()
    status_output = (status_filtered_result.stdout or "").strip()
    if not status_output:
        all_paths = extract_status_paths(status_all_output)
        if all_paths and all(is_backup_path(path) for path in all_paths):
            print("ℹ️  仅检测到 backups/ 改动，按规则已跳过。")
        elif all_paths:
            print("ℹ️  没有待提交的改动（已排除 backups/）。")
        else:
            print("ℹ️  没有待提交的改动")
        return

    print(f"📊 检测到 {len(status_output.splitlines())} 个文件变化")
    backup_paths = [path for path in extract_status_paths(status_all_output) if is_backup_path(path)]
    if backup_paths:
        print(f"ℹ️  本次将跳过 backups/ 目录改动（{len(backup_paths)} 项）")

    # 2. 确保 Git 身份正确
    ensure_git_identity()
    
    # 3. 添加所有改动
    print("\n✅ 添加文件...")
    run_cmd(["git", "add", "-A", "--", ".", *EXCLUDED_PATHSPECS])
    unstage_backup_changes_if_any()
    
    # 4. 提交
    print(f"\n✅ 提交: \"{message}\"...")
    commit_result = run_cmd(["git", "commit", "-m", message], check=False, capture_output=True)
    if commit_result.returncode != 0:
        stderr = (commit_result.stderr or "").strip()
        stdout = (commit_result.stdout or "").strip()
        combined_output = f"{stdout}\n{stderr}".strip()

        if "nothing to commit" in combined_output.lower() or "no changes added to commit" in combined_output.lower():
            print("ℹ️  无新改动")
            return

        print("❌ 提交失败")
        print(combined_output)
        sys.exit(1)

    if commit_result.stdout:
        print(commit_result.stdout.strip())
    
    # 5. 推送到远程
    print("\n✅ 推送到 GitHub...")
    
    # 检查是否有上游分支
    branch_result = run_cmd(["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], 
                           check=False, capture_output=True)
    
    if branch_result.returncode != 0:
        # 没有上游分支，需要设置
        current_branch_result = run_cmd(["git", "rev-parse", "--abbrev-ref", "HEAD"], 
                                       check=False, capture_output=True)
        current_branch = (current_branch_result.stdout or "").strip()
        
        if current_branch:
            print(f"ℹ️  首次推送 '{current_branch}' 分支，正在设置上游...")
            run_cmd(["git", "push", "-u", "origin", current_branch])
        else:
            run_cmd(["git", "push"])
    else:
        # 有上游分支，推送（远端领先时自动 rebase 后重试）
        current_branch_result = run_cmd(["git", "rev-parse", "--abbrev-ref", "HEAD"],
                                       check=False, capture_output=True)
        current_branch = (current_branch_result.stdout or "").strip()
        if not current_branch:
            print("❌ 无法识别当前分支")
            sys.exit(1)

        if not push_with_auto_rebase(current_branch):
            sys.exit(1)
    
    elapsed = time.time() - start_time
    print("\n" + "="*50)
    print(f"🎉 成功！耗时 {elapsed:.1f} 秒")
    print("📡 Vercel 会自动检测更新并开始部署")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
