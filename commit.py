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
    status_result = run_cmd(["git", "status", "--short"], check=False, capture_output=True)
    
    status_output = (status_result.stdout or "").strip()
    if not status_output:
        print("ℹ️  没有待提交的改动")
        return

    print(f"📊 检测到 {len(status_output.splitlines())} 个文件变化")

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
        # 有上游分支，正常推送
        push_result = run_cmd(["git", "push"], check=False, capture_output=True)
        
        if push_result.returncode != 0:
            stderr = (push_result.stderr or "").strip()
            stdout = (push_result.stdout or "").strip()
            combined_output = f"{stdout}\n{stderr}".strip()
            
            print("❌ 推送失败")
            print(combined_output)
            
            if "authentication" in combined_output.lower() or "permission" in combined_output.lower():
                print("\n💡 提示：请检查 GitHub 凭证（SSH key 或 Personal Access Token）")
            
            sys.exit(1)
        
        if push_result.stdout:
            print(push_result.stdout.strip())
    
    elapsed = time.time() - start_time
    print("\n" + "="*50)
    print(f"🎉 成功！耗时 {elapsed:.1f} 秒")
    print("📡 Vercel 会自动检测更新并开始部署")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
