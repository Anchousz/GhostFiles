# Как получить готовый Windows `.exe` через GitHub Actions

Этот проект содержит workflow `.github/workflows/build-windows.yml`. Он выполняет сборку на настоящем Windows runner GitHub Actions, поэтому локально устанавливать Wine не нужно.

## Первый запуск

1. Создайте пустой репозиторий на GitHub (например, `GHOST_FILES`).
2. Распакуйте архив проекта и откройте PowerShell в папке `GHOST_FILES`.
3. Выполните команды, подставив свой URL репозитория:

```powershell
git init -b main
git add .
git commit -m "GHOST_FILES 1.0.1"
git remote add origin https://github.com/ВАШ_ЛОГИН/GHOST_FILES.git
git push -u origin main
```

## Скачать готовую сборку

1. Откройте репозиторий на GitHub.
2. Перейдите во вкладку **Actions**.
3. Откройте последний запуск **Build Windows installer**.
4. Дождитесь успешного завершения всех шагов.
5. В блоке **Artifacts** скачайте `GHOST_FILES-Windows-x64`.
6. Распакуйте скачанный артефакт. Установщик будет находиться внутри `dist` и иметь расширение `.exe`.

Workflow запускается автоматически после push в `main`. Его также можно запустить вручную: Actions → Build Windows installer → Run workflow.

## Важно

- Артефакт Actions временный и хранится 14 дней.
- Для постоянной публикации создайте GitHub Release и приложите `.exe` к релизу.
- Установщик пока не подписан цифровым сертификатом, поэтому Windows SmartScreen может показывать предупреждение. Не отключайте защиту Windows; публикуйте сборки только из собственного репозитория и проверяйте контрольную сумму файла.
- Сам workflow нужно отправить в GitHub вместе с исходниками. Он не создаёт установщик до push/ручного запуска в GitHub Actions.
