import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "component.glb"


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

    def make_mat(name, hex_col, rough=0.65, alpha=1.0, transmission=0.0, ior=1.45, metallic=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = hex_to_rgba(hex_col, alpha)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metallic
        if "IOR" in bsdf.inputs:
            bsdf.inputs["IOR"].default_value = ior
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = transmission
        if alpha < 1.0:
            if hasattr(m, "blend_method"):
                m.blend_method = "BLEND"
            if "Alpha" in bsdf.inputs:
                bsdf.inputs["Alpha"].default_value = alpha
        return m

    mats["tray"] = make_mat("ComponentTray", "#E5DFD5", rough=0.72)
    mats["recess"] = make_mat("TrayWell", "#4A453D", rough=0.85)
    mats["sage"] = make_mat("SubModuleSage", "#9BA993", rough=0.52)
    mats["amber_core"] = make_mat("SubCoreAmber", "#D9A052", rough=0.45)
    mats["amber_hood"] = make_mat("SubHoodAmber", "#E0A856", rough=0.16, alpha=0.45, transmission=0.75, ior=1.49)
    mats["text"] = make_mat("CompLabel", "#2E2E2E", rough=0.5)
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


def build_component():
    clear_scene()
    mats = create_materials()

    # 1. Основной подиум-лоток с бортиками (2.8 x 2.8 x 0.42)
    tray = create_rounded_box("ComponentTray", (2.8, 2.8, 0.42), (0, 0, 0.21), 0.12, 4, mats["tray"])
    well = create_rounded_box("TrayCavity", (2.42, 2.28, 0.22), (0, 0.12, 0.36), 0.06, 3, mats["recess"])
    b_mod = tray.modifiers.new(name="CutWell", type="BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = well
    bpy.context.view_layer.objects.active = tray
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(well, do_unlink=True)

    # Тёмная монтажная плата на дне лотка
    create_rounded_box("TrayFloor", (2.38, 2.24, 0.04), (0, 0.12, 0.26), 0.02, 2, mats["recess"])

    # 2. Левый верхний модуль: прозрачный янтарный кожух с внутренним цилиндрическим блоком
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=36, radius=0.22, depth=1.15,
        location=(-0.55, 0.65, 0.48), rotation=(0, math.pi / 2.0, 0)
    )
    core_cyl = bpy.context.active_object
    core_cyl.name = "InnerCoil"
    for poly in core_cyl.data.polygons:
        poly.use_smooth = True
    core_cyl.data.materials.append(mats["amber_core"])

    create_rounded_box("AmberHoodModule", (1.35, 0.85, 0.46), (-0.48, 0.65, 0.49), 0.06, 3, mats["amber_hood"])

    # 3. Левый нижний модуль: компактный матовый картридж с контактными точками
    create_rounded_box("SubCardModule", (1.35, 1.15, 0.30), (-0.48, -0.42, 0.41), 0.06, 3, mats["tray"])
    for i in range(4):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16, radius=0.025, depth=0.02, location=(-0.65 + i * 0.12, -0.10, 0.562)
        )
        dot = bpy.context.active_object
        dot.data.materials.append(mats["recess"])

    # 4. Правый вертикальный шалфейный модуль
    create_rounded_box("SageSideModule", (0.86, 2.08, 0.34), (0.72, 0.12, 0.43), 0.06, 3, mats["sage"])

    # 5. Гравировка COMP_01 на переднем бортике лотка
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_COMP01"
    txt.data.body = "COMP_01"
    txt.data.size = 0.18
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = (0, -1.26, 0.422)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["text"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_component()
