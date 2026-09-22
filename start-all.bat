@echo off
setlocal enabledelayedexpansion

:: Ensure Node 20 is on PATH
set "PATH=C:\nodejs20;%PATH%"

echo ========================================================
echo   Threshold Blind-Signature E-Voting -- All-in-One Launcher
echo ========================================================
echo.

:: 1. Keygen if shares do not exist
if not exist "registrar-service\shares\public.json" (
    echo [1/5] Generating 2-of-3 threshold RSA keys and shares...
    call node registrar-service\keygen.js
) else (
    echo [1/5] Registrar key shares already generated.
)

:: 2. Compile contracts
echo [2/5] Compiling contracts...
call npx hardhat compile

:: 3. Start Hardhat local node
echo [3/5] Starting Hardhat blockchain node on port 8545...
start "1. Hardhat Node (Port 8545)" cmd /k "title Hardhat Node && set PATH=C:\nodejs20;!PATH! && npx hardhat node"

:: Give the node 4 seconds to spin up
echo Waiting 4 seconds for local blockchain node...
timeout /t 4 /nobreak >nul

:: 4. Deploy contracts to local node
echo [4/5] Deploying contracts and setting up candidate slate...
call npx hardhat run scripts\deploy.js --network localhost

:: 5. Launch Registrars, Backend, and Frontend
echo [5/5] Launching Registrars 1, 2, 3, Backend API, and Frontend...
start "2. Registrar 1 (Port 3001)" cmd /k "title Registrar 1 && set PATH=C:\nodejs20;!PATH! && set REGISTRAR_ID=1 && node registrar-service\registrar.js"
start "3. Registrar 2 (Port 3002)" cmd /k "title Registrar 2 && set PATH=C:\nodejs20;!PATH! && set REGISTRAR_ID=2 && node registrar-service\registrar.js"
start "4. Registrar 3 (Port 3003)" cmd /k "title Registrar 3 && set PATH=C:\nodejs20;!PATH! && set REGISTRAR_ID=3 && node registrar-service\registrar.js"
start "5. Backend API (Port 3000)" cmd /k "title Backend API && set PATH=C:\nodejs20;!PATH! && node web\backend\server.js"
start "6. Web Frontend (Port 5173)" cmd /k "title Web Frontend && set PATH=C:\nodejs20;!PATH! && cd web\frontend && npm run dev"

echo.
echo ========================================================
echo   All services launched!
echo   Open your browser at: http://localhost:5173
echo ========================================================
echo.
pause
