@echo off
set "USER_PATH="
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%b"
if not defined USER_PATH (
    reg add "HKCU\Environment" /v Path /t REG_EXPAND_SZ /d "C:\nodejs20;" /f
) else (
    echo %USER_PATH% | find /i "C:\nodejs20" >nul
    if errorlevel 1 (
        reg add "HKCU\Environment" /v Path /t REG_EXPAND_SZ /d "C:\nodejs20;%USER_PATH%" /f
        echo Added C:\nodejs20 to User PATH.
    ) else (
        echo C:\nodejs20 already in User PATH.
    )
)
