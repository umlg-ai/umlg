# Hello Triangle

Первый вертикальный срез UMLG. Цель — показать, что один и тот же пример читается в двух мирах и что переход между ними не теряет контекст.

## Файлы

| Файл | Что содержит |
|---|---|
| `model.json` | семантика: элементы M/R, связи, межмировые ссылки |
| `layout.json` | только презентация: координаты, камера, ambient |
| `self-check.md` | 7 вопросов с эталонными ответами |

## Что происходит в примере

Три вершины в VBO проходят через конвейер и попадают в framebuffer.

**M-мир (Замысел):**

- `Application` владеет `Window`, `GLContext` и `GraphicsPipeline`;
- `ShaderProgram` содержит `VertexShader` и `FragmentShader`;
- `Shader` — **призрак**: абстрактный класс, который нельзя создать напрямую;
- `VertexArray` агрегирует `VertexBuffer` и `IndexBuffer`;
- `DrawCall` зависит от программы, VAO и framebuffer;
- `GLState` — концепт инвариантов: «VAO привязан», «программа слинкована», «атрибут 0 включён».

**R-мир (Воплощение):**

- запущенный `Application#1`, окно и контекст;
- реальные ресурсы: `VBO#3`, `EBO#4`, `VAO#1`, `ShaderProgram#7`, `DefaultFramebuffer#0`;
- стадии конвейера от вершин до вывода;
- `glDrawArrays#1` — один draw call;
- CPU отправляет команду, GPU исполняет стадии;
- **у `Shader` нет R-двойника**: абстрактный класс не материализуется.

## Как читать

1. Открой `model.json` и найди `m.shader`.
2. Обрати внимание: `kind: abstractClass`, тег `ghost`.
3. Найди все `links` с `kind: materializes` — среди них нет ни одной, где `from` равен `m.shader`.
4. Найди `r.*`-элементы: у каждого есть `provenance.materializedFrom`.
5. Сравни `layout.json`: координаты M и R почти совпадают. Это не ошибка, а сохранение пространственной памяти.

## Проверка

```bash
python3 -m json.tool model.json > /dev/null
python3 -m json.tool layout.json > /dev/null

python3 ../../tools/validate.py model.json layout.json
```

## Ограничения примера

- EBO присутствует, но не используется в draw call — это намеренно, чтобы показать «есть ресурс, но он не в текущем потоке».
- S-мир (код C++/GLSL) не включён в v0.1.
- Метрики runtime не включены: это следующий viewpoint.
