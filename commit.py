#!/usr/bin/env python3
"""
一键提交脚本 - 自动化 git 工作流
使用: python commit.py "commit message"
或者: python commit.py （使用默认消息）
"""

import subprocess
import sys
import datetime

DEFAULT_GIT_NAME = "Jo-Nan"
DEFAULT_GIT_EMAIL = "nanqiao.ai@gmail.com"

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

def main():
    # 获取提交信息
    if len(sys.argv) > 1:
        message = sys.argv[1]
    else:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        message = f"update: {timestamp}"
    
    print("\n" + "="*50)
    print("📝 一键提交")
    print("="*50)
    
    # 1. 检查 git 状态
    print("\n✅ 检查 Git 状态...")
    run_cmd(["git", "status"], check=False)

    # 2. 确保 Git 身份正确
    ensure_git_identity()
    
    # 3. 添加所有改动
    print("\n✅ 添加文件...")
    run_cmd(["git", "add", "."])
    
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
        if combined_output:
            print(combined_output)
        sys.exit(1)

    if commit_result.stdout:
        print(commit_result.stdout.strip())
    
    # 5. 推送到远程
    print("\n✅ 推送到 GitHub...")
    run_cmd(["git", "push"])
    
    print("\n" + "="*50)
    print("🎉 提交成功！Vercel 会自动部署")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
