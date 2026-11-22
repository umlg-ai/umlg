import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "stage.glb"


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

    mats["body"] = make_mat("StageEndCap", "#E5DFD5", rough=0.72)
    mats["aluminum"] = make_mat("StageCollarAl", "#B8BEC4", rough=0.35, metallic=0.88)
    mats["glass"] = make_mat("StageChannelGlass", "#E8E8E6", rough=0.18, alpha=0.42, transmission=0.78, ior=1.49)
    mats["chevron"] = make_mat("ChevronDark", "#2E2E2E", rough=0.45)
    mats["recess"] = make_mat("PortDark", "#4A453D", rough=0.85)
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


def add_flat_text(name, text, size, location, mat):
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = name
    txt.data.body = text
    txt.data.size = size
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = location
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mat)
    return txt


def build_stage():
    clear_scene()
    mats = create_materials()

    # 1. Прозрачный акриловый туннель-канал по центру (длина 3.2, ширина 1.15, высота 0.72)
    tunnel = create_rounded_box("StageTunnel", (3.2, 1.15, 0.72), (0, 0, 0.36), 0.14, 4, mats["glass"])
    bore = create_rounded_box("StageBore", (3.4, 0.85, 0.44), (0, 0, 0.36), 0.08, 3, mats["glass"])
    b_mod = tunnel.modifiers.new(name="HollowChannel", type="BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = bore
    bpy.context.view_layer.objects.active = tunnel
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(bore, do_unlink=True)

    # 2. Алюминиевые стяжные муфты на концах канала
    for side, sx in [("Left", -1.42), ("Right", 1.42)]:
        collar = create_rounded_box(f"AlCollar_{side}", (0.28, 1.24, 0.80), (sx, 0, 0.36), 0.10, 4, mats["aluminum"])
        c_hole = create_rounded_box(f"CollarHole_{side}", (0.35, 0.85, 0.44), (sx, 0, 0.36), 0.08, 3, mats["recess"])
        b_c = collar.modifiers.new(name="CutCollar", type="BOOLEAN")
        b_c.operation = "DIFFERENCE"
        b_c.object = c_hole
        bpy.context.view_layer.objects.active = collar
        bpy.ops.object.modifier_apply(modifier=b_c.name)
        bpy.data.objects.remove(c_hole, do_unlink=True)

    # 3. Торцевые пластиковые фланцы-опоры (X = -1.92 и +1.92)
    for side, fx in [("Left", -1.92), ("Right", 1.92)]:
        flange = create_rounded_box(f"EndFlange_{side}", (0.72, 1.22, 0.76), (fx, 0, 0.38), 0.10, 4, mats["body"])
        f_hole = create_rounded_box(f"FlangePort_{side}", (0.80, 0.72, 0.34), (fx, 0, 0.36), 0.06, 3, mats["recess"])
        b_f = flange.modifiers.new(name="CutFlange", type="BOOLEAN")
        b_f.operation = "DIFFERENCE"
        b_f.object = f_hole
        bpy.context.view_layer.objects.active = flange
        bpy.ops.object.modifier_apply(modifier=b_f.name)
        bpy.data.objects.remove(f_hole, do_unlink=True)

        # Маркировка STG_01 на верхних площадках торцов
        add_flat_text(f"Label_STG01_{side}", "STG_01", 0.16, (fx, 0, 0.762), mats["chevron"])

    # 4. 5 направляющих шевронов '>' внутри прозрачного канала (поток слева направо)
    for i in range(5):
        cx = -0.96 + i * 0.48
        add_flat_text(f"FlowChevron_{i}", ">", 0.36, (cx, 0, 0.16), mats["chevron"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_stage()
