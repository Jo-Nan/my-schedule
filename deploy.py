import os
import subprocess
import json
import sys
import re

def run_cmd(cmd, check=True):
    print(f"🚀 Running: {cmd}")
    result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    if check and result.returncode != 0:
        print(f"❌ Error executing: {cmd}")
        print(result.stderr)
        sys.exit(1)
    return result.stdout.strip()

def setup_github_pages(repo_url):
    # Extract username and repo name from the url
    # e.g., https://github.com/muzinan/nanmuz-schedule.git or git@github.com:muzinan/nanmuz-schedule.git
    match = re.search(r'github\.com[:/]([^/]+)/([^/.]+)(?:\.git)?', repo_url)
    if not match:
        print("❌ Invalid GitHub URL format. Example: https://github.com/username/repo-name.git or git@github.com:username/repo-name.git")
        sys.exit(1)
        
    username, repo_name = match.groups()
    base_path = f"/{repo_name}/"
    
    print(f"📦 Detected repository: {username}/{repo_name}")
    print(f"🌐 Base path will be configured as: {base_path}")

    # 1. Update vite.config.js with the base path
    vite_cfg = "vite.config.js"
    if os.path.exists(vite_cfg):
        with open(vite_cfg, 'r') as f:
            content = f.read()
            
        if "base:" not in content:
            # Inject base path into defineConfig
            content = content.replace('defineConfig({', f"defineConfig({{\n  base: '{base_path}',")
            with open(vite_cfg, 'w') as f:
                f.write(content)
            print("✅ Updated vite.config.js with base path.")
        else:
            print("ℹ️ vite.config.js already contains a base path. Ensure it matches your repo name.")
    else:
        print("❌ vite.config.js not found in current directory.")
        sys.exit(1)

    # 2. Create the GitHub Actions Workflow
    workflow_dir = ".github/workflows"
    os.makedirs(workflow_dir, exist_ok=True)
    
    workflow_content = """name: Deploy static content to Pages

on:
  push:
    branches: ['main']

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
"""
    with open(f"{workflow_dir}/deploy.yml", 'w') as f:
        f.write(workflow_content)
    print("✅ Created GitHub Actions workflow at .github/workflows/deploy.yml")

    # 3. Git Operations
    status_check = subprocess.run("git status", shell=True, capture_output=True)
    if status_check.returncode != 0:
        run_cmd("git init")
        print("✅ Initialized empty Git repository.")

    # Check/Set Default Branch to main
    run_cmd("git branch -m main", check=False) # Rename current if it's master

    # Check Remotes
    remotes = run_cmd("git remote -v", check=False)
    if "origin" in remotes:
        run_cmd("git remote remove origin")
    run_cmd(f"git remote add origin {repo_url}")
    print(f"✅ Set remote origin to {repo_url}")

    # Commit and Push
    print("⏳ Adding files to commit...")
    run_cmd("git add .")
    
    commit_check = subprocess.run('git commit -m "Auto-deploy: GitHub Pages setup"', shell=True, capture_output=True)
    if commit_check.returncode == 0:
        print("✅ Committed changes.")
    else:
        print("ℹ️ No changes to commit.")

    print("🚀 Pushing to GitHub (this might ask for credentials)...")
    push_result = subprocess.run("git push -u origin main", shell=True)
    
    if push_result.returncode == 0:
        print("\n🎉🎉🎉 DEPLOYMENT AUTOMATION COMPLETE 🎉🎉🎉")
        print("Follow these steps on GitHub to finish:")
        print("1. Go to your repository settings on GitHub.")
        print("2. Click 'Pages' on the left sidebar.")
        print("3. Under 'Build and deployment', set the Source to 'GitHub Actions'.")
        print(f"Your site will be live soon at: https://{username}.github.io/{repo_name}/")
    else:
        print("\n❌ Failed to push. Ensure your GitHub Personal Access Token or SSH keys are properly configured.")

if __name__ == "__main__":
    print("\n=== NanMuZ Schedule Deploy Automation ===")
    print("Please make sure you have created an empty repository on GitHub first.")
    repo = input("Enter your GitHub repository URL (e.g., https://github.com/muzinan/schedule.git): ").strip()
    
    if not repo:
        print("❌ URL cannot be empty. Aborting.")
        sys.exit(1)
        
    setup_github_pages(repo)
