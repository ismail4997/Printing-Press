@echo off
title Push Printing Press to GitHub
color 0A
echo ============================================================
echo   Pushing Printing Press App to GitHub: ismail4997
echo ============================================================
echo.
"C:\Users\ismai\AppData\Local\Programs\Git\cmd\git.exe" push -u origin main
echo.
echo ============================================================
if %ERRORLEVEL% equ 0 (
    echo   SUCCESS! All files have been uploaded to GitHub.
) else (
    echo   NOTE: If you saw an error or sign-in prompt above,
    echo   please check your GitHub login in the browser window.
)
echo ============================================================
echo.
pause
