# AI Review Board

Независимая панель ИИ-рецензентов. Её задача — не соглашаться, а находить ошибки, пробелы и лучшие аналогии.

## Зачем

Один агент склонен защищать свои решения. Панель из ролей с разными предубеждениями ловит то, что одиночный автор пропускает:

- онтологические противоречия;
- ложные метафоры;
- ошибки предметной области;
- непроходимый self-check;
- юридические и accessibility-риски;
- «агент не может войти в репозиторий и сделать правку».

## Роли

| Роль | Что защищает | Чек-лист | Промпт |
|---|---|---|---|
| Онтолог | M/R, материализация, drift | [`checklists/ontology.md`](checklists/ontology.md) | [`prompts/ontologist.md`](prompts/ontologist.md) |
| Грамматист | визуальный язык, коллизии состояний | [`checklists/visual-grammar.md`](checklists/visual-grammar.md) | [`prompts/grammar.md`](prompts/grammar.md) |
| Доменный эксперт | OpenGL, ресурсы, конвейер | [`checklists/domain-opengl.md`](checklists/domain-opengl.md) | [`prompts/domain.md`](prompts/domain.md) |
| Методист | обучение, self-check, нагрузка | [`checklists/learning.md`](checklists/learning.md) | [`prompts/learning.md`](prompts/learning.md) |
| Скептик | «зачем это вообще», red team | [`checklists/skeptic.md`](checklists/skeptic.md) | [`prompts/skeptic.md`](prompts/skeptic.md) |
| Скаут аналогий | метафоры-«моды», замена текущей метафоры | [`checklists/metaphor.md`](checklists/metaphor.md) | [`prompts/metaphor.md`](prompts/metaphor.md) |
| Доступность | reduced motion, цвет, звук, screen reader | [`checklists/accessibility.md`](checklists/accessibility.md) | [`prompts/accessibility.md`](prompts/accessibility.md) |
| ИИ-контрибьютор | вход в репозиторий без человека | [`checklists/ai-contributor.md`](checklists/ai-contributor.md) | [`prompts/ai-contributor.md`](prompts/ai-contributor.md) |

## Как запускать

1. Выбери роли по типу изменения (см. кворум ниже).
2. Запусти каждую роль **отдельным агентом без общего контекста**. Не показывай одному рецензенту вывод другого.
3. Дай агенту промпт из `prompts/` и путь к репозиторию.
4. Собери отчёты в `docs/review/YYYY-MM-DD-<topic>.md`.
5. P0/P1 findings превращаются в issues или PR.
6. Решение фиксируется в `docs/decisions/` или в отчёте.

## Кворум

| Тип изменения | Минимум ролей |
|---|---|
| Опечатки, ссылки | 1 |
| Пример или тема курса | 3: онтолог, методист, доменный эксперт |
| Схема, viewpoint | 5: онтолог, грамматист, доменный эксперт, ИИ-контрибьютор, скептик |
| Ядро онтологии, замена метафоры | все 8 |
| Переходы, доступность | 4: грамматист, доступность, методист, скептик |

## Severity

| Уровень | Значение | Действие |
|---|---|---|
| **P0** | ломает онтологию или валидацию | блокирует merge |
| **P1** | вводит в заблуждение или ломает обучение | блокирует merge до решения |
| **P2** | ухудшает качество, но не блокирует | issue |
| **P3** | вкусовое/косметическое | на усмотрение автора |

## Формат отчёта

```markdown
# Review — <topic> — <date>

## Verdict
accept / accept with changes / reject / defer

## Findings
### P1 — <short title>
- Evidence: `file:line` or section
- Why: ...
- Proposal: ...
- Confidence: high/medium/low

## What works
...

## Open questions
...
```

## Правила

1. **Независимость.** Рецензенты не видят отчёты друг друга до синтеза.
2. **Доказательства.** Каждый finding ссылается на файл/раздел или на отсутствие файла.
3. **Без самопросмотра.** Автор изменения не может быть единственным рецензентом.
4. **Аналогии — это моды.** Замена метафоры требует scorecard и плана миграции, а не «мне так больше нравится».
5. **Скептик обязателен.** Если панель только хвалит — она бесполезна.
6. **Отчёты публичны.** Они лежат в репозитории и версионируются.

## Аналогии-моды

Текущая метафора — «голографический чертёж ↔ материализованный runtime-модуль» (см. [`../../spec/03-visual-grammar.md`](../../spec/03-visual-grammar.md)). Фабричная метафора сохранена в [`analogies/`](analogies/) как история ревью; она может быть заменена или дополнена, если challenger выигрывает по scorecard.

- [`analogies/README.md`](analogies/README.md)
- [`analogies/scorecard.md`](analogies/scorecard.md)
- [`analogies/mods/0000-template.md`](analogies/mods/0000-template.md)

## Отчёты

- [`2026-11-13-initial-panel.md`](2026-11-13-initial-panel.md)
