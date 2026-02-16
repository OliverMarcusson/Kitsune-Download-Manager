import os
from PIL import Image

source_path = "/home/oliver/src/Rust/Kitsune-DM/extension/icons/KitsuneDM-full.png"
output_dir = "/home/oliver/src/Rust/Kitsune-DM/extension/icons/processed"

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Load image
img = Image.open(source_path).convert("RGBA")
datas = img.getdata()

# Remove white background
# Fuzz factor: pixels with R, G, B > 240 are considered white
new_data = []
for item in datas:
    if item[0] > 240 and item[1] > 240 and item[2] > 240:
        new_data.append((255, 255, 255, 0))
    else:
        new_data.append(item)

img.putdata(new_data)
img.save(os.path.join(output_dir, "icon_transparent.png"), "PNG")

# Generate sizes
sizes = [16, 32, 48, 128, 256, 512]
png_files = {}

for size in sizes:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    filename = f"icon{size}.png"
    if size == 256:
        filename = "linux_icon.png"
    path = os.path.join(output_dir, filename)
    resized.save(path, "PNG")
    png_files[size] = path

# Generate ICO (Windows)
# ICO usually contains 16, 32, 48, 256
ico_img = Image.open(os.path.join(output_dir, "icon_transparent.png"))
ico_sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
ico_path = os.path.join(output_dir, "windows_icon.ico")
ico_img.save(ico_path, format="ICO", sizes=ico_sizes)

print(f"Icons generated in {output_dir}")
