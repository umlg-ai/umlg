import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "class.glb"


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

    mats["base"] = make_mat("ClassPlinth", "#E5DFD5", rough=0.72)
    mats["aluminum"] = make_mat("ClassTrimAl", "#B8BEC4", rough=0.35, metallic=0.88)
    mats["sage"] = make_mat("BlueprintSage", "#9BA993", rough=0.45, alpha=0.82, transmission=0.25)
    mats["glass"] = make_mat("ShowcaseGlass", "#E8E8E6", rough=0.12, alpha=0.32, transmission=0.85, ior=1.49)
    mats["wire"] = make_mat("EdgeOutline", "#2E2E2E", rough=0.85)
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


def build_class():
    clear_scene()
    mats = create_materials()

    # 1. Матовый пластиковый плинт с алюминиевой вставкой (2.2 x 2.2 x 0.34)
    create_rounded_box("ClassBase", (2.2, 2.2, 0.34), (0, 0, 0.17), 0.08, 4, mats["base"])
    create_rounded_box("ClassAlPlate", (1.96, 1.96, 0.04), (0, 0, 0.35), 0.03, 2, mats["aluminum"])

    # 2. Внутренняя 3-слойная шалфейная заготовка-чертёж (мета-шаблон объекта)
    for i in range(3):
        z_pos = 0.62 + i * 0.34
        create_rounded_box(f"BlueprintLayer_{i}", (1.18, 1.18, 0.24), (0, 0, z_pos), 0.05, 3, mats["sage"])

    # 3. Прозрачный стеклянный колпак-витрина с реальной толщиной стенок
    hood = create_rounded_box("GlassShowcase", (1.92, 1.92, 1.55), (0, 0, 1.14), 0.06, 3, mats["glass"])
    cavity = create_rounded_box("ShowcaseCavity", (1.80, 1.80, 1.52), (0, 0, 1.08), 0.04, 2, mats["glass"])
    b_mod = hood.modifiers.new(name="HollowHood", type="BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = cavity
    bpy.context.view_layer.objects.active = hood
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(cavity, do_unlink=True)

    # Тонкий контурный каркас витрины для чёткой читаемости в M-мире
    w_mesh = bpy.data.meshes.new("ShowcaseFrame")
    w_obj = bpy.data.objects.new("ShowcaseFrame", w_mesh)
    bpy.context.collection.objects.link(w_obj)
    w_obj.location = (0, 0, 1.14)
    bm_w = bmesh.new()
    bmesh.ops.create_cube(bm_w, size=1.0)
    bmesh.ops.scale(bm_w, vec=(1.925, 1.925, 1.555), verts=bm_w.verts)
    bm_w.to_mesh(w_mesh)
    bm_w.free()
    mod_w = w_obj.modifiers.new("Wireframe", "WIREFRAME")
    mod_w.thickness = 0.012
    mod_w.use_replace = True
    w_obj.data.materials.append(mats["wire"])

    # 4. Гравировка CLS_DEF на передней площадке плинта
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_CLS_DEF"
    txt.data.body = "CLS_DEF"
    txt.data.size = 0.16
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = (-0.55, -0.98, 0.342)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["wire"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_class()
