Фоны КП (public/branding/kp), подключаются как /branding/kp/<имя>.

В репозитории по умолчанию:
- kp-1str.png — первая страница А4
- kp-2str.png — вторая и следующие страницы

Чтобы использовать свои файлы с именами вроде КП_СпортИН-ЮГ_стр1.png:
  положите их сюда и поменяйте KP_PAGE1_BACKGROUND / KP_PAGE2_BACKGROUND
  в crm-web/libs/kp-feature/.../kp-document-template.component.ts
  (для кириллицы в URL используйте encodeURIComponent в коде или латинские имена файлов).

Загрузка своего фона из конструктора КП (blob) не требует файлов в этой папке.
