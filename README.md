# UMLG

[![validate](https://github.com/umlg-ai/umlg/actions/workflows/validate.yml/badge.svg)](https://github.com/umlg-ai/umlg/actions/workflows/validate.yml)
[![release](https://img.shields.io/github/v/release/umlg-ai/umlg?include_prereleases&label=release)](https://github.com/umlg-ai/umlg/releases)
[![license](https://img.shields.io/github/license/umlg-ai/umlg)](LICENSE)

UMLG — экспериментальный визуальный язык архитектуры: **мир замысла (M)** и **мир воплощения (R)**, переход между ними как фазовый сдвиг, 3D как основная среда.

Статус: **v0.1 draft**. Это не стандарт и не замена UML. Это проверяемый вертикальный срез на примере `Hello Triangle`.

## Что уже есть

- манифест v0.1 — [`spec/00-manifest.md`](spec/00-manifest.md);
- онтология миров — [`spec/01-worlds.md`](spec/01-worlds.md);
- viewpoint-контракты — [`spec/02-viewpoints.md`](spec/02-viewpoints.md);
- визуальная грамматика — [`spec/03-visual-grammar.md`](spec/03-visual-grammar.md);
- переходы — [`spec/04-transitions.md`](spec/04-transitions.md);
- сериализация — [`spec/05-serialization.md`](spec/05-serialization.md);
- JSON-схемы — [`schema/`](schema/);
- пример `Hello Triangle` — [`examples/hello-triangle/`](examples/hello-triangle/);
- семантический валидатор — [`tools/validate.py`](tools/validate.py);
- Topic Card для курса — [`course/hello-triangle.md`](course/hello-triangle.md);
- матрица курса — [`course/README.md`](course/README.md);
- заметки по вьюеру — [`viewer/README.md`](viewer/README.md).

## Чего ещё нет

- вьюер/редактор (следующий milestone);
- видео-демо;
- S-мир (код/шейдеры);
- импорт/экспорт UML/XMI;
- Godot-плагин;
- полный курс LearnOpenGL.

## Для ИИ-контрибьюторов

Репозиторий подготовлен так, чтобы ИИ-агент мог войти без устного контекста:

1. [`AGENTS.md`](AGENTS.md) — обязательные правила, инварианты, карта файлов, Definition of Done.
2. [`docs/ai-handbook.md`](docs/ai-handbook.md) — онтология, пайплайн валидации, типовые ошибки, чек-листы.
3. [`llms.txt`](llms.txt) — плоская карта репозитория для LLM.
4. [`docs/decisions/`](docs/decisions/) — принятые решения и их причины.
5. [`docs/rfcs/0000-template.md`](docs/rfcs/0000-template.md) — как предлагать изменения ядра.
6. [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — короткая версия для Copilot.

Главное правило: **не менять семантику молча**. Сомнение → issue или RFC.


## Быстрый старт

1. Прочитай [`spec/00-manifest.md`](spec/00-manifest.md).
2. Открой [`examples/hello-triangle/README.md`](examples/hello-triangle/README.md).
3. Проверь всё одной командой:

   ```bash
   make validate
   ```

   Или вручную:

   ```bash
   python3 -m json.tool examples/hello-triangle/model.json > /dev/null
   python3 -m json.tool examples/hello-triangle/layout.json > /dev/null
   python3 tools/validate.py examples/hello-triangle/model.json examples/hello-triangle/layout.json
   ```

4. Ответь на вопросы в [`examples/hello-triangle/self-check.md`](examples/hello-triangle/self-check.md).

## Демо

Видео-демо находится в производстве: вьюер ещё не реализован.

- сценарий и раскадровка — [`docs/video/hello-triangle-demo.md`](docs/video/hello-triangle-demo.md);
- после записи здесь появятся GIF и ссылка на YouTube.

Видео — это тест объяснимости и способ привлечь людей, а не замена usability-тесту.


## Принципы

1. Одно присутствие — один мир. Другой мир не виден.
2. Миры — это онтологии, а не слои одной сцены.
3. Не «диаграммы», а viewpoints: контракт на то, что видно и что означает.
4. Семантика отделена от презентации: координаты и цвет не меняют смысл модели.
5. 3D — основная среда, но ортопроекция допустима для документации и доступности.
6. Переход — фазовый сдвиг, а не портал; он привязан к наблюдателю, а не к месту.
7. NPC — семантические агенты, а не декор.
8. Маленькое ядро, профили для доменов.
9. Модель не зависит от движка; Godot/web — фронтенды.
10. Открытый JSON, стабильные ID, layout отдельно от модели.

## Лицензия

Код — MIT (см. [`LICENSE`](LICENSE)).
Контент курса — TBD: текст и изображения LearnOpenGL не копируются; используются ссылки и оригинальные схемы.
