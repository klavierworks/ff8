"""Blender GLTF bridge for the chara.one pipeline.

The Rust `charaone` library does the parse -> format -> construct work and writes, per model,
a `<name>.json` (this module's input contract) plus `<name>_tex_<i>.bin` texture buffers.
This script is Blender-as-exporter only: it rebuilds the scene (armatures, skinned meshes,
the rest-pose bake, materials, actions) from that data and runs `export_scene.gltf`. It is a
faithful port of the addon's `src/export/blender/**` + the hash/index bookkeeping from its
`main.py`, with the parsing/maths removed.

Invoked as:
    blender --background --python charaone_gltf_bridge.py -- <manifest.json> <mode>

Manifest is a JSON list. For mode "field" each entry is {"map", "model", "json", "out_dir"};
for mode "worldmap" each entry is {"name", "json", "gltf"}.
"""

import bpy
import bmesh
import sys
import os
import json
import struct
import hashlib
import shutil
from math import radians
from mathutils import Vector, Euler


# ─── Scene reset ───

def reset_blender():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.textures,
        bpy.data.images,
        bpy.data.armatures,
        bpy.data.actions,
    ):
        for item in list(collection):
            collection.remove(item)


# ─── Textures + materials ───

def load_textures(model, json_dir):
    name = model["name"]
    images = []
    for index in range(model["texture_count"]):
        path = os.path.join(json_dir, f"{name}_tex_{index}.bin")
        with open(path, "rb") as handle:
            data = handle.read()
        width, height = struct.unpack_from("<II", data, 0)
        rgba = data[8:]
        image = bpy.data.images.new(f"{name}-{index}", width, height, alpha=True)
        image.pixels.foreach_set([byte / 255.0 for byte in rgba])
        image.use_fake_user = True
        images.append(image)
    return images


def create_materials(model_name, images, variant):
    materials = []
    for index, image in enumerate(images):
        material = bpy.data.materials.new(f"{model_name}_texture_{index}")
        material.use_nodes = True
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        nodes.clear()

        output_node = nodes.new("ShaderNodeOutputMaterial")
        shader_node = nodes.new("ShaderNodeBsdfPrincipled")
        shader_node.location = (output_node.location[0] - 300, output_node.location[1])
        uv_node = nodes.new("ShaderNodeUVMap")
        uv_node.location = (shader_node.location[0] - 1000, shader_node.location[1])
        texture_node = nodes.new("ShaderNodeTexImage")
        texture_node.image = image
        texture_node.extension = "REPEAT"
        texture_node.location = (shader_node.location[0] - 500, shader_node.location[1])

        if variant == "field":
            # Field UVs are pre-offset within a 128px texture group; the material shifts the
            # sampling row by the texture index so the stacked atlas reads correctly.
            mapping_node = nodes.new("ShaderNodeMapping")
            mapping_node.vector_type = "TEXTURE"
            mapping_node.inputs[1].default_value[1] = index
            mapping_node.location = (texture_node.location[0] - 200, texture_node.location[1])
            links.new(uv_node.outputs[0], mapping_node.inputs[0])
            links.new(mapping_node.outputs[0], texture_node.inputs[0])
        else:
            links.new(uv_node.outputs[0], texture_node.inputs[0])

        links.new(texture_node.outputs["Color"], shader_node.inputs["Base Color"])
        links.new(texture_node.outputs["Alpha"], shader_node.inputs["Alpha"])
        links.new(shader_node.outputs["BSDF"], output_node.inputs["Surface"])
        material.blend_method = "CLIP"
        materials.append(material)
    return materials


# ─── Armature ───

def create_armature(bones, name):
    armature = bpy.data.armatures.new(name=name)
    obj = bpy.data.objects.new(name, armature)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in bones:
        edit_bone = armature.edit_bones.new(bone["name"])
        head = bone["head"]
        tail = bone["tail"]
        edit_bone.head = Vector((-head[0], head[1], head[2]))
        edit_bone.tail = Vector((-tail[0], tail[1], tail[2]))
        if bone["parent"] >= 0:
            edit_bone.parent = armature.edit_bones[bones[bone["parent"]]["name"]]
            edit_bone.use_connect = True
    armature.pose_position = "POSE"
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


# ─── Mesh ───

