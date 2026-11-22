import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "interface.glb"


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

    mats["base"] = make_mat("InterfaceBase", "#E5DFD5", rough=0.72)
    mats["aluminum"] = make_mat("StandoffAl", "#B8BEC4", rough=0.32, metallic=0.88)
    mats["gold"] = make_mat("ContractPinGold", "#D9A052", rough=0.28, metallic=0.85)
    mats["glass"] = make_mat("ContractGlass", "#E8E8E6", rough=0.20, alpha=0.48, transmission=0.78, ior=1.49)
    mats["text"] = make_mat("IntfText", "#2E2E2E", rough=0.5)
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


def build_interface():
    clear_scene()
    mats = create_materials()

    # 1. Нижняя платформа-основание (2.2 x 2.2 x 0.16)
    create_rounded_box("InterfaceBase", (2.2, 2.2, 0.16), (0, 0, 0.08), 0.06, 4, mats["base"])

    # 2. 4 алюминиевые стойки с верхними резьбовыми головками
    offsets = [-0.82, 0.82]
    for ix, x in enumerate(offsets):
        for iy, y in enumerate(offsets):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=24, radius=0.075, depth=0.36, location=(x, y, 0.34)
            )
            post = bpy.context.active_object
            post.name = f"Standoff_{ix}_{iy}"
            for poly in post.data.polygons:
                poly.use_smooth = True
            post.data.materials.append(mats["aluminum"])

            # Головка винта поверх стеклянной пластины
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=24, radius=0.065, depth=0.04, location=(x, y, 0.62)
            )
            cap = bpy.context.active_object
            cap.data.materials.append(mats["aluminum"])

    # 3. Верхняя парящая пластина контракта из матового стекла (2.16 x 2.16 x 0.10)
    create_rounded_box("ContractGlassPlate", (2.16, 2.16, 0.10), (0, 0, 0.56), 0.06, 4, mats["glass"])

    # 4. Две гребёнки позолоченных контактных пинов (спереди и сзади)
    for row in range(2):
        for i in range(10):
            px = -0.45 + i * 0.10
            py_front = -0.82 - row * 0.10
            py_back = 0.82 + row * 0.10
            for side, py in [("Front", py_front), ("Back", py_back)]:
                bpy.ops.mesh.primitive_cylinder_add(
                    vertices=14, radius=0.024, depth=0.14, location=(px, py, 0.56)
                )
                pin = bpy.context.active_object
                pin.data.materials.append(mats["gold"])

    # 5. Маркировка INTF_00 на стеклянной пластине
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = "Label_INTF00"
    txt.data.body = "INTF_00"
    txt.data.size = 0.18
    txt.data.extrude = 0.004
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.location = (-0.52, -0.35, 0.612)
    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mats["text"])

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_interface()
