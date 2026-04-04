@echo off
echo [1/4] 기존 잘못된 .git 폴더 삭제 중...
rmdir /s /q "E:\apps\.git" 2>nul
rmdir /s /q ".git" 2>nul

echo [2/4] Git 새로 초기화 및 원격 저장소 연결...
git init
git remote add origin https://github.com/antny-bot/featureMatrix-Server.git
git branch -M main

echo [3/4] 파일 추가 및 첫 커밋...
git add .
git commit -m "Initialize project and add .gitignore"

echo [4/4] GitHub으로 강제 푸시 진행...
git push -u origin main --force

echo 모든 Git 세팅이 완료되었습니다!