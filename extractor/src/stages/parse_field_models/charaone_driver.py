import sys
import os
import json

import bpy


def export_field(chara_one_path, map_name, out_folder, exporter_module, lib):
    HeaderParser = lib["HeaderParser"]
    ModelParser = lib["ModelParser"]
    FormattedModel = lib["FormattedModel"]
    ConstructedModel = lib["ConstructedModel"]
    BlenderExporter = exporter_module.BlenderExporter
    rename_gltf_with_hash = lib["rename_gltf_with_hash"]

    with open(chara_one_path, "rb") as handle:
        file_data = handle.read()

    file_header = HeaderParser(file_data)
    if file_header.model_count == 0:
        return 0

    file_directory = os.path.dirname(chara_one_path)
    complete_dir = os.path.join(out_folder, "complete")
    os.makedirs(complete_dir, exist_ok=True)

    previous_tim_offset = None
    written = 0
    for model_header in file_header.model_headers:
        model_name = model_header.model_name
        mch_path = os.path.join(file_directory, f"{model_name}.mch")
        if model_name.startswith("d") and not os.path.exists(mch_path):
            continue

        try:
            model = ModelParser(
                header=model_header,
                data=file_data,
                mch_model_file_path=mch_path,
                previous_tim_offset=previous_tim_offset,
            )
            if model.successful_tim_offset is not None:
                previous_tim_offset = model.successful_tim_offset

            formatted = FormattedModel(model=model)
            constructed = ConstructedModel(formatted_model=formatted)

            exporter = BlenderExporter(reset=True)
            exporter.export(constructed)

            bpy.ops.export_scene.gltf(
                filepath=os.path.join(complete_dir, model_name + ".gltf"),
                export_format="GLTF_SEPARATE",
                use_selection=False,
                export_apply=True,
                export_animations=True,
                export_force_sampling=True,
                export_yup=False,
            )
            rename_gltf_with_hash(out_folder, model_name, map_name)
            written += 1
        except Exception as error:  # noqa: BLE001 - one bad model shouldn't abort the corpus
            print(f"  skip {map_name}/{model_name}: {error}")

    return written


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    manifest_path, addon_dir, out_folder = argv[0], argv[1], argv[2]
    sys.path.insert(0, addon_dir)

    from src.parse.headers.__parser import HeaderParser
    from src.parse.model.__parser import ModelParser
    from src.format.formatted_model import FormattedModel
    from src.construct.__constructor import ConstructedModel
    from src.export import __exporter as exporter_module
    from src.main import rename_gltf_with_hash

    lib = {
        "HeaderParser": HeaderParser,
        "ModelParser": ModelParser,
        "FormattedModel": FormattedModel,
        "ConstructedModel": ConstructedModel,
        "rename_gltf_with_hash": rename_gltf_with_hash,
    }

    with open(manifest_path, "r") as handle:
        manifest = json.load(handle)

    total_fields = len(manifest)
    total_models = 0
    for index, entry in enumerate(manifest):
        field, one_path = entry["field"], entry["one"]
        print(f"[{index + 1}/{total_fields}] {field}")
        total_models += export_field(
            one_path, field, out_folder, exporter_module, lib
        )

    print(f"DONE: {total_fields} fields, {total_models} models exported")


main()
