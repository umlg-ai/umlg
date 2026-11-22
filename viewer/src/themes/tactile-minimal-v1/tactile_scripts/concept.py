import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "concept.glb"


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

    def make_mat(name, hex_col, rough=0.65, alpha=1.0, transmission=0.0, ior=1.45, metallic=0.0, emission=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = hex_to_rgba(hex_col, alpha)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metallic
        if emission > 0:
            bsdf.inputs["Emission Color"].default_value = hex_to_rgba(hex_col)
            bsdf.inputs["Emission Strength"].default_value = emission
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

    mats["base"] = make_mat("ConceptPedestal", "#E5DFD5", rough=0.72)
    mats["aluminum"] = make_mat("MountCollarAl", "#B8BEC4", rough=0.35, metallic=0.88)
    mats["core"] = make_mat("ConceptCoreAmber", "#D9A052", rough=0.18, emission=1.15)
    mats["glass"] = make_mat("OctaGlass", "#E8E8E6", rough=0.14, alpha=0.38, transmission=0.82, ior=1.50)
    mats["wire"] = make_mat("FacetEdge", "#2E2E2E", rough=0.85)
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


def build_concept():
    clear_scene()
    mats = create_materials()

    # 1. Квадратный пьедестал-основание (1.55 x 1.55 x 0.28) и алюминиевая чаша
    create_rounded_box("ConceptBase", (1.55, 1.55, 0.28), (0, 0, 0.14), 0.08, 4, mats["base"])
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=36, radius=0.42, depth=0.12, location=(0, 0, 0.32)
    )
    collar = bpy.context.active_object
    collar.name = "ConceptCollar"
    for poly in collar.data.polygons:
        poly.use_smooth = True
    collar.data.materials.append(mats["aluminum"])

    # 2. Внешний гранёный октаэдр из прозрачного стекла (8 треугольных граней)
    octa_r = 0.88
    octa_z = 1.25
    mesh = bpy.data.meshes.new("ConceptOctahedron")
    octa = bpy.data.objects.new("ConceptOctahedron", mesh)
    bpy.context.collection.objects.link(octa)
    octa.location = (0, 0, octa_z)

    bm = bmesh.new()
    v_top = bm.verts.new((0, 0, octa_r))
    v_bot = bm.verts.new((0, 0, -octa_r))
    v1 = bm.verts.new((octa_r, 0, 0))
    v2 = bm.verts.new((0, octa_r, 0))
    v3 = bm.verts.new((-octa_r, 0, 0))
    v4 = bm.verts.new((0, -octa_r, 0))

    faces = [
        (v_top, v1, v2), (v_top, v2, v3), (v_top, v3, v4), (v_top, v4, v1),
        (v_bot, v2, v1), (v_bot, v3, v2), (v_bot, v4, v3), (v_bot, v1, v4),
    ]
    for f in faces:
        bm.faces.new(f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()
    octa.data.materials.append(mats["glass"])

    # Тонкая графитовая обводка рёбер октаэдра
    mod_w = octa.modifiers.new("Wireframe", "WIREFRAME")
    mod_w.thickness = 0.008
    mod_w.use_replace = False
    mod_w.material_offset = 1
    octa.data.materials.append(mats["wire"])

    # 3. Внутреннее янтарное сферическое ядро идеи
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=36, ring_count=24, radius=0.34, location=(0, 0, octa_z)
    )
    core = bpy.context.active_object
    core.name = "ConceptAmberCore"
    for poly in core.data.polygons:
        poly.use_smooth = True
    core.data.materials.append(mats["core"])

    # 4. Маркировка CNCPT на переднем углу основания
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_CNCPT"
    txt.data.body = "CNCPT"
    txt.data.size = 0.16
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = (-0.38, -0.62, 0.282)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["wire"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_concept()
