import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "abstract_class.glb"


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

    mats["base"] = make_mat("AbsBase", "#E5DFD5", rough=0.72)
    mats["recess"] = make_mat("MatrixHole", "#4A453D", rough=0.85)
    mats["sage"] = make_mat("GhostSage", "#9BA993", rough=0.45, alpha=0.55, transmission=0.45)
    mats["glass"] = make_mat("OpenWallGlass", "#E8E8E6", rough=0.14, alpha=0.28, transmission=0.85, ior=1.49)
    mats["wire"] = make_mat("DashedWire", "#2E2E2E", rough=0.85)
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


def build_abstract_class():
    clear_scene()
    mats = create_materials()

    # 1. Основание плинта (2.2 x 2.2 x 0.34)
    create_rounded_box("AbsPlinth", (2.2, 2.2, 0.34), (0, 0, 0.17), 0.08, 4, mats["base"])

    # Сетка 7x7 перфорационных точек (незаполненные слоты реализации)
    for ix in range(-3, 4):
        for iy in range(-3, 4):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=12, radius=0.024, depth=0.015, location=(ix * 0.22, iy * 0.22, 0.342)
            )
            dot = bpy.context.active_object
            dot.data.materials.append(mats["recess"])

    # 2. Разомкнутые стеклянные стенки (только левая, задняя и правая — передняя открыта!)
    create_rounded_box("LeftWall", (0.06, 1.86, 1.48), (-0.90, 0.0, 1.08), 0.02, 2, mats["glass"])
    create_rounded_box("BackWall", (1.86, 0.06, 1.48), (0.0, 0.90, 1.08), 0.02, 2, mats["glass"])
    create_rounded_box("RightWall", (0.06, 1.86, 1.48), (0.90, 0.0, 1.08), 0.02, 2, mats["glass"])

    # 3. Пунктирная передняя рамка (обозначение неполноты/абстрактности)
    for idx in range(7):
        z_seg = 0.44 + idx * 0.22
        create_rounded_box(f"DashFrontL_{idx}", (0.022, 0.022, 0.12), (-0.90, -0.90, z_seg), 0.005, 1, mats["wire"])
        create_rounded_box(f"DashFrontR_{idx}", (0.022, 0.022, 0.12), (0.90, -0.90, z_seg), 0.005, 1, mats["wire"])

        x_seg = -0.78 + idx * 0.26
        create_rounded_box(f"DashTop_{idx}", (0.14, 0.022, 0.022), (x_seg, -0.90, 1.82), 0.005, 1, mats["wire"])

    # 4. Парящие шалфейные фрагменты абстрактных методов внутри
    ghost_blocks = [
        ((-0.25, 0.15, 0.85), (0.55, 0.55, 0.18)),
        ((0.25, -0.10, 1.18), (0.55, 0.55, 0.18)),
        ((-0.10, 0.05, 1.48), (0.48, 0.48, 0.16)),
    ]
    for idx, (loc, sz) in enumerate(ghost_blocks):
        create_rounded_box(f"AbstractMethodSlot_{idx}", sz, loc, 0.03, 2, mats["sage"])

    # 5. Гравировка ABS_CLS на переднем правом углу основания
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_ABS_CLS"
    txt.data.body = "ABS_CLS"
    txt.data.size = 0.16
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = (0.52, -0.98, 0.342)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["wire"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_abstract_class()
