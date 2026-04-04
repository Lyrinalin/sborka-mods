@echo off
echo === Обновление модов в репозитории ===

echo 1. Копирование нового StickerChat...
copy /Y "..\moda\stickerchat\build\libs\stickerchat-1.0.0.jar" "mods\stickerchat-1.0.0.jar"

echo 2. Проверка файлов...
dir /B server-mods\*.jar
dir /B mods\*.jar

echo 3. Генерация манифестов...
node update-manifest.js

echo === Готово ===
