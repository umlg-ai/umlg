import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "actor.glb"


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

    mats["base"] = make_mat("PedestalMatte", "#E5DFD5", rough=0.72)
    mats["aluminum"] = make_mat("GimbalAl", "#B8BEC4", rough=0.32, metallic=0.88)
    mats["core"] = make_mat("ActorCoreAmber", "#D9A052", rough=0.18, emission=1.1)
    mats["text"] = make_mat("ActorText", "#2E2E2E", rough=0.5)
    return mats


def create_gimbal_ring(name, outer_r, inner_r, height, location, rotation, mat):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=72, radius=outer_r, depth=height, location=location, rotation=rotation
    )
    outer = bpy.context.active_object
    outer.name = name

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=72, radius=inner_r, depth=height + 0.1, location=location, rotation=rotation
    )
    hole = bpy.context.active_object

    b_mod = outer.modifiers.new(name="HollowRing", type="BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = hole
    bpy.context.view_layer.objects.active = outer
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(hole, do_unlink=True)

    mod_b = outer.modifiers.new(name="Bevel", type="BEVEL")
    mod_b.width = 0.015
    mod_b.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod_b.name)

    for poly in outer.data.polygons:
        poly.use_smooth = True
    outer.data.materials.append(mat)
    return outer


def build_actor():
    clear_scene()
    mats = create_materials()

    center_z = 1.15

    # 1. Кольцевой подиум-основание с фаской
    create_gimbal_ring("ActorPedestal", 1.15, 0.72, 0.24, (0, 0, 0.12), (0, 0, 0), mats["base"])

    # Две боковые стойки крепления внешнего карданного кольца
    for sx in (-0.92, 0.92):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24, radius=0.07, depth=1.05, location=(sx, 0, 0.68)
        )
        post = bpy.context.active_object
        post.data.materials.append(mats["aluminum"])

    # 2. Внешнее алюминиевое кольцо кардана
    create_gimbal_ring("OuterGimbalRing", 0.92, 0.80, 0.16, (0, 0, center_z), (math.pi / 2.0, 0, 0), mats["aluminum"])

    # 3. Внутреннее наклонное кольцо кардана (поворот на 45° по X и Y)
    create_gimbal_ring(
        "InnerGimbalRing", 0.72, 0.61, 0.14, (0, 0, center_z),
        (math.radians(45), math.radians(35), 0), mats["aluminum"]
    )

    # 4. Центральное светящееся янтарное ядро инициатора
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=36, ring_count=24, radius=0.34, location=(0, 0, center_z)
    )
    core = bpy.context.active_object
    core.name = "ActorCore"
    for poly in core.data.polygons:
        poly.use_smooth = True
    core.data.materials.append(mats["core"])

    # 5. Изогнутая гравировка 'ACTOR' на переднем бортике подиума
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_ACTOR"
    txt.data.body = "ACTOR"
    txt.data.size = 0.18
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["text"])

    # Изгибаем надпись по дуге переднего края подиума (R = 0.94)
    r_arc = 0.94
    for v in txt.data.vertices:
        arc_x = v.co.x
        rad_y = v.co.y
        z = v.co.z
        theta = arc_x / r_arc
        r = r_arc - rad_y
        v.co.x = r * math.sin(theta)
        v.co.y = -r * math.cos(theta)
        v.co.z = 0.242 + z
    txt.data.update()

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_actor()