def create_mesh(mesh_data, model_name, images, variant):
    mesh = bpy.data.meshes.new(name=f"{model_name}_mesh")
    obj = bpy.data.objects.new(model_name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    vertices = [(-v[0], v[1], v[2]) for v in mesh_data["vertices"]]
    mesh.from_pydata(vertices, [], [list(face) for face in mesh_data["faces"]])
    mesh.uv_layers.new(name=f"{model_name}UV")

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    uv_layer = bm.loops.layers.uv[0]
    uvs = mesh_data["uvs"]
    for index, face in enumerate(bm.faces):
        formatted = mesh_data["formatted_faces"][index]
        order = [formatted["vt2"], formatted["vt1"], formatted["vt3"]]
        if len(face.loops) == 4:
            order.append(formatted["vt4"])
        for loop, vt in zip(face.loops, order):
            loop[uv_layer].uv = (uvs[vt][0], uvs[vt][1])
    bmesh.update_edit_mesh(mesh)
    bpy.ops.object.mode_set(mode="OBJECT")

    if images:
        materials = create_materials(model_name, images, variant)
        for material in materials:
            obj.data.materials.append(material)
        for index, polygon in enumerate(mesh.polygons):
            polygon.material_index = mesh_data["formatted_faces"][index]["texture_index"]

    obj.rotation_euler = (0, radians(-90), 0)
    bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return obj


def setup_vertex_groups(mesh_obj, bones, mesh_data):
    for index, bone in enumerate(bones):
        group = mesh_obj.vertex_groups.new(name=bone["name"])
        all_vertices = list(range(len(mesh_obj.data.vertices)))
        group.add(all_vertices, 0.0, "REPLACE")

        local_vertex_index = 0
        for skin in mesh_data["filtered_skins"]:
            if skin["bone_id"] == index:
                vertices_in_range = [
                    v
                    for v in range(local_vertex_index, local_vertex_index + skin["vertex_count"])
                    if v < len(mesh_obj.data.vertices)
                ]
                if vertices_in_range:
                    group.add(vertices_in_range, 1.0, "REPLACE")
            local_vertex_index += skin["vertex_count"]

    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.vertex_group_limit_total(limit=1)


def transform_mesh_vertices(mesh_obj, armature_obj, bones, mesh_data):
    local_vertex_index = 0
    for skin in mesh_data["filtered_skins"]:
        bone_name = bones[skin["bone_id"]]["name"]
        bone_head = Vector(armature_obj.data.bones[bone_name].head_local)
        for offset in range(skin["vertex_count"]):
            vertex_index = local_vertex_index + offset
            if vertex_index < len(mesh_obj.data.vertices):
                vertex = mesh_obj.data.vertices[vertex_index]
                vertex.co = Vector(vertex.co) + bone_head
        local_vertex_index += skin["vertex_count"]


# ─── Animation ───

# Blender 4.4 replaced Action.fcurves with slotted actions — curves now live in a channelbag
# hanging off a layer's strip, keyed by the slot the animated ID binds to — and 5.0 dropped the
# legacy accessor outright. These three keep both APIs working.

def get_action_slot(action):
    if not hasattr(action, "slots"):
        return None
    if action.slots:
        return action.slots[0]
    return action.slots.new(id_type="OBJECT", name="Object")


def get_action_fcurves(action):
    if hasattr(action, "fcurves"):
        return action.fcurves
    layer = action.layers[0] if action.layers else action.layers.new("Layer")
    strip = layer.strips[0] if layer.strips else layer.strips.new(type="KEYFRAME")
    return strip.channelbag(get_action_slot(action), ensure=True).fcurves


def assign_action(armature_obj, action):
    if not armature_obj.animation_data:
        armature_obj.animation_data_create()
    armature_obj.animation_data.action = action
    slot = get_action_slot(action)
    if slot is not None:
        armature_obj.animation_data.action_slot = slot


def create_action(animation):
    if animation["name"] in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions[animation["name"]])
    action = bpy.data.actions.new(name=animation["name"])
    if not animation["keyframes"]:
        return action

    curves = {}
    bone_names = {
        transform["bone_name"]
        for keyframe in animation["keyframes"]
        for transform in keyframe["joint_transforms"]
    }
    fcurves = get_action_fcurves(action)
    for bone_name in bone_names:
        location = [
            fcurves.new(data_path=f'pose.bones["{bone_name}"].location', index=i)
            for i in range(3)
        ]
        rotation = [
            fcurves.new(data_path=f'pose.bones["{bone_name}"].rotation_euler', index=i)
            for i in range(3)
        ]
        curves[bone_name] = {"location": location, "rotation": rotation}

    for keyframe in animation["keyframes"]:
        frame_number = keyframe["frame_index"]
        for transform in keyframe["joint_transforms"]:
            bone_name = transform["bone_name"]
            if bone_name not in curves:
                continue
            if transform["location"] is not None:
                for i, curve in enumerate(curves[bone_name]["location"]):
                    add_keyframe(curve, frame_number, transform["location"][i])
            euler = Euler(transform["rotation"], "YXZ")
            for i, curve in enumerate(curves[bone_name]["rotation"]):
                add_keyframe(curve, frame_number, euler[i])

    for bone_curves in curves.values():
        for curve_list in bone_curves.values():
            for curve in curve_list:
                curve.keyframe_points.sort()
                for point in curve.keyframe_points:
                    point.handle_left_type = "AUTO"
                    point.handle_right_type = "AUTO"
                curve.update()
    action.use_fake_user = True
    return action


