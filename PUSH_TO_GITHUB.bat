@echo off
color 0A
title TrendingVerse — Push to GitHub

echo.
echo ============================================
echo   TrendingVerse — Auto GitHub Push Tool
echo ============================================
echo.

:: Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Git is not installed!
    echo.
    echo Please download and install Git from:
    echo https://git-scm.com/download/win
    echo.
    echo After installing, run this file again.
    pause
    exit
)

echo [1/6] Git found. Continuing...
echo.

:: Ask for GitHub repo URL
echo Please enter your GitHub repository URL
echo Example: https://github.com/yusufkhanhs/trendingverse.git
echo.
set /p REPO_URL="Paste your GitHub repo URL here: "
echo.

:: Ask for GitHub username
set /p GIT_NAME="Enter your full name (e.g. Yusuf Khan): "
set /p GIT_EMAIL="Enter your GitHub email: "
echo.

:: Configure git
git config --global user.name "%GIT_NAME%"
git config --global user.email "%GIT_EMAIL%"

echo [2/6] Initializing Git repository...
git init
echo.

echo [3/6] Adding all project files...
git add .
echo.

echo [4/6] Creating first commit...
git commit -m "Initial TrendingVerse deployment"
echo.

echo [5/6] Connecting to GitHub...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git branch -M main
echo.

echo [6/6] Pushing to GitHub...
echo.
echo NOTE: A browser window may open asking you to sign in to GitHub.
echo      If it asks for password — use your Personal Access Token, not your password.
echo.
git push -u origin main

echo.
if %errorlevel% equ 0 (
    color 0A
    echo ============================================
    echo   SUCCESS! Code pushed to GitHub!
    echo ============================================
    echo.
    echo Now go to Vercel:
    echo 1. Visit https://vercel.com
    echo 2. Click "Add New Project"
    echo 3. Import your trendingverse repo
    echo 4. Add your environment variables
    echo 5. Deploy!
    echo.
) else (
    color 0C
    echo ============================================
    echo   PUSH FAILED
    echo ============================================
    echo.
    echo Common fixes:
    echo.
    echo 1. Make sure your GitHub repo is EMPTY
    echo    (no README, no files at all)
    echo.
    echo 2. If asked for password — use a Personal
    echo    Access Token, not your GitHub password.
    echo    Get one at: github.com/settings/tokens
    echo    Check the "repo" checkbox when creating it.
    echo.
    echo 3. Make sure the repo URL is correct
    echo    It should end with .git
    echo.
    echo Run this file again after fixing the issue.
    echo.
)

pause
