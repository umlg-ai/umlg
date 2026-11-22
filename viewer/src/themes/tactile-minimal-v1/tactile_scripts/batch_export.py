import os
import re
import traceback
import bpy

SCRIPTS_DIR = os.path.expanduser("~/Desktop/tactile_scripts")
OUTPUT_DIR = os.path.expanduser("~/Desktop/tactile_glb")


def run_batch():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if not os.path.isdir(SCRIPTS_DIR):
        print(f"[ERROR] Папка со скриптами не найдена: {SCRIPTS_DIR}")
        return

    scripts = sorted(
        f for f in os.listdir(SCRIPTS_DIR)
        if f.endswith(".py") and f != "batch_export.py"
    )

    if not scripts:
        print(f"[WARN] В папке {SCRIPTS_DIR} нет .py файлов.")
        return

    print(f"=== Запуск пакетной генерации ({len(scripts)} моделей) ===")
    success_count = 0
    failed = []

    for idx, filename in enumerate(scripts, start=1):
        filepath = os.path.join(SCRIPTS_DIR, filename)
        print(f"[{idx}/{len(scripts)}] Генерация: {filename}...")

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                code = f.read()

            # 1. Безопасно подменяем EXPORT_DIR
            safe_out = OUTPUT_DIR.replace("\\", "/")
            code = re.sub(
                r'^EXPORT_DIR\s*=.*$',
                f'EXPORT_DIR = "{safe_out}"',
                code,
                flags=re.MULTILINE,
            )

            # 2. Авто-фикс назначения активного объекта перед экспортом (.objects[0])
            code = code.replace(
                "bpy.context.view_layer.objects.active = bpy.context.view_layer.objects\n",
                "bpy.context.view_layer.objects.active = bpy.context.view_layer.objects[0]\n",
            )

            namespace = {"__name__": "__main__", "__file__": filepath}
            exec(compile(code, filepath, "exec"), namespace)
            success_count += 1

        except Exception as exc:
            print(f"[ERROR] Ошибка при обработке {filename}: {exc}")
            traceback.print_exc()
            failed.append(filename)

    print("\n=== Итоги генерации ===")
    print(f"Успешно экспортировано: {success_count} из {len(scripts)}")
    print(f"Папка с .glb моделями: {OUTPUT_DIR}")
    if failed:
        print(f"Ошибки в файлах: {', '.join(failed)}")


run_batch()
