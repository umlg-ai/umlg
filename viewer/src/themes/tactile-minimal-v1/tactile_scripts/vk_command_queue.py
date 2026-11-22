import bpy
import bmesh
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "vk_command_queue.glb"


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

    mats["tray"] = make_mat("DispenserTray", "#E5DFD5", rough=0.72)
    mats["slot"] = make_mat("SlotDark", "#4A453D", rough=0.85)
    mats["amber"] = make_mat("CardAmber", "#D9A052", rough=0.52)
    mats["sage"] = make_mat("CardSage", "#9BA993", rough=0.52)
    mats["text"] = make_mat("CardLabel", "#2E2E2E", rough=0.5)
    return mats


def create_rounded_box(name, size, location, radius, segments, mat, rot_euler=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rot_euler

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


def build_vk_command_queue():
    clear_scene()
    mats = create_materials()

    # 1. Клиновидный корпус диспенсера (ширина 2.2, длина 3.2, подъём к задней части)
    mesh = bpy.data.meshes.new("QueueDispenser")
    tray = bpy.data.objects.new("QueueDispenser", mesh)
    bpy.context.collection.objects.link(tray)

    bm = bmesh.new()
    # Строим клин: спереди (Y=-1.6) высота 0.42, сзади (Y=1.6) высота 1.25
    w = 1.1
    y0, y1 = -1.6, 1.6
    v0 = bm.verts.new((-w, y0, 0.0))
    v1 = bm.verts.new((w, y0, 0.0))
    v2 = bm.verts.new((w, y1, 0.0))
    v3 = bm.verts.new((-w, y1, 0.0))

    v4 = bm.verts.new((-w, y0, 0.42))
    v5 = bm.verts.new((w, y0, 0.42))
    v6 = bm.verts.new((w, y1, 1.25))
    v7 = bm.verts.new((-w, y1, 1.25))

    bm.faces.new((v3, v2, v1, v0))  # низ
    bm.faces.new((v4, v5, v6, v7))  # наклонный верх
    bm.faces.new((v0, v1, v5, v4))  # перед
    bm.faces.new((v2, v3, v7, v6))  # зад
    bm.faces.new((v3, v0, v4, v7))  # лево
    bm.faces.new((v1, v2, v6, v5))  # право

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.bevel(
        bm, geom=bm.edges[:], offset=0.08, segments=4,
        profile=0.5, affect="EDGES", clamp_overlap=True
    )
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    tray.data.materials.append(mats["tray"])

    # 2. 4 наклонные карточки команд DRAW_01..DRAW_04 с вырезанными пазами
    cards = [
        ("DRAW_01", mats["amber"], -0.75, 0.65),
        ("DRAW_02", mats["amber"], -0.15, 0.82),
        ("DRAW_03", mats["sage"], 0.45, 0.99),
        ("DRAW_04", mats["sage"], 1.05, 1.16),
    ]
    tilt = math.radians(28)  # Наклон карточек назад

    for idx, (label, mat, yc, zc) in enumerate(cards):
        # Вырезаем паз в диспенсере под каждую карточку
        slot = create_rounded_box(
            f"SlotCut_{idx}", (1.76, 0.16, 0.55), (0, yc, zc - 0.12), 0.01, 1, mats["slot"], rot_euler=(tilt, 0, 0)
        )
        b_mod = tray.modifiers.new(name=f"CutSlot_{idx}", type="BOOLEAN")
        b_mod.operation = "DIFFERENCE"
        b_mod.object = slot
        bpy.context.view_layer.objects.active = tray
        bpy.ops.object.modifier_apply(modifier=b_mod.name)
        bpy.data.objects.remove(slot, do_unlink=True)

        # Сама карточка команды
        card = create_rounded_box(
            f"CommandCard_{idx}", (1.68, 0.09, 1.25), (0, yc, zc + 0.18), 0.03, 3, mat, rot_euler=(tilt, 0, 0)
        )

        # Надпись DRAW_0X на верхней кромке карточки
        bpy.ops.object.text_add()
        txt = bpy.context.active_object
        txt.name = f"Lbl_{label}"
        txt.data.body = label
        txt.data.size = 0.15
        txt.data.extrude = 0.004
        txt.data.align_x = "CENTER"
        txt.data.align_y = "CENTER"
        bpy.context.view_layer.objects.active = txt
        bpy.ops.object.convert(target="MESH")
        txt.data.materials.append(mats["text"])

        # Размещаем текст на передней плоскости карточки с учётом её наклона
        txt.rotation_euler = (math.pi / 2.0 + tilt, 0, 0)
        dy = -0.048 * math.cos(tilt) - 0.42 * math.sin(tilt)
        dz = -0.048 * math.sin(tilt) + 0.42 * math.cos(tilt)
        txt.location = (-0.25, yc + dy, zc + 0.18 + dz)

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_vk_command_queue()
