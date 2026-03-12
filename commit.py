#!/usr/bin/env python3
"""
一键提交脚本 - 自动化 git 工作流
使用: python commit.py "commit message"
或者: python commit.py （使用默认消息）
"""

import subprocess
import sys
import datetime

def run_cmd(cmd, check=True):
    """执行命令"""
    print(f"🚀 {cmd}")
    result = subprocess.run(cmd, shell=True, text=True)
    if check and result.returncode != 0:
        print(f"❌ 命令执行失败")
        sys.exit(1)
    return result.returncode == 0

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
    run_cmd("git status", check=False)
    
    # 2. 添加所有改动
    print("\n✅ 添加文件...")
    run_cmd("git add .")
    
    # 3. 提交
    print(f"\n✅ 提交: \"{message}\"...")
    if not run_cmd(f'git commit -m "{message}"', check=False):
        print("ℹ️  无新改动")
        return
    
    # 4. 推送到远程
    print("\n✅ 推送到 GitHub...")
    run_cmd("git push")
    
    print("\n" + "="*50)
    print("🎉 提交成功！Vercel 会自动部署")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
