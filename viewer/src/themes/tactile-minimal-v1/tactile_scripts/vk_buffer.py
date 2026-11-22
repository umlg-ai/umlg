import bpy
import math
import os

EXPORT_DIR = os.path.expanduser("~/Desktop")
FILE_NAME = "vk_buffer.glb"


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for font in list(bpy.data.fonts):
        if font.users == 0:
            bpy.data.fonts.remove(font)


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

    mats["cap"] = make_mat("MatteCap", "#E5DFD5", rough=0.72)
    mats["recess"] = make_mat("CapRecess", "#B8B0A4", rough=0.85)
    mats["amber"] = make_mat("CmdAmber", "#D9A052", rough=0.52)
    mats["sage"] = make_mat("CmdSage", "#9BA993", rough=0.52)
    mats["sleeve"] = make_mat(
        "FrostedSleeve", "#E8E8E6", rough=0.25, alpha=0.35, transmission=0.68, ior=1.49
    )
    mats["brand_outer"] = make_mat("BrandOuter", "#2E2E2E", rough=0.45)
    mats["brand_inner"] = make_mat("BrandInner", "#3E3A34", rough=0.65)
    return mats


def add_bevel(obj, width=0.04, segments=4):
    mod = obj.modifiers.new(name="Bevel", type="BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(30)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def create_x_cylinder(name, radius, length, location, mat, segments=72):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=segments,
        radius=radius,
        depth=length,
        location=location,
        rotation=(0, math.pi / 2.0, 0),
    )
    obj = bpy.context.active_object
    obj.name = name
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.materials.append(mat)
    return obj


def create_text_mesh(name, body, size, mat, extrude=0.004, align_x="CENTER", align_y="CENTER"):
    bpy.ops.object.text_add()
    txt = bpy.context.active_object
    txt.name = name
    txt.data.body = body
    txt.data.size = size
    txt.data.extrude = extrude
    txt.data.align_x = align_x
    txt.data.align_y = align_y

    bold_font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    if os.path.exists(bold_font_path) and body in ("VkBuffer", ">", ">_"):
        txt.data.font = bpy.data.fonts.load(bold_font_path)

    bpy.context.view_layer.objects.active = txt
    bpy.ops.object.convert(target="MESH")
    txt.data.materials.append(mat)
    return txt


def wrap_mesh_around_x_cylinder(obj, radius, offset_x=0.0, arc_y=0.0, radial_z=0.0):
    """Изгибает плоский меш вокруг цилиндра вдоль оси X для нормального чтения снаружи."""
    obj.location = (0, 0, 0)
    mesh = obj.data
    for v in mesh.vertices:
        x = v.co.x + offset_x
        y = v.co.y + arc_y
        z = v.co.z + radial_z
        theta = -y / radius  # Знак минус разворачивает текст наружу
        r = radius + z
        v.co.x = x
        v.co.y = -r * math.sin(theta)
        v.co.z = r * math.cos(theta)
    mesh.update()


