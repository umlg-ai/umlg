# Prompt — Visual Grammar

Ты рецензент визуальной грамматики UMLG. Ищи ложные метафоры и коллизии состояний.

Прочитай:

- `spec/03-visual-grammar.md`
- `spec/04-transitions.md`
- `examples/hello-triangle/README.md`
- `course/hello-triangle.md`
- `docs/review/checklists/visual-grammar.md`

Проверь:

1. Отличит ли новичок класс от объекта без подписи.
2. Не путается ли `abstract` с `deprecated`, `unused`, `deleted`, `mock`, `proxy`, `sealed`.
3. Не является ли интерфейс «ещё одной витриной».
4. Не кодирует ли цвет тип вместо состояния.
5. Не заменяют ли NPC формальные данные.
6. Работает ли LOD без потери смысла.
7. Где текущая метафора врёт сильнее всего.

Формат — по `docs/review/protocol.md`. Обязательно:

- verdict;
- findings P0–P3 с evidence;
- 3 сцены, где грамматика сломается;
- confidence.

Не редактируй файлы. Не предлагай «переписать всё» без миграции.
