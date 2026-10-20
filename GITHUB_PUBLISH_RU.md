# Как опубликовать GHOST_FILES на GitHub

Инструкция для Windows и PowerShell. Предполагается, что у вас уже есть папка проекта GHOST_FILES с файлами `main.js`, `renderer.js`, `package.json` и `README.md`.

## 1. Подготовьте инструменты

Установите:

- **Git for Windows**: https://git-scm.com/download/win
- **Node.js 22.12.0 или новее**: https://nodejs.org/
- Аккаунт GitHub: https://github.com/

Откройте PowerShell в папке проекта. Например, в Проводнике откройте папку `GHOST_FILES`, щёлкните правой кнопкой мыши по свободному месту и выберите открытие терминала.

Проверьте, что программы установлены:

```powershell
git --version
node --version
npm --version
```

## 2. Проверьте проект перед публикацией

Выполните из корня проекта:

```powershell
npm install
npm test
npm run check
```

`npm install` создаст `package-lock.json`, если его ещё нет. **Добавьте `package-lock.json` в репозиторий**: он фиксирует версии зависимостей для повторяемой установки. Не добавляйте в Git папки `node_modules` и `dist` — они уже исключены в `.gitignore`.

Проверьте состав файлов перед отправкой:

```powershell
git status --short
```

Убедитесь, что в проект не попали пользовательские документы, тестовые данные, логи, личные настройки, токены или пароли.

## 3. Создайте пустой репозиторий на GitHub

1. Откройте https://github.com/new.
2. В поле **Repository name** введите `GHOST_FILES`.
3. Выберите **Public**, если хотите открытый проект, или **Private**, если репозиторий должен быть доступен только вам и приглашённым участникам.
4. По желанию заполните Description, например: `Compact retro-terminal file manager for Windows, built with Electron`.
5. На странице создания репозитория **не включайте** `Add a README file`, `.gitignore` и License: они уже есть в локальном проекте.
6. Нажмите **Create repository**.

После создания GitHub покажет адрес репозитория примерно такого вида:

```text
https://github.com/YOUR_USERNAME/GHOST_FILES.git
```

Скопируйте свой реальный адрес — он понадобится ниже.

## 4. Создайте локальный Git-репозиторий и отправьте проект

Убедитесь, что PowerShell открыт именно в папке `GHOST_FILES`, затем выполните команды по порядку:

```powershell
git init -b main
git add .
git status
git commit -m "Initial release of GHOST_FILES"
git remote add origin https://github.com/YOUR_USERNAME/GHOST_FILES.git
git push -u origin main
```

В команде `git remote add origin` замените `YOUR_USERNAME` на свой GitHub-логин. Если вы назвали репозиторий иначе, замените и `GHOST_FILES`.

При первой отправке GitHub может открыть страницу авторизации в браузере. Войдите в свой аккаунт и подтвердите доступ. Не вставляйте пароль GitHub в команды терминала и никогда не публикуйте Personal Access Token в файлах проекта.

После успешного `git push` обновите страницу репозитория на GitHub — файлы проекта должны появиться там. Главный `README.md` отобразится на главной странице автоматически.

## 5. Как отправлять обновления в дальнейшем

После того как вы изменили код, откройте PowerShell в папке проекта и выполните:

```powershell
npm test
npm run check
git status
git add .
git commit -m "Describe your changes"
git push
```

Вместо `Describe your changes` укажите короткое описание, например:

```powershell
git commit -m "Fix taskbar thumbnail and tray icon"
```

Если `git status` показывает `node_modules`, `dist`, логи или пользовательские файлы, остановитесь и проверьте `.gitignore` и список добавляемых файлов до `git push`.

## 6. Как опубликовать установщик в GitHub Releases

Рекомендуется хранить исходный код в репозитории, а готовые `.exe` — во вкладке **Releases**.

1. На Windows выполните сборку:

   ```powershell
   npm install
   npm test
   npm run check
   npm run build
   ```

2. Найдите установщик в каталоге `dist/`.
3. Откройте репозиторий на GitHub и выберите **Releases** → **Create a new release**.
4. Создайте тег, например `v1.0.1`. Для следующего релиза используйте следующий номер версии.
5. Введите заголовок релиза, например `GHOST_FILES 1.0.1`.
6. Добавьте описание изменений из `CHANGELOG.md`.
7. Перетащите установщик `.exe` из `dist/` в область прикрепления файлов.
8. Нажмите **Publish release**.

Папка `dist/` исключена из Git, поэтому установщик не попадёт в обычные коммиты — это ожидаемо. Загружайте его к релизу вручную.

## 7. Если GitHub отклоняет push

### `remote origin already exists`

Такой remote уже настроен. Посмотрите адрес:

```powershell
git remote -v
```

Чтобы заменить его своим адресом:

```powershell
git remote set-url origin https://github.com/YOUR_USERNAME/GHOST_FILES.git
```

Затем повторите:

```powershell
git push -u origin main
```

### `src refspec main does not match any`

Обычно ещё нет первого коммита. Выполните:

```powershell
git add .
git commit -m "Initial commit"
git push -u origin main
```

### `rejected` или `fetch first`

Чаще всего удалённый репозиторий был создан не пустым (например, GitHub добавил README). Самый простой вариант для нового проекта — создать новый пустой репозиторий без README, `.gitignore` и License. Не используйте `git push --force`, если не уверены, что понимаете последствия: эта команда может перезаписать историю удалённого репозитория.

## 8. Короткая проверка перед публичным релизом

- [ ] `npm test` проходит без ошибок.
- [ ] `npm run check` проходит без ошибок.
- [ ] На Windows проверены установка и запуск собранного `.exe`.
- [ ] Проверены значок в системном трее и его меню.
- [ ] Проверена кнопка GHOST_FILES на панели задач и миниатюра при наведении.
- [ ] Проверены сворачивание, раскрытие и глобальная горячая клавиша.
- [ ] Проверены копирование, перемещение, переименование и удаление файлов на тестовых данных.
- [ ] README, версия и CHANGELOG соответствуют фактической сборке.
- [ ] В репозитории нет личных файлов, секретов, токенов и пользовательских настроек.
- [ ] Установщик приложен к GitHub Release, а не добавлен в исходный Git-коммит.

**Совет:** перед публичной публикацией используйте отдельную тестовую папку с копиями файлов. Не проверяйте файловые операции на единственном экземпляре важных документов.