def add_keyframe(curve, frame, value):
    curve.keyframe_points.add(1)
    point = curve.keyframe_points[-1]
    point.co = (frame, value)
    point.interpolation = "LINEAR"
    point.handle_left_type = "AUTO"
    point.handle_right_type = "AUTO"


def setup_keyframes(armature_obj, animation, action):
    action.use_fake_user = True
    action.use_cyclic = True
    assign_action(armature_obj, action)
    if animation["keyframes"]:
        action.frame_range = (0, animation["frame_count"])
    action.use_frame_range = True
    for bone in armature_obj.pose.bones:
        bone.rotation_mode = "YXZ"
    for curve in get_action_fcurves(action):
        curve.keyframe_points.sort()
        for point in curve.keyframe_points:
            point.handle_left_type = "AUTO"
            point.handle_right_type = "AUTO"
        curve.update()


# ─── Rest-pose bake (depsgraph) ───

def create_rest_pose(mesh_objects, source_armature, target_armature, frame_number=1):
    original_frame = bpy.context.scene.frame_current
    pose_transforms = capture_pose_transforms(source_armature, frame_number)
    for mesh_obj in mesh_objects:
        apply_deformation_as_rest(mesh_obj)
    apply_transforms_as_rest_pose(target_armature, pose_transforms)
    bpy.context.scene.frame_set(original_frame)


def capture_pose_transforms(armature_obj, frame_number):
    bpy.context.scene.frame_set(frame_number)
    bpy.context.view_layer.update()
    transforms = {}
    world = armature_obj.matrix_world
    for pose_bone in armature_obj.pose.bones:
        transforms[pose_bone.name] = (world.inverted() @ pose_bone.matrix).copy()
    return transforms


def apply_deformation_as_rest(mesh_obj):
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.mode_set(mode="OBJECT")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh_obj.evaluated_get(depsgraph).data
    for index, vertex in enumerate(mesh_obj.data.vertices):
        vertex.co = evaluated.vertices[index].co
    mesh_obj.data.update()


def apply_transforms_as_rest_pose(armature_obj, pose_transforms):
    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.mode_set(mode="EDIT")
    for edit_bone in armature_obj.data.edit_bones:
        if edit_bone.name in pose_transforms:
            edit_bone.matrix = pose_transforms[edit_bone.name]
    bpy.ops.object.mode_set(mode="OBJECT")


# ─── Scene wiring ───

def link_objects(objects):
    for obj in objects:
        if obj.name not in bpy.context.scene.collection.objects:
            bpy.context.scene.collection.objects.link(obj)


def setup_armature_modifier(mesh_obj, armature_obj):
    modifier = mesh_obj.modifiers.new(name="Armature", type="ARMATURE")
    modifier.object = armature_obj
    modifier.use_bone_envelopes = False
    modifier.use_vertex_groups = True


