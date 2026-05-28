@echo off
title Job Search Copilot
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-copilot.ps1"
pause
