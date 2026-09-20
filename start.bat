@echo off
title Grid-Guard AI - On-Premise SCADA Gateway
echo ========================================================
echo   GRID-GUARD AI: Pano ve Hucre Ici Anomali Erken Uyari
echo   ADM ^& GDZ Elektrik Hackathon - On-Premise Edge Gateway
echo ========================================================
echo.

:: Check python
python --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Python bulunamadi! Lutfen Python 3.9+ yukleyiniz.
    pause
    exit /b 1
)

:: Install requirements
echo [1/2] Bagimliliklar kontrol ediliyor...
python -m pip install -r requirements.txt --quiet

:: Start Gateway server
echo [2/2] Grid-Guard AI SCADA Gateway baslatiliyor...
echo.
echo  - SCADA Web Dashboard : http://localhost:8000 (veya Yerel Ag IP:8000)
echo  - Modbus RTU / TCP    : Active (19200 8E1)
echo  - Zero-Cloud Modu     : AKTIF (Internet Baglantisi Gerekmez)
echo.
echo Cikis icin CTRL+C tusuna basiniz.
echo ========================================================
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
pause
