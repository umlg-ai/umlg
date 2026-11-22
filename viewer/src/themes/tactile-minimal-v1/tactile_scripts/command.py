import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "command.glb"


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

    mats["pad"] = make_mat("LaunchPad", "#E5DFD5", rough=0.72)
    mats["recess"] = make_mat("TrackGroove", "#B8B0A4", rough=0.85)
    mats["aluminum"] = make_mat("CapsuleBodyAl", "#C8CED4", rough=0.35, metallic=0.82)
    mats["amber_tip"] = make_mat("AmberNose", "#D9A052", rough=0.18, alpha=0.78, transmission=0.65, ior=1.50)
    mats["text"] = make_mat("CmdLabel", "#2E2E2E", rough=0.5)
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


def build_command():
    clear_scene()
    mats = create_materials()

    # 1. Стартовая площадка-рельса (2.3 x 1.35 x 0.24)
    create_rounded_box("CommandPad", (2.3, 1.35, 0.24), (0, 0, 0.12), 0.08, 4, mats["pad"])

    # Ребристые направляющие насечки на площадке
    for i in range(11):
        gx = -0.85 + i * 0.17
        create_rounded_box(f"TrackRib_{i}", (0.06, 0.72, 0.03), (gx, 0.10, 0.245), 0.01, 1, mats["recess"])

    # 2. Родительский узел капсулы 'CommandCapsule' (имя сохранено для анимации движения по X!)
    capsule_root = bpy.data.objects.new("CommandCapsule", None)
    bpy.context.collection.objects.link(capsule_root)
    capsule_root.location = (0, 0.10, 0.68)

    # Хвостовая шестигранная часть корпуса капсулы
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=6, radius=0.40, depth=1.05,
        location=(0.25, 0.10, 0.68), rotation=(0, math.pi / 2.0, 0)
    )
    tail = bpy.context.active_object
    tail.name = "CapsuleTail"
    mod_t = tail.modifiers.new(name="Bevel", type="BEVEL")
    mod_t.width = 0.035
    mod_t.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod_t.name)
    tail.data.materials.append(mats["aluminum"])
    tail.parent = capsule_root
    tail.matrix_parent_inverse = capsule_root.matrix_world.inverted()

    # Головная гранёная янтарная часть капсулы (конусно-шестигранный обтекатель влево/вправо)
    bpy.ops.mesh.primitive_cone_add(
        vertices=6, radius1=0.40, radius2=0.16, depth=0.62,
        location=(-0.58, 0.10, 0.68), rotation=(0, -math.pi / 2.0, 0)
    )
    nose = bpy.context.active_object
    nose.name = "CapsuleAmberHead"
    mod_n = nose.modifiers.new(name="Bevel", type="BEVEL")
    mod_n.width = 0.03
    mod_n.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod_n.name)
    nose.data.materials.append(mats["amber_tip"])
    nose.parent = capsule_root
    nose.matrix_parent_inverse = capsule_root.matrix_world.inverted()

    # 3. Маркировка '<- CMD_EXEC ->' на передней кромке площадки
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_CMD_EXEC"
    txt.data.body = "← CMD_EXEC →"
    txt.data.size = 0.17
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = (0, -0.45, 0.242)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["text"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_command()
