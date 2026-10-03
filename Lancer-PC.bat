@echo off
cd /d "%~dp0"
py -3 serve-pc.py
if errorlevel 1 pause
