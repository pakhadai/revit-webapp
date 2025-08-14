@echo off
REM run.bat - Запуск RevitBot з одним ngrok

echo 🚀 Запуск RevitBot...
echo.

echo 📦 Запуск Backend сервера на порті 8001...
cd backend
start /B uvicorn main:app --reload --port 8001

echo ✅ Backend запущено
echo.

timeout /t 3 /nobreak > nul

echo 🌐 Тепер запустіть ngrok в новому терміналі:
echo.
echo    ngrok http 8001
echo.
echo 📱 Потім встановіть URL в Telegram Bot:
echo    https://f8da633a450c.ngrok-free.app/telegram
echo.
echo Для зупинки закрийте це вікно

pause