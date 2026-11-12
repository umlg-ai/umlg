# Course topics

Каждая тема — Topic Card по шаблону [`hello-triangle.md`](hello-triangle.md). Тема не считается готовой, пока:

1. есть M-модель и R-модель;
2. указаны viewpoints;
3. есть типичные ошибки;
4. есть 2–3 упражнения;
5. есть self-check с эталонными ответами;
6. источник и лицензия проверены.

## Матрица курса

| Блок LearnOpenGL | Темы | Основные viewpoints | Статус |
|---|---|---|---|
| Introduction | — | — | — |
| Getting started | Hello Window | `structure`, `deployment` | planned |
| Getting started | **Hello Triangle** | `structure`, `resources`, `pipeline`, `state`, `sequence` | **draft** |
| Getting started | Shaders | `structure`, `pipeline`, `state` | planned |
| Getting started | Textures | `resources`, `pipeline` | planned |
| Getting started | Transformations | `structure`, `spatial` (TBD) | planned |
| Getting started | Coordinate Systems | `spatial` (TBD) | planned |
| Getting started | Camera | `spatial`, `state` | planned |
| Lighting | Colors / Basic Lighting | `pipeline`, `resources` | planned |
| Lighting | Materials / Lighting maps | `resources`, `pipeline` | planned |
| Lighting | Light casters / Multiple lights | `pipeline`, `sequence` | planned |
| Model Loading | Assimp / Mesh / Model | `resources`, `structure` | planned |
| Advanced OpenGL | Depth / Stencil / Blending | `state`, `resources` | planned |
| Advanced OpenGL | Face culling / Framebuffers | `state`, `resources` | planned |
| Advanced OpenGL | Cubemaps / Advanced Data | `resources` | planned |
| Advanced OpenGL | Geometry Shader / Instancing | `pipeline` | planned |
| Advanced OpenGL | Anti Aliasing | `pipeline`, `resources` | planned |
| Advanced Lighting | Gamma / Shadows | `pipeline`, `resources` | planned |
| Advanced Lighting | Normal / Parallax / HDR / Bloom | `pipeline`, `resources` | planned |
| Advanced Lighting | Deferred Shading | `pipeline`, `resources` | planned |
| PBR | Theory / Lighting / Authoring | `pipeline`, `spatial` | planned |
| In Practice | Debugging / Text rendering | `runtime`, `sequence` | planned |

## Правило расширения

Новый viewpoint (`spatial` — кандидат №1) добавляется только после того, как минимум три темы упрутся в его отсутствие. До этого матрицы/камера выражаются через `structure` + `layout`.

## Правовой режим

- Не копировать текст, код и изображения LearnOpenGL.
- Ссылаться на источник и указывать автора курса.
- Делать собственные схемы и формулировки.
- Перед публикацией темы проверять лицензию источника.