def export_model(model, images):
    name = model["name"]
    variant = model["variant"]
    bones = model["bones"]

    original_armature = create_armature(bones, name + "_original_armature")
    rest_action = create_action(model["rest_animation"])
    setup_keyframes(original_armature, model["rest_animation"], rest_action)

    target_armature = create_armature(bones, name + "_armature")
    original_armature.data.pose_position = "POSE"
    assign_action(original_armature, bpy.data.actions[name + "_action_000"])

    mesh_objects = []
    for index, mesh_data in enumerate(model["meshes"]):
        mesh_obj = create_mesh(mesh_data, f"{name}_mesh_{index}", images, variant)
        setup_vertex_groups(mesh_obj, bones, mesh_data)
        transform_mesh_vertices(mesh_obj, original_armature, bones, mesh_data)
        link_objects([mesh_obj, original_armature])
        mesh_obj.parent = original_armature
        setup_armature_modifier(mesh_obj, original_armature)
        mesh_objects.append(mesh_obj)

    create_rest_pose(mesh_objects, original_armature, target_armature)
    for mesh_obj in mesh_objects:
        link_objects([mesh_obj, target_armature])
        mesh_obj.parent = target_armature
        setup_armature_modifier(mesh_obj, target_armature)

    for action in list(bpy.data.actions):
        if name in action.name:
            bpy.data.actions.remove(action)
    bpy.data.objects.remove(original_armature, do_unlink=True)

    for animation in model["animations"]:
        action = create_action(animation)
        setup_keyframes(target_armature, animation, action)

    target_armature.data.pose_position = "POSE"


def build_and_export(json_path, out_path, export_format):
    reset_blender()
    with open(json_path, "r") as handle:
        model = json.load(handle)
    images = load_textures(model, os.path.dirname(json_path))
    export_model(model, images)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format=export_format,
        use_selection=False,
        export_apply=True,
        export_animations=True,
        export_force_sampling=True,
        export_yup=False,
    )


# ─── Field hash + index bookkeeping ───

def hash_and_index(out_dir, model_name, map_name):
    complete_dir = os.path.join(out_dir, "complete")
    gltf_path = os.path.join(complete_dir, model_name + ".gltf")
    if not os.path.exists(gltf_path):
        return
    with open(gltf_path, "rb") as handle:
        digest = hashlib.sha256(handle.read()).hexdigest()[:8]
    new_name = f"{model_name}_{digest}"

    existing = any(
        new_name in file and file.endswith(".gltf") for file in os.listdir(complete_dir)
    )
    if existing:
        for file in os.listdir(complete_dir):
            if file.startswith(model_name + "."):
                os.remove(os.path.join(complete_dir, file))
        update_index(out_dir, map_name, model_name, new_name + ".gltf")
        return

    for file in os.listdir(complete_dir):
        if file.startswith(model_name + "."):
            shutil.move(
                os.path.join(complete_dir, file),
                os.path.join(complete_dir, file.replace(model_name + ".", new_name + ".")),
            )
    new_path = os.path.join(complete_dir, new_name + ".gltf")
    with open(new_path, "r") as handle:
        gltf = json.load(handle)
    for buffer in gltf.get("buffers", []):
        if buffer.get("uri", "").endswith(".bin"):
            buffer["uri"] = f"{new_name}.bin"
    with open(new_path, "w") as handle:
        json.dump(gltf, handle, indent=2)
    update_index(out_dir, map_name, model_name, new_name + ".gltf")


def update_index(out_dir, map_name, model_name, filename):
    index_path = os.path.join(out_dir, "gltf_index.json")
    if os.path.exists(index_path):
        with open(index_path, "r") as handle:
            index = json.load(handle)
    else:
        index = {}
    index.setdefault(map_name, {})[model_name] = filename
    with open(index_path, "w") as handle:
        json.dump(index, handle, indent=2)


# ─── Entry ───

def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    manifest_path, mode = argv[0], argv[1]
    with open(manifest_path, "r") as handle:
        manifest = json.load(handle)

    total = len(manifest)
    for index, entry in enumerate(manifest):
        try:
            if mode == "field":
                complete = os.path.join(entry["out_dir"], "complete")
                gltf_path = os.path.join(complete, entry["model"] + ".gltf")
                build_and_export(entry["json"], gltf_path, "GLTF_SEPARATE")
                hash_and_index(entry["out_dir"], entry["model"], entry["map"])
                print(f"  + {entry['map']}/{entry['model']}", flush=True)
            else:
                build_and_export(entry["json"], entry["glb"], "GLB")
                print(f"  + {entry['name']}", flush=True)
        except Exception as error:  # noqa: BLE001 - one bad model shouldn't abort the corpus
            label = entry.get("model") or entry.get("name")
            print(f"  skip {label}: {error}", flush=True)

    print("DONE", flush=True)


main()