def build_vkbuffer():
    clear_scene()
    mats = create_materials()

    sleeve_len = 4.6
    sleeve_outer_r = 1.48
    sleeve_inner_r = 1.35

    cap_len = 1.18
    cap_outer_r = 1.62

    # 1. Полупрозрачная матовая гильза
    sleeve = create_x_cylinder("FrostedSleeve", sleeve_outer_r, sleeve_len, (0, 0, 0), mats["sleeve"], 96)
    hole = create_x_cylinder("SleeveHole", sleeve_inner_r, sleeve_len + 0.2, (0, 0, 0), mats["sleeve"], 96)
    b_mod = sleeve.modifiers.new(name="Hollow", type="BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = hole
    bpy.context.view_layer.objects.active = sleeve
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(hole, do_unlink=True)

    # 2. Симметричные матовые заглушки (Левая и Правая) с шевронами > -> >
    cap_x_offset = (sleeve_len / 2.0) + (cap_len / 2.0) - 0.08
    for side, sign in [("Left", -1), ("Right", 1)]:
        cap = create_x_cylinder(
            f"EndCap_{side}", cap_outer_r, cap_len, (sign * cap_x_offset, 0, 0), mats["cap"], 96
        )
        add_bevel(cap, width=0.11, segments=5)

        # Оба шеврона смотрят в сторону +X (поток слева направо: > -> >)
        chev = create_text_mesh(f"Chevron_{side}", ">", 0.95, mats["recess"], extrude=0.06)
        chev.rotation_euler = (math.pi / 2.0, 0, math.pi / 2.0)
        chev.location = (sign * (cap_x_offset + cap_len / 2.0 - 0.02), 0, 0)
        b_chev = cap.modifiers.new(name="CutChevron", type="BOOLEAN")
        b_chev.operation = "DIFFERENCE"
        b_chev.object = chev
        bpy.context.view_layer.objects.active = cap
        bpy.ops.object.modifier_apply(modifier=b_chev.name)
        bpy.data.objects.remove(chev, do_unlink=True)

    # 3. Три насечки-ключа выравнивания на правой заглушке сверху
    for i in range(3):
        gx = cap_x_offset - 0.14 + i * 0.14
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(gx, 0, cap_outer_r - 0.015))
        groove = bpy.context.active_object
        groove.name = f"AlignmentKey_{i}"
        groove.scale = (0.045, 0.36, 0.05)
        bpy.ops.object.transform_apply(scale=True)
        groove.data.materials.append(mats["recess"])

    # 4. Внутренние модули памяти (8 округлых шайб)
    slots = [
        ("CMD_001", 0.96, mats["amber"], True),
        ("", 0.44, mats["amber"], False),
        ("", 0.44, mats["amber"], False),
        ("", 0.44, mats["amber"], False),
        ("", 0.44, mats["sage"], False),
        ("CMD_002", 0.44, mats["sage"], False),
        ("CMD_003", 0.44, mats["sage"], False),
        ("CMD_004", 0.44, mats["sage"], False),
    ]
    gap = 0.035
    total_w = total_w = sum(s[1] for s in slots) + gap * (len(slots) - 1)
    cur_x = -total_w / 2.0
    puck_r = sleeve_inner_r - 0.04

    for idx, (label, w, mat, is_first) in enumerate(slots):
        cx = cur_x + w / 2.0
        puck = create_x_cylinder(f"MemoryPuck_{idx}", puck_r, w, (cx, 0, 0), mat, segments=64)
        add_bevel(puck, width=0.07, segments=4)

        if is_first:
            prompt_txt = create_text_mesh("PuckPrompt", ">_", 0.24, mats["brand_inner"], extrude=0.002)
            wrap_mesh_around_x_cylinder(prompt_txt, puck_r, offset_x=cx - 0.16, arc_y=-0.12, radial_z=0.004)

            cmd1_txt = create_text_mesh("PuckCMD001", "CMD_001", 0.13, mats["brand_inner"], extrude=0.002)
            wrap_mesh_around_x_cylinder(cmd1_txt, puck_r, offset_x=cx - 0.06, arc_y=0.18, radial_z=0.004)
        elif label:
            v_txt = create_text_mesh(f"Puck_{label}", label, 0.11, mats["brand_inner"], extrude=0.002)
            v_txt.rotation_euler = (0, 0, math.pi / 2.0)
            bpy.context.view_layer.objects.active = v_txt
            bpy.ops.object.transform_apply(rotation=True)
            wrap_mesh_around_x_cylinder(v_txt, puck_r, offset_x=cx, arc_y=0.14, radial_z=0.004)

        cur_x += w + gap

    # 5. Внешний логотип 'VkBuffer', читаемый снаружи на лицевой дуге гильзы
    brand = create_text_mesh("OuterBrandVkBuffer", "VkBuffer", 0.72, mats["brand_outer"], extrude=0.005)
    wrap_mesh_around_x_cylinder(brand, sleeve_outer_r, offset_x=-0.05, arc_y=0.22, radial_z=0.004)

    os.makedirs(EXPORT_DIR, exist_ok=True)
    if bpy.context.view_layer.objects:
        bpy.context.view_layer.objects.active = bpy.context.view_layer.objects

    export_path = os.path.join(EXPORT_DIR, FILE_NAME)
    bpy.ops.export_scene.gltf(filepath=export_path, export_format="GLB")
    print(f"Exported: {export_path}")


build_vkbuffer()
