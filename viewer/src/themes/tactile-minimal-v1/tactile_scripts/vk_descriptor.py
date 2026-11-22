import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "vk_descriptor.glb"


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

    mats["body"] = make_mat("CardBody", "#E5DFD5", rough=0.72)
    mats["recess"] = make_mat("SlotWell", "#4A453D", rough=0.85)
    mats["gold"] = make_mat("ContactGold", "#D9A052", rough=0.28, metallic=0.85)
    mats["amber"] = make_mat("SwitchAmber", "#D9A052", rough=0.52)
    mats["sage"] = make_mat("SwitchSage", "#9BA993", rough=0.52)
    mats["text"] = make_mat("CardText", "#2E2E2E", rough=0.5)
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


def build_vk_descriptor():
    clear_scene()
    mats = create_materials()

    # 1. Основная плата картриджа (2.4 x 2.8 x 0.28)
    card = create_rounded_box("DescriptorCard", (2.4, 2.8, 0.28), (0, 0.15, 0.14), 0.08, 4, mats["body"])

    # 2. Три паза под DIP-переключатели справа (X = 0.65)
    switch_y = [-0.55, 0.15, 0.85]
    switch_configs = [
        (mats["amber"], -0.10),
        (mats["sage"], 0.10),
        (mats["amber"], -0.10),
    ]

    for idx, (y_center, (sw_mat, offset_y)) in enumerate(zip(switch_y, switch_configs)):
        well = create_rounded_box(f"SwitchWell_{idx}", (0.52, 0.28, 0.14), (0.65, y_center, 0.25), 0.02, 2, mats["recess"])
        b_mod = card.modifiers.new(name=f"CutWell_{idx}", type="BOOLEAN")
        b_mod.operation = "DIFFERENCE"
        b_mod.object = well
        bpy.context.view_layer.objects.active = card
        bpy.ops.object.modifier_apply(modifier=b_mod.name)
        bpy.data.objects.remove(well, do_unlink=True)

        # Ползунок внутри паза
        create_rounded_box(
            f"BindingSwitch_{idx}", (0.24, 0.22, 0.14), (0.65 + offset_y, y_center, 0.25), 0.02, 2, sw_mat
        )

    # 3. Выступ ножевого разъёма спереди (Y = -1.42)
    create_rounded_box("EdgeConnectorTongue", (1.65, 0.36, 0.12), (0, -1.40, 0.10), 0.02, 2, mats["body"])

    # 10 позолоченных ламелей разъёма
    for i in range(10):
        px = -0.675 + i * 0.15
        create_rounded_box(f"GoldContact_{i}", (0.09, 0.32, 0.135), (px, -1.41, 0.10), 0.008, 1, mats["gold"])

    # 4. Маркировка DESC_SET на левой части платы
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_DESC_SET"
    txt.data.body = "DESC_SET"
    txt.data.size = 0.24
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = (-0.45, 0.15, 0.282)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["text"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_vk_descriptor()
