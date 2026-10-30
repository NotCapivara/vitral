@echo off
rem Esconde a barra "Vitral | Personalizar o Brave" do rodape da nova guia (rode com o Brave fechado)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0esconder-rodape-brave.ps1"
