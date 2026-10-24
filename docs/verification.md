# Проверка черновика

Автоматические регрессии: FB2 с namespace, порядок глав EPUB, inline-форматирование и сноски; повреждённый XML/DTD; вредоносная разметка и внешние ресурсы; ZIP/размеры; символьные якоря; объединение и удаление закладок; устаревшая позиция устройства.

Ключевой ручной сценарий: импорт → открыть → перелистнуть → увеличить шрифт и поля → проверить текст страниц → закладка → библиотека → перезагрузка → продолжить. Облачный сценарий: войти одним аккаунтом на двух устройствах, загрузить книгу, изменить настройки/закладку, синхронизировать; активная страница другого устройства не должна перескакивать.

Статическая защита от автоувеличения: viewport initial-scale=1 без maximum-scale/user-scalable=no, computed font-size всех полей >=16px. Мобильный iframe проверяет вёрстку, но не поведение Safari на настоящем iPhone.

Проверки доступа: API без доверенной идентификации возвращает 401; namespace облачного хранилища выводится на сервере из Site user ID; клиент не выбирает пользователя. Запись — только same-origin, ограничения размера, SHA-256, ETag.

Supabase / GitHub Pages: 16 automated tests, type checking and Pages build pass. The new tests cover authentication required for cloud calls, rejected book identifiers, and no metadata writes after upload failure. Production RLS was checked inside a rolled-back transaction: the owner could write and read two device settings records, another identity could not read them or a storage object, and cross-owner writes were rejected. The kniga-books bucket is private with a 20 MB file limit. Production dependency audit: 0 reported vulnerabilities. Existing project advisor warns that leaked-password protection is disabled; unrelated authentication settings were preserved. An authenticated browser round-trip still requires signing in to Supabase.

Library refresh: 18 tests and type checking pass, Pages build succeeds. Browser QA on a 390 px iframe and a 320 px iframe: library, dark/light toggle, theme retained after reload, library search match/no-match, reading continuation, appearance sheet, legacy font 36 px and margins retained. Computed paragraph margin-bottom is 0 px after migration. At 320 px host width, content clientWidth=305 and scrollWidth=305, header buttons are 44 px high, and checked inputs are 16 px. Real Safari autofocus behavior was not tested. No authentication, storage or database policies changed in this UI update.
