# Roadmap

## M0 — Spec & schema (done)

- [x] Манифест v0.1
- [x] Онтология M/R
- [x] Viewpoint-контракты
- [x] Визуальная грамматика
- [x] Спецификация переходов
- [x] JSON-схемы модели и layout
- [x] Семантический валидатор (`tools/validate.py`)
- [x] Пример `Hello Triangle`

## M1 — Hello Triangle vertical slice (current)

- [ ] Web-вьюер: загрузка `model.json` + `layout.json`
- [ ] M-мир: цеха, призрак `Shader`, связи, инспектор
- [ ] R-мир: объекты, ресурсы, конвейер, агенты
- [ ] Фазовый переход M ↔ R
- [ ] HUD мира и выбранного двойника
- [ ] 5 self-check вопросов
- [ ] Скриншот/GIF для README

**Критерий:** новый пользователь без подсказок отвечает на 5 вопросов из `self-check.md`.

## M2 — User test #1

- 5–8 участников, think-aloud.
- Метрики: время ответа, ошибки, уверенность, SUS/NASA-TLX.
- Сравнение с текстом LearnOpenGL и 2D-схемой.
- Повторный тест через неделю.

**Критерий:** 3D не хуже 2D по времени и ошибкам; есть список правок.

## M3 — Course topics

- `Hello Window`
- `Shaders`
- `Textures`
- `Camera`
- `Transformations` / `Coordinate Systems`

**Критерий:** каждая тема использует Topic Card и существующие viewpoints без новых сущностей ядра.

## M4 — Public v0.1.0

- README с GIF перехода.
- Работающий web-вьюер.
- 5 тем курса.
- CI: валидация JSON, проверка ссылок.
- GitHub Discussions + шаблоны issue.
- Лицензии и атрибуция.

## M5 — Optional

- Godot editor plugin.
- S-мир: код/шейдеры.
- Runtime bridge.
- Vulkan profile.
- Импорт UML (one-way, не XMI).

## Non-goals v0.1

- Полная совместимость с UML/XMI.
- Все 14 типов диаграмм UML.
- Поддержка всех языков и движков.
- Генерация кода.
- Многопользовательский режим.
