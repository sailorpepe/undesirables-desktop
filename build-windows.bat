@echo off
:: ================================================================
:: The Undesirables — Windows Build Script v2
:: Drop this file on any Windows 10/11 PC and RIGHT-CLICK > Run as Administrator.
:: It will install all dependencies and produce the .msi installer.
:: ================================================================

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║   THE UNDESIRABLES — WINDOWS BUILD v2           ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: Check for winget (comes pre-installed on Windows 10 1709+)
where winget >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] winget not found. Please update Windows or install App Installer from the Microsoft Store.
    pause
    exit /b 1
)

:: Step 1: Install dependencies via winget
echo [1/7] Installing Rust...
winget install --id Rustlang.Rustup --accept-source-agreements --accept-package-agreements -e
call "%USERPROFILE%\.cargo\env.bat" 2>nul
:: Pin Rust 1.88 — dependencies require it (1.85 "stable" is too old)
rustup install 1.88.0
rustup default 1.88.0

echo [2/7] Installing Node.js 20...
winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements -e

echo [3/7] Installing Python 3.13...
winget install --id Python.Python.3.13 --accept-source-agreements --accept-package-agreements -e

echo [4/7] Installing Git...
winget install --id Git.Git --accept-source-agreements --accept-package-agreements -e

:: Refresh PATH
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
set PATH=%PROGRAMFILES%\nodejs;%PATH%
set PATH=%LOCALAPPDATA%\Programs\Python\Python313;%PATH%
set PATH=%LOCALAPPDATA%\Programs\Python\Python313\Scripts;%PATH%
set PATH=%PROGRAMFILES%\Git\bin;%PATH%

:: Step 2: Clone (or pull latest) repos
echo [5/7] Cloning repositories...
cd %USERPROFILE%\Desktop
if not exist undesirables-build mkdir undesirables-build
cd undesirables-build

:: If repos already exist, pull latest instead of skipping
if exist undesirables-mcp-server (
    echo   Updating MCP server...
    cd undesirables-mcp-server
    git pull origin main
    cd ..
) else (
    git clone https://gitlab.com/meme-merchants/undesirables-mcp-server.git
)

if exist undesirables-desktop (
    echo   Updating desktop app...
    cd undesirables-desktop
    git pull origin main
    cd ..
) else (
    git clone https://gitlab.com/meme-merchants/undesirables-desktop.git
)

:: Step 3: Compile MCP server to native binaries
echo [6/7] Compiling AI engines to native Windows binaries...
cd undesirables-mcp-server
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
mkdir ..\undesirables-desktop\src-tauri\mcp-dist 2>nul
copy *.pyd ..\undesirables-desktop\src-tauri\mcp-dist\ 2>nul
copy *.pyi ..\undesirables-desktop\src-tauri\mcp-dist\ 2>nul
copy execute_tool.py ..\undesirables-desktop\src-tauri\mcp-dist\
copy boot_server.py ..\undesirables-desktop\src-tauri\mcp-dist\
copy boot_3d.py ..\undesirables-desktop\src-tauri\mcp-dist\
copy requirements.txt ..\undesirables-desktop\src-tauri\mcp-dist\
copy pyproject.toml ..\undesirables-desktop\src-tauri\mcp-dist\
xcopy /E /I /Y data ..\undesirables-desktop\src-tauri\mcp-dist\data 2>nul
xcopy /E /I /Y characters ..\undesirables-desktop\src-tauri\mcp-dist\characters 2>nul
xcopy /E /I /Y scripts ..\undesirables-desktop\src-tauri\mcp-dist\scripts 2>nul

call deactivate
cd ..

:: Step 4: Clean Rust build cache to prevent stale artifacts
echo [7/7] Building The Undesirables desktop app...
cd undesirables-desktop
echo   Cleaning previous Rust build cache...
if exist src-tauri\target\release\bundle\msi rmdir /s /q src-tauri\target\release\bundle\msi
call npm install
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
    echo  ║  Common fix: close this window and try again.   ║
    echo  ╚══════════════════════════════════════════════════╝
    echo.
)

pause
