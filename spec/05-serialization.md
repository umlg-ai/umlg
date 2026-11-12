# 05 — Сериализация

## 1. Два файла, два смысла

| Файл | Отвечает на вопрос | Меняется при |
|---|---|---|
| `model.json` | что это и как связано | изменении архитектуры |
| `layout.json` | где это стоит и как выглядит | изменении сцены/камеры/стиля |

Правило: **семантика не живёт в layout, презентация не живёт в модели.**

Запрещено в `model.json`:

- координаты, повороты, масштаб;
- цвета, материалы, текстуры;
- размеры в метрах;
- параметры камеры.

Запрещено в `layout.json`:

- имена типов как источник истины;
- кратности;
- виды связей;
- признаки `abstract`.

Layout может содержать **декоративные подсказки**, но они не являются семантикой. Если layout потерян, модель обязана остаться валидной и читаемой (с авто-раскладкой).

## 2. Стабильные идентификаторы

Формат: `<world>.<kind-short>.<local-id>`.

Примеры:

```
m.app
m.class.circle
m.iface.shape
r.obj.circle-1
m.rel.circle.extends.shape
```

Правила:

1. `id` уникален в пределах модели.
2. `id` не меняется при переименовании отображаемого имени.
3. `id` не содержит пробелов; допустимы `a-z`, `0-9`, `.`, `-`, `_`.
4. Связи имеют свои `id`, чтобы на них можно было ссылаться (например, в layout).
5. Удалённый `id` не переиспользуется в той же major-версии.

## 3. Версионирование

```json
{
  "umlgVersion": "0.1",
  "id": "hello-triangle",
  "name": "Hello Triangle"
}
```

- `umlgVersion` — версия схемы.
- `id` модели — стабильный slug.
- `name` — человекочитаемое имя, может меняться.
- `description` — свободный текст.

Несовместимые изменения схемы → major. Новые необязательные поля → minor.

## 4. Структура `model.json`

```json
{
  "umlgVersion": "0.1",
  "id": "hello-triangle",
  "name": "Hello Triangle",
  "description": "...",
  "worlds": [
    { "id": "M", "name": "Замысел", "kind": "mental" },
    { "id": "R", "name": "Воплощение", "kind": "real" }
  ],
  "elements": [
    {
      "id": "m.app",
      "world": "M",
      "kind": "class",
      "name": "Application",
      "tags": ["opengl", "entry"],
      "members": [],
      "notes": "..."
    }
  ],
  "relations": [
    {
      "id": "m.rel.app.window",
      "world": "M",
      "kind": "composition",
      "from": "m.app",
      "to": "m.window",
      "label": "owns",
      "fromMultiplicity": "1",
      "toMultiplicity": "1"
    }
  ],
  "links": [
    {
      "id": "link.circle-1",
      "kind": "materializes",
      "from": "m.class.circle",
      "to": "r.obj.circle-1"
    }
  ]
}
```

## 5. Виды элементов

| `kind` | Мир | Смысл |
|---|---|---|
| `class` | M | конкретный тип |
| `abstractClass` | M | тип без прямой материализации |
| `interface` | M | контракт |
| `component` | M | модуль/компонент |
| `concept` | M | понятие/решение/паттерн |
| `object` | R | экземпляр |
| `resource` | R | буфер, текстура, framebuffer |
| `process` | R | процесс/поток |
| `stage` | R | стадия конвейера |
| `command` | R | вызов/команда |
| `actor` | R | CPU/GPU/сервис/пользователь |

Расширение списка — только через RFC и минимум 3 темы курса.

## 6. Виды связей

| `kind` | Мир | Смысл |
|---|---|---|
| `association` | M | ассоциация |
| `inheritance` | M | наследование |
| `realization` | M | реализация интерфейса |
| `composition` | M | композиция |
| `aggregation` | M | агрегация |
| `dependency` | M | зависимость |
| `flow` | R | поток данных |
| `call` | R | вызов |
| `signal` | R | событие/сигнал |
| `binding` | R | привязка к ресурсу |

Межмировые связи — отдельный массив `links`:

| `kind` | Из | В |
|---|---|---|
| `materializes` | M-класс | R-объект |
| `implements` | M-интерфейс | M-класс |
| `deploys` | M-компонент | R-процесс |
| `observes` | R-факт | M-элемент |
| `drift` | M-элемент | R-элемент |

## 7. Члены

```json
{
  "members": [
    {
      "id": "m.app.run",
      "kind": "method",
      "name": "run",
      "visibility": "public",
      "signature": "run() -> void",
      "isAbstract": false,
      "isStatic": false,
      "returns": "void",
      "params": []
    },
    {
      "id": "m.circle.radius",
      "kind": "attribute",
      "name": "radius",
      "visibility": "private",
      "type": "float",
      "isStatic": false,
      "isReadonly": true
    }
  ]
}
```

Правила:

- `signature` — человекочитаемая строка; структурные поля (`params`, `returns`) — источник истины.
- `isAbstract` допустим только у методов абстрактного класса или интерфейса.
- Абстрактный метод не имеет тела/реализации в v0.1.
- Видимость: `public`, `protected`, `private`, `package`.

## 8. `layout.json`

```json
{
  "layoutVersion": "0.1",
  "modelId": "hello-triangle",
  "worlds": {
    "M": {
      "ambient": "mental",
      "nodes": [
        {
          "ref": "m.app",
          "position": [0, 0, 0],
          "rotation": [0, 0, 0],
          "scale": [1, 1, 1],
          "collapsed": false,
          "pinned": true
        }
      ]
    },
    "R": { "ambient": "real", "nodes": [] }
  },
  "camera": {
    "M": { "position": [0, 1.6, 6], "target": [0, 1, 0] },
    "R": { "position": [0, 1.6, 6], "target": [0, 1, 0] }
  }
}
```

Правила:

- `ref` обязан ссылаться на существующий `id`.
- `position` — метры, правая система координат, `Y` вверх.
- `rotation` — Эйлер, градусы, порядок `XYZ`.
- Отсутствующий узел → авто-раскладка.
- Layout не обязан содержать все элементы.
- `modelId` должен совпадать с `model.id`.

## 9. Провенанс

Опционально, но рекомендуется для R-элементов:

```json
{
  "id": "r.obj.circle-1",
  "world": "R",
  "kind": "object",
  "name": "Circle#1",
  "provenance": {
    "materializedFrom": "m.class.circle",
    "at": "2026-01-01T00:00:00Z",
    "source": "demo"
  }
}
```

## 10. Валидация

Схемы: [`../schema/umlg.schema.json`](../schema/umlg.schema.json), [`../schema/layout.schema.json`](../schema/layout.schema.json).

Проверки:

1. JSON Schema 2020-12.
2. Уникальность `id`.
3. Ссылочная целостность `from`/`to`/`ref`.
4. Мир элемента соответствует допустимым `kind`.
5. `abstractClass` не источник `materializes`.
6. `object` имеет ровно один `materializes` (или `drift`).
7. `modelId` в layout совпадает с `id` модели.

Семантические проверки (пункты 3–6) в v0.1 выполняются скриптом-валидатором, а не одной JSON Schema.

## 11. Чего в v0.1 нет

- XMI/UML импорт и экспорт;
- генерация кода;
- executable-семантика;
- S-мир;
- версионирование отдельных элементов (только major/minor схемы);
- слияние моделей (merge).

## 12. Пример

Полный рабочий пример: [`../examples/hello-triangle/`](../examples/hello-triangle/).
