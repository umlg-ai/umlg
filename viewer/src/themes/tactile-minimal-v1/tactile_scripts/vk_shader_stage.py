import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "vk_shader_stage.glb"


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

    mats["stand"] = make_mat("MatteStand", "#E5DFD5", rough=0.72)
    mats["sage"] = make_mat("SageBarrel", "#9BA993", rough=0.45, metallic=0.25)
    mats["brass"] = make_mat("AmberTrim", "#D9A052", rough=0.28, metallic=0.82)
    mats["aluminum"] = make_mat("RearMount", "#C2CBD2", rough=0.35, metallic=0.88)
    mats["lens"] = make_mat("AmberLens", "#E0A856", rough=0.08, alpha=0.65, transmission=0.85, ior=1.52)
    mats["text"] = make_mat("BarrelText", "#2E2E2E", rough=0.5)
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


def create_x_tube(name, outer_r, inner_r, length, center_x, center_z, mat):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=72, radius=outer_r, depth=length,
        location=(center_x, 0, center_z), rotation=(0, math.pi / 2.0, 0)
    )
    outer = bpy.context.active_object
    outer.name = name

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=72, radius=inner_r, depth=length + 0.2,
        location=(center_x, 0, center_z), rotation=(0, math.pi / 2.0, 0)
    )
    hole = bpy.context.active_object

    b_mod = outer.modifiers.new(name="Hollow", type="BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = hole
    bpy.context.view_layer.objects.active = outer
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(hole, do_unlink=True)

    for poly in outer.data.polygons:
        poly.use_smooth = True
    outer.data.materials.append(mat)
    return outer


def build_vk_shader_stage():
    clear_scene()
    mats = create_materials()

    axis_z = 1.65

    # 1. Г-образная матовая подставка-опора
    create_rounded_box("StandBase", (1.6, 1.8, 0.28), (0.15, 0, 0.14), 0.08, 4, mats["stand"])
    create_rounded_box("StandPillar", (0.42, 1.3, 1.45), (0.55, 0, 0.85), 0.08, 4, mats["stand"])

    # 2. Заднее алюминиевое байонетное кольцо (X = 0.55)
    create_x_tube("RearMountRing", 1.25, 0.92, 0.35, 0.55, axis_z, mats["aluminum"])

    # 3. Средний шалфейно-зелёный тубус (X = 0.05)
    create_x_tube("SageBarrel", 1.15, 0.88, 0.72, 0.05, axis_z, mats["sage"])

    # 4. Передняя латунно-янтарная оправа линзы (X = -0.52)
    create_x_tube("FrontBrassRim", 1.10, 0.86, 0.45, -0.52, axis_z, mats["brass"])

    # 5. Оптическая линза внутри оправы
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=72, radius=0.87, depth=0.14,
        location=(-0.48, 0, axis_z), rotation=(0, math.pi / 2.0, 0)
    )
    lens = bpy.context.active_object
    lens.name = "ShaderOpticalLens"
    for poly in lens.data.polygons:
        poly.use_smooth = True
    lens.data.materials.append(mats["lens"])

    # 6. Маркировка STG_01 сверху на шалфейном тубусе
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_STG01"
    txt.data.body = "STG_01"
    txt.data.size = 0.24
    txt.data.extrude = 0.005
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["text"])

    # Изгибаем STG_01 по радиусу шалфейного тубуса (R = 1.15)
    for v in txt.data.vertices:
        x = v.co.x + 0.05
        y = v.co.y
        z = v.co.z + 0.003
        theta = -y / 1.15
        r = 1.15 + z
        v.co.x = x
        v.co.y = -r * math.sin(theta)
        v.co.z = axis_z + r * math.cos(theta)
    txt.data.update()

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_vk_shader_stage()
