import zipfile
import os
import json
import shutil

def sync_public_boot_scripts(base_dir, addon_dir):
    """Keep newtab boot scripts in firefox_addon/ in sync with public/ (source of truth)."""
    public_dir = os.path.join(base_dir, "public")
    for name in ("newtab-head-prefill.js", "newtab-head-theme.js"):
        src = os.path.join(public_dir, name)
        dst = os.path.join(addon_dir, name)
        if os.path.exists(src):
            shutil.copy2(src, dst)

def create_xpi(source_dir, output_filename):
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Exclude hidden directories
            dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', '.idea', '.vscode']]

            for file in files:
                # Exclude build artifacts and system files
                if file.endswith(('.xpi', '.zip', '.DS_Store')):
                    continue

                file_path = os.path.join(root, file)
                # Calculate the relative path for the archive
                arcname = os.path.relpath(file_path, source_dir)
                # FORCE forward slashes for ZIP compatibility (critical for AMO)
                arcname = arcname.replace(os.path.sep, '/')
                zipf.write(file_path, arcname)
    print(f"Successfully created {output_filename}")

# Paths
base_dir = os.path.dirname(os.path.abspath(__file__))
addon_dir = os.path.join(base_dir, "firefox_addon")

if __name__ == "__main__":
    sync_public_boot_scripts(base_dir, addon_dir)
    manifest_path = os.path.join(addon_dir, "manifest.json")
    with open(manifest_path, encoding="utf-8") as f:
        version = json.load(f)["version"]
    output_xpi = os.path.join(base_dir, f"terminal-tab-{version}.xpi")
    if os.path.exists(output_xpi):
        os.remove(output_xpi)
    create_xpi(addon_dir, output_xpi)
