import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "vk_pipeline.glb"


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

    def make_mat(name, hex_col, rough=0.65, alpha=1.0, transmission=0.0, metallic=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = hex_to_rgba(hex_col, alpha)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metallic
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = transmission
        if alpha < 1.0:
            if hasattr(m, "blend_method"):
                m.blend_method = "BLEND"
            if "Alpha" in bsdf.inputs:
                bsdf.inputs["Alpha"].default_value = alpha
        return m

    mats["body"] = make_mat("RailBody", "#E5DFD5", rough=0.72)
    mats["aluminum"] = make_mat("RailSideAl", "#B8BEC4", rough=0.35, metallic=0.88)
    mats["amber"] = make_mat("StageAmber", "#D9A052", rough=0.45)
    mats["sage"] = make_mat("StageSage", "#9BA993", rough=0.45)
    mats["dark"] = make_mat("PortDark", "#2E2E2E", rough=0.8)
    mats["window"] = make_mat("AcrylicWindow", "#E8E8E6", rough=0.18, alpha=0.35, transmission=0.72)
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


def build_vk_pipeline():
    clear_scene()
    mats = create_materials()

    # 1. Основная длинная рельса конвейера (5.6 x 1.2 x 0.42)
    rail = create_rounded_box("PipelineRail", (5.6, 1.2, 0.42), (0, 0, 0.21), 0.08, 4, mats["body"])

    # 2. Вырезаем продольный оптический канал сверху
    channel = create_rounded_box("OpticChannel", (4.8, 0.48, 0.22), (0, 0, 0.36), 0.03, 2, mats["dark"])
    b_mod = rail.modifiers.new(name="CutChannel", type="BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = channel
    bpy.context.view_layer.objects.active = rail
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(channel, do_unlink=True)

    # 3. Алюминиевая боковая шина с направляющим пазом (со стороны -Y)
    create_rounded_box("SideAlBus", (5.4, 0.14, 0.28), (0, -0.58, 0.20), 0.03, 2, mats["aluminum"])
    create_rounded_box("SideSlot", (5.1, 0.05, 0.08), (0, -0.64, 0.20), 0.01, 1, mats["dark"])

    # 4. Внутренние блоки этапов конвейера (2 шалфейных + 2 янтарных)
    stage_configs = [
        (-1.6, mats["sage"]),
        (-0.55, mats["sage"]),
        (0.55, mats["amber"]),
        (1.6, mats["amber"]),
    ]
    for idx, (sx, mat) in enumerate(stage_configs):
        create_rounded_box(f"PipelineStage_{idx}", (0.85, 0.42, 0.14), (sx, 0, 0.31), 0.02, 2, mat)

    # 5. Прозрачная акриловая крышка поверх канала
    create_rounded_box("ChannelCover", (4.76, 0.46, 0.04), (0, 0, 0.40), 0.01, 2, mats["window"])

    # 6. Торцевой USB-C порт слева (X = -2.8)
    create_rounded_box("InputPort", (0.06, 0.36, 0.14), (-2.80, 0, 0.20), 0.04, 3, mats["dark"])

    # 7. Маркировка 'VkPipeline' на передней фаске рельсы
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_VkPipeline"
    txt.data.body = "VkPipeline"
    txt.data.size = 0.22
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = (-1.1, -0.42, 0.422)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["dark"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_vk_pipeline()
