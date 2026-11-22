import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "vk_vertex_layout.glb"


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

    def make_mat(name, hex_col, rough=0.65, metallic=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = hex_to_rgba(hex_col)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metallic
        return m

    mats["body"] = make_mat("MatteBody", "#E5DFD5", rough=0.72)
    mats["recess"] = make_mat("DarkRecess", "#5C574F", rough=0.80)
    mats["gold"] = make_mat("GoldPin", "#D9A052", rough=0.28, metallic=0.85)
    mats["aluminum"] = make_mat("AnodizedAl", "#B8BEC4", rough=0.35, metallic=0.88)
    mats["text"] = make_mat("EngravedText", "#3E3A34", rough=0.65)
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


def add_flat_label(name, text, size, location, mat, rot_z=0.0):
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = name
    txt.data.body = text
    txt.data.size = size
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = location
    txt.rotation_euler = (0, 0, rot_z)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mat)
    return txt


def build_vk_vertex_layout():
    clear_scene()
    mats = create_materials()

    # 1. Основная плита сокета (3.2 x 3.2 x 0.36)
    base = create_rounded_box("SocketPlate", (3.2, 3.2, 0.36), (0, 0, 0.18), 0.12, 4, mats["body"])

    # 2. Внутреннее углубление под матрицу пинов (вырезаем через Boolean)
    cavity = create_rounded_box("SocketCavity", (1.65, 1.65, 0.22), (0, 0, 0.31), 0.04, 2, mats["recess"])
    b_mod = base.modifiers.new(name="CutCavity", type="BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = cavity
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(cavity, do_unlink=True)

    # Тёмная подложка внутри шахты пинов
    create_rounded_box("SocketFloor", (1.60, 1.60, 0.04), (0, 0, 0.21), 0.01, 1, mats["recess"])

    # 3. Сетка 6x6 позолоченных контактных пинов
    for ix in range(6):
        for iy in range(6):
            px = -0.60 + ix * 0.24
            py = -0.60 + iy * 0.24
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=16, radius=0.042, depth=0.22, location=(px, py, 0.31)
            )
            pin = bpy.context.active_object
            pin.name = f"GoldPin_{ix}_{iy}"
            for poly in pin.data.polygons:
                poly.use_smooth = True
            pin.data.materials.append(mats["gold"])

    # 4. Угловые винты крепления
    for cx in (-1.32, 1.32):
        for cy in (-1.32, 1.32):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=20, radius=0.08, depth=0.03, location=(cx, cy, 0.365)
            )
            screw = bpy.context.active_object
            screw.data.materials.append(mats["aluminum"])

    # 5. Техническая маркировка на бортах плиты
    add_flat_label("Lbl_VTX00", "VTX_00", 0.16, (-1.15, -0.45, 0.362), mats["text"], rot_z=math.pi / 4)
    add_flat_label("Lbl_VTX01", "VTX_01", 0.16, (-0.35, -1.25, 0.362), mats["text"], rot_z=math.pi / 4)
    add_flat_label("Lbl_LOC01", "LOC_01", 0.16, (0.95, -1.05, 0.362), mats["text"], rot_z=math.pi / 4)

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_vk_vertex_layout()
