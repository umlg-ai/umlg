import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "vk_framebuffer.glb"


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

    mats["base"] = make_mat("MonitorStand", "#E5DFD5", rough=0.72)
    mats["aluminum"] = make_mat("BezelAl", "#B8BEC4", rough=0.35, metallic=0.88)
    mats["screen"] = make_mat("ScreenGlass", "#E8E8E6", rough=0.18, alpha=0.42, transmission=0.78, ior=1.49)
    mats["screw"] = make_mat("CornerScrew", "#4A453D", rough=0.4, metallic=0.7)
    mats["text"] = make_mat("FbText", "#2E2E2E", rough=0.5)
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


def build_vk_framebuffer():
    clear_scene()
    mats = create_materials()

    # 1. Массивная матовая подставка (3.6 x 1.25 x 0.28)
    create_rounded_box("FbStand", (3.6, 1.25, 0.28), (0, 0, 0.14), 0.08, 4, mats["base"])

    # 2. Алюминиевая рамка-шасси дисплея (3.3 x 0.26 x 2.35)
    frame = create_rounded_box("DisplayBezel", (3.3, 0.26, 2.35), (0, 0.10, 1.42), 0.08, 4, mats["aluminum"])

    # Вырезаем внутреннее окно экрана (2.82 x 0.35 x 1.88)
    window = create_rounded_box("ScreenAperture", (2.82, 0.35, 1.88), (0, 0.10, 1.42), 0.04, 2, mats["screen"])
    b_mod = frame.modifiers.new(name="CutScreen", type="BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = window
    bpy.context.view_layer.objects.active = frame
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(window, do_unlink=True)

    # 3. Полупрозрачная стеклянная панель вывода внутри рамки
    create_rounded_box("FramebufferGlass", (2.86, 0.08, 1.92), (0, 0.10, 1.42), 0.02, 2, mats["screen"])

    # 4. 4 угловых винта на лицевой стороне алюминиевой рамки
    for sx in (-1.48, 1.48):
        for sz in (0.40, 2.44):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=20, radius=0.055, depth=0.03,
                location=(sx, -0.035, sz), rotation=(math.pi / 2.0, 0, 0)
            )
            screw = bpy.context.active_object
            screw.data.materials.append(mats["screw"])

    # 5. Маркировка FB_OUT на передней кромке подставки справа
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_FBOUT"
    txt.data.body = "FB_OUT"
    txt.data.size = 0.16
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = (1.15, -0.45, 0.282)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["text"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_vk_framebuffer()
