import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "process.glb"


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def hex_to_rgba(hex_str, alpha=1.0):
    hex_str = hex_str.lstrip("#")
    r, g, b = tuple(int(hex_str[i : i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (r**2.2, g**2.2, b**2.2, alpha)


def create_materials():
    mats = {}

    def make_mat(name, hex_col, rough=0.65, metallic=0.0, emission=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = hex_to_rgba(hex_col)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metallic
        if emission > 0:
            bsdf.inputs["Emission Color"].default_value = hex_to_rgba(hex_col)
            bsdf.inputs["Emission Strength"].default_value = emission
        return m

    mats["body"] = make_mat("ProcBody", "#E5DFD5", rough=0.72)
    mats["aluminum"] = make_mat("ProcFrameAl", "#B8BEC4", rough=0.35, metallic=0.88)
    mats["sage"] = make_mat("RotorSage", "#9BA993", rough=0.45)
    mats["amber"] = make_mat("IndicatorAmber", "#D9A052", rough=0.4, emission=1.2)
    mats["dark"] = make_mat("ScreenDark", "#2E2E2E", rough=0.3)
    return mats


def create_rounded_box(name, size, location, radius, segments, mat):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bmesh.ops.bevel(
        bm, geom=bm.edges[:], offset=radius, segments=segments,
        profile=0.5, affect="EDGES", clamp_overlap=True
    )
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj.data.materials.append(mat)
    return obj


def build_process():
    clear_scene()
    mats = create_materials()

    # 1. Нижняя матовая пластиковая база (1.95 x 1.95 x 0.28)
    create_rounded_box("ProcessBase", (1.95, 1.95, 0.28), (0, 0, 0.14), 0.08, 4, mats["body"])

    # 2. Основной алюминиевый вычислительный куб (1.90 x 1.90 x 1.55)
    create_rounded_box("ProcessCube", (1.90, 1.90, 1.55), (0, 0, 1.04), 0.10, 4, mats["aluminum"])

    # 3. Углублённая колодцевая ниша под ротор сверху
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48, radius=0.68, depth=0.12, location=(0, 0, 1.82)
    )
    ring = bpy.context.active_object
    ring.name = "RotorBezel"
    for poly in ring.data.polygons:
        poly.use_smooth = True
    ring.data.materials.append(mats["body"])

    # 4. Поворотный ротор 'ProcessRotor' (имя сохранено для анимации в Three.js!)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48, radius=0.58, depth=0.14, location=(0, 0, 1.86)
    )
    rotor = bpy.context.active_object
    rotor.name = "ProcessRotor"
    for poly in rotor.data.polygons:
        poly.use_smooth = True
    rotor.data.materials.append(mats["sage"])

    # Риска-индикатор вращения на диске ротора (дочерний объект ProcessRotor)
    tick = create_rounded_box("RotorTick", (0.08, 0.26, 0.04), (0, -0.34, 1.93), 0.01, 2, mats["dark"])
    tick.parent = rotor
    tick.matrix_parent_inverse = rotor.matrix_world.inverted()

    # 5. Фронтальная панель статуса PROC_RUN (со стороны -Y)
    create_rounded_box("StatusScreen", (1.35, 0.06, 0.42), (0, -0.94, 1.38), 0.03, 2, mats["dark"])

    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_PROC_RUN"
    txt.data.body = "PROC_RUN"
    txt.data.size = 0.18
    txt.data.extrude = 0.003
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.rotation_euler = (math.pi / 2.0, 0, 0)
    txt.location = (0, -0.975, 1.38)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["sage"])

    # 6. Вентиляционные прорези и индикатор активности снизу на передней панели
    for i in range(3):
        vx = -0.35 + i * 0.35
        create_rounded_box(f"VentSlot_{i}", (0.22, 0.06, 0.08), (vx, -0.94, 0.65), 0.01, 1, mats["dark"])

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.12, depth=0.06,
        location=(0, -0.94, 0.92), rotation=(math.pi / 2.0, 0, 0)
    )
    eye = bpy.context.active_object
    eye.name = "ActivityLed"
    eye.data.materials.append(mats["amber"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_process()
