@echo off
:: ================================================================
:: The Undesirables — Windows Build Script v3
:: Drop this file on any Windows 10/11 PC and RIGHT-CLICK > Run as Administrator.
:: It will install all dependencies and produce the .msi installer.
:: ================================================================

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║   THE UNDESIRABLES — WINDOWS BUILD v3           ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: ================================================================
:: FIX: Enable Windows Long Paths (fixes ENOENT in deep node_modules)
:: This is the #1 cause of build failures on Windows.
:: ================================================================
echo [0/8] Enabling Windows long path support...
reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f >nul 2>&1

:: Check for winget (comes pre-installed on Windows 10 1709+)
where winget >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] winget not found. Please update Windows or install App Installer from the Microsoft Store.
    pause
    exit /b 1
)

:: Step 1: Install dependencies via winget
echo [1/8] Installing Rust...
winget install --id Rustlang.Rustup --accept-source-agreements --accept-package-agreements -e
call "%USERPROFILE%\.cargo\env.bat" 2>nul
:: Pin Rust 1.88 — dependencies require it (1.85 "stable" is too old)
rustup install 1.88.0
rustup default 1.88.0

echo [2/8] Installing Node.js 20...
winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements -e

echo [3/8] Installing Python 3.13...
winget install --id Python.Python.3.13 --accept-source-agreements --accept-package-agreements -e

echo [4/8] Installing Git...
winget install --id Git.Git --accept-source-agreements --accept-package-agreements -e

:: Refresh PATH
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
set PATH=%PROGRAMFILES%\nodejs;%PATH%
set PATH=%LOCALAPPDATA%\Programs\Python\Python313;%PATH%
set PATH=%LOCALAPPDATA%\Programs\Python\Python313\Scripts;%PATH%
set PATH=%PROGRAMFILES%\Git\bin;%PATH%

:: ================================================================
:: FIX: Use short build path to avoid Windows MAX_PATH (260 char) limit
:: Desktop\undesirables-build\undesirables-desktop\node_modules\...
:: is too deep. Using D:\undsr-build\ instead.
:: ================================================================
echo [5/8] Setting up build directory...

:: Try D: first (common secondary drive), fall back to C:\undsr-build
if exist D:\ (
    set BUILD_ROOT=D:\undsr-build
) else (
    set BUILD_ROOT=C:\undsr-build
)

if not exist %BUILD_ROOT% mkdir %BUILD_ROOT%
cd /d %BUILD_ROOT%

:: Clone or pull repos
if exist mcp-server (
    echo   Updating MCP server...
    cd mcp-server
    git pull origin main
    cd ..
) else (
    git clone https://gitlab.com/meme-merchants/undesirables-mcp-server.git mcp-server
)

if exist desktop (
    echo   Updating desktop app...
    cd desktop
    git pull origin main
    cd ..
) else (
    git clone https://gitlab.com/meme-merchants/undesirables-desktop.git desktop
)

:: Step 3: Compile MCP server to native binaries
echo [6/8] Compiling AI engines to native Windows binaries...
cd mcp-server
python -m venv .venv
call .venv\Scripts\activate.bat
pip install --upgrade pip
pip install nuitka ordered-set
pip install -r requirements.txt

:: Compile each module with Nuitka
for %%f in (server executor security ebay_oracle emotion_engine memory_graph rag_engine tcg_oracle three_d_engine voice_engine run_3d run_bark) do (
    if exist %%f.py (
        echo   Compiling %%f.py...
        python -m nuitka --module %%f.py --output-dir=. 2>nul
    )
)

:: Assemble mcp-dist
mkdir ..\desktop\src-tauri\mcp-dist 2>nul
copy *.pyd ..\desktop\src-tauri\mcp-dist\ 2>nul
copy *.pyi ..\desktop\src-tauri\mcp-dist\ 2>nul
copy execute_tool.py ..\desktop\src-tauri\mcp-dist\
copy boot_server.py ..\desktop\src-tauri\mcp-dist\
copy boot_3d.py ..\desktop\src-tauri\mcp-dist\
copy requirements.txt ..\desktop\src-tauri\mcp-dist\
copy pyproject.toml ..\desktop\src-tauri\mcp-dist\
xcopy /E /I /Y data ..\desktop\src-tauri\mcp-dist\data 2>nul
xcopy /E /I /Y characters ..\desktop\src-tauri\mcp-dist\characters 2>nul
xcopy /E /I /Y scripts ..\desktop\src-tauri\mcp-dist\scripts 2>nul

call deactivate
cd ..

:: Step 4: Build the Tauri desktop app
echo [7/8] Building The Undesirables desktop app...
cd desktop

:: Clean stale build artifacts
echo   Cleaning previous build cache...
if exist src-tauri\target\release\bundle\msi rmdir /s /q src-tauri\target\release\bundle\msi

:: FIX: Clean node_modules to prevent stale/corrupt installs
echo   Cleaning node_modules for fresh install...
if exist node_modules rmdir /s /q node_modules
call npm cache clean --force 2>nul

:: Install and build
echo   Running npm install...
call npm install

:: Verify tauri CLI exists before building
if not exist node_modules\.bin\tauri.cmd (
    echo [ERROR] Tauri CLI not found after npm install.
    echo   Attempting direct install...
    call npm install @tauri-apps/cli
)

echo [8/8] Running Tauri build (this takes ~10-15 minutes)...
call npx tauri build

:: Check if MSI was actually created
if exist src-tauri\target\release\bundle\msi\*.msi (
    echo.
    echo  ╔══════════════════════════════════════════════════╗
    echo  ║              BUILD COMPLETE!                     ║
    echo  ╠══════════════════════════════════════════════════╣
    echo  ║  Your .msi installer is ready.                  ║
    echo  ║  Opening the folder now...                      ║
    echo  ╚══════════════════════════════════════════════════╝
    echo.
    explorer src-tauri\target\release\bundle\msi
) else (
    echo.
    echo  ╔══════════════════════════════════════════════════╗
    echo  ║              BUILD FAILED                       ║
    echo  ╠══════════════════════════════════════════════════╣
    echo  ║  The .msi was not created.                      ║
    echo  ║  Scroll up to see the error message.            ║
    echo  ║                                                  ║
    echo  ║  Common fixes:                                  ║
    echo  ║  1. Close this window and run again             ║  
    echo  ║  2. Reboot and run as Administrator             ║
    echo  ║  3. Check if antivirus blocked the build        ║
    echo  ╚══════════════════════════════════════════════════╝
    echo.
)

pause

