# Topic Card — Hello Triangle

> Шаблон описания темы курса. Одна тема = один проверяемый срез UMLG.
> Источник вдохновения: [LearnOpenGL — Hello Triangle](https://learnopengl.com/Getting-started/Hello-Triangle).
> Текст и изображения LearnOpenGL не копируются; используются собственные схемы и ссылка на источник.

## 1. Цель

Понять, как три вершины из памяти CPU превращаются в треугольник на экране, и уметь ответить, **какие объекты и контракты для этого нужны**.

## 2. Вопросы, на которые отвечает тема

1. Зачем нужны VBO, VAO и шейдерная программа?
2. Что именно делает draw call?
3. Какие стадии проходит вершина?
4. Какие инварианты должны выполняться перед отрисовкой?
5. Что произойдёт, если забыть привязать VAO?

## 3. M-модель (Замысел)

| Элемент | Роль |
|---|---|
| `Application` | точка входа, владеет окном и конвейером |
| `Window` | область вывода |
| `GLContext` | контекст OpenGL |
| `Shader` | **призрак**: абстрактный контракт компиляции |
| `VertexShader`, `FragmentShader` | конкретные реализации |
| `ShaderProgram` | слинкованная пара шейдеров |
| `VertexArray` | конфигурация атрибутов и привязок |
| `VertexBuffer`, `IndexBuffer` | данные |
| `GraphicsPipeline` + 5 стадий | схема обработки |
| `Framebuffer` | цель вывода |
| `DrawCall` | команда отрисовки |
| `GLState` | концепт инвариантов |

Ключевые связи:

- `Application` ⟶ `Window`, `GLContext`, `GraphicsPipeline` (composition);
- `ShaderProgram` ⟶ `VertexShader`, `FragmentShader` (composition);
- `VertexShader` / `FragmentShader` ⟶ `Shader` (inheritance);
- `VertexArray` ⟶ `VertexBuffer`, `IndexBuffer` (aggregation);
- `DrawCall` ⟶ `ShaderProgram`, `VertexArray`, `Framebuffer`, `GLState` (dependency).

Инварианты:

- `Shader` нельзя инстанцировать напрямую;
- перед draw программа слинкована и активна;
- перед draw VAO привязан;
- атрибут 0 включён;
- VBO привязан к VAO и содержит данные.

## 4. R-модель (Воплощение)

| Элемент | Факт |
|---|---|
| `Application#1` | запущенный процесс |
| `Window#1` | окно 800×600 |
| `GLContext#1` | OpenGL 3.3 Core |
| `VBO#3` | 9 float — три вершины |
| `EBO#4` | создан, но не используется в draw |
| `VAO#1` | хранит конфигурацию атрибутов |
| `ShaderProgram#7` | слинкованная программа |
| `DefaultFramebuffer#0` | цель вывода |
| `glDrawArrays#1` | один draw call |
| `CPU`, `GPU` | акторы |

Поток:

```
CPU → glDrawArrays → VertexStage → PrimitiveAssembly → Rasterizer
    → FragmentStage → OutputMerger → DefaultFramebuffer
```

У `Shader` **нет** R-двойника. Это главный визуальный и смысловой тест темы.

## 5. Viewpoints темы

| Viewpoint | Что показывает | Зачем |
|---|---|---|
| `structure` | типы и связи M-мира | понять состав |
| `resources` | VBO/VAO/EBO/Program/Framebuffer | понять владение и привязки |
| `pipeline` | стадии и поток | понять путь вершины |
| `state` | инварианты перед draw | понять ошибки |
| `sequence` | CPU → draw → GPU | понять порядок |

## 6. NPC

| NPC | Действие |
|---|---|
| Бригадир `ShaderProgram` | объясняет, что программа — не просто два файла, а слинкованный объект |
| Оператор `VertexStage` | берёт вершины из VBO, выдаёт позиции |
| Курьер `DrawCall` | несёт команду от CPU к GPU |
| Инспектор `GLState` | проверяет инварианты, краснеет при нарушении |
| Призрак `Shader` | объясняет, почему его нельзя создать и кто его реализует |

## 7. Типичные ошибки

| Ошибка | Симптом | Где видно в UMLG |
|---|---|---|
| не создан VAO | чёрный экран / GL error | `GLState` краснеет, `DrawCall` без `VAO` |
| шейдер не скомпилировался | программа не линкуется | `ShaderProgram` без статуса `linked` |
| не включён атрибут | вершины «схлопнуты» | `VertexArray` без активного атрибута |
| неверный размер данных | мусор на экране | `VBO` с несоответствующим размером |
| draw без `useProgram` | не тот шейдер | `GLState` показывает неактивную программу |

## 8. Упражнения

1. Добавь в M-модель `Texture` и свяжи её с `FragmentStage`. Какие связи нужны: `binding`, `composition` или `dependency`?
2. Сделай так, чтобы `EBO#4` участвовал в draw. Что изменится в `DrawCall` и `GLState`?
3. Создай второй экземпляр `ShaderProgram#8`. Что изменится в M-мире? (Правильный ответ: ничего, кроме счётчика.)

## 9. Self-check

См. [`../examples/hello-triangle/self-check.md`](../examples/hello-triangle/self-check.md).

Критерий: 7/7 без подсказок.

## 10. Атрибуция

- Тема вдохновлена LearnOpenGL, раздел «Hello Triangle».
- Ссылка: <https://learnopengl.com/Getting-started/Hello-Triangle>.
- Все схемы и формулировки — оригинальные.
- Перед публикацией проверить лицензию источника и не перепубликовать чужие изображения/текст.
