"""Generate Tiny Shooter's original, low-poly concrete landmark.

Run from any directory:
    blender --background --factory-startup --python scripts/build-brutalist-building.py

Blender uses Z-up; the glTF exporter converts to the game's Y-up coordinates.
Invisible collision proxies are exported with a `collider` custom property.
They are hidden by BrutalistBuilding.ts, not included in the visible model.
"""
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/tiny-shooter/brutalist-building.glb"
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, gray, roughness=0.95):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (gray, gray, gray, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = mat.diffuse_color
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


concrete = material("Raw gray concrete", 0.36)
light = material("Exposed slab edges", 0.46)
dark = material("Recessed concrete", 0.22)
glass = material("Deep charcoal window recesses", 0.045, 0.55)
joints = material("Formwork joints and tie holes", 0.13)
visuals = []


def box(name, center, size, mat=concrete, bevel=0.035, collider=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if collider:
        obj["collider"] = True
    else:
        if bevel:
            modifier = obj.modifiers.new("Small chipped concrete edges", "BEVEL")
            modifier.width = bevel
            modifier.segments = 1
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        visuals.append(obj)
    return obj


# Heavy ground-level podium, projecting upper floors and an asymmetric service tower.
box("Podium", (-3, 0, 2.3), (18, 12, 4.6), dark)
box("Cantilever transfer slab", (-3, 0, 5), (20, 14, 0.8), light)
box("Inset upper core", (-3, 0.5, 10), (17, 10, 9.4))
for floor in range(2):
    bottom = 5.4 + floor * 4.6
    box("Solid concrete spandrel", (-3, 0, bottom + 0.9), (18, 12, 1.8))
    box("Deep ribbon window front", (-3, -5.57, bottom + 2.85), (17.8, 0.12, 2.1), glass, 0)
    box("Deep ribbon window back", (-3, 5.57, bottom + 2.85), (17.8, 0.12, 2.1), glass, 0)
    box("Slit windows west", (-11.57, 0, bottom + 2.85), (0.12, 10.8, 2.1), glass, 0)
    box("Overhanging floor slab", (-3, 0, bottom + 4.25), (20, 14, 0.7), light)
    for x in [-11.5, -8.6, -5.7, -2.8, 0.1, 3, 5.5]:
        for y in [-6.2, 6.2]:
            box("Deep vertical sun fin", (x, y, bottom + 2.8), (0.45, 1.6, 2.2), light)
    for y in [-4.8, -1.6, 1.6, 4.8]:
        box("West facade fin", (-12, y, bottom + 2.8), (1.0, 0.4, 2.2), light)

box("Roof terrace floor", (-3, 0, 14.75), (20, 14, 0.3), dark)
for y in [-6.8, 6.8]:
    box("Solid roof parapet", (-3, y, 15.3), (20, 0.4, 1.1), light)
for x in [-12.8, 6.8]:
    box("Side roof parapet", (x, 0, 15.3), (0.4, 13.2, 1.1), light)
box("Roof service block", (-5, 2.5, 16), (6, 4, 1.5))

box("Monolithic stair tower", (8, 1, 11.5), (6, 12, 23))
box("Tower crown", (8, 1, 23.25), (6.5, 12.5, 0.5), light)
# Recessed vertical slits framed by thick concrete cheeks.
for x in [6.6, 9.4]:
    box("Tower vertical slit", (x, -5.035, 14.6), (0.42, 0.08, 14.8), glass, 0)
    for dx in [-0.34, 0.34]:
        box("Tower slit reveal", (x + dx, -5.16, 14.6), (0.22, 0.35, 15), light)
for z in [4.6, 9.2, 13.8, 18.4]:
    box("Tower pour line", (8, -5.015, z), (6, 0.04, 0.045), joints, 0)
    box("Tower side pour line", (11.015, 1, z), (0.04, 12, 0.045), joints, 0)

# A sealed, recessed entrance: scenery, not an accessible interior.
box("Entrance recess", (-3, -6.025, 1.8), (3.8, 0.06, 3.6), glass, 0)
box("Steel double door", (-3, -6.07, 1.5), (2.5, 0.05, 3), dark, 0)
box("Door joint", (-3, -6.105, 1.5), (0.035, 0.03, 3), joints, 0)
for x in [-3.22, -2.78]:
    box("Door pull", (x, -6.18, 1.4), (0.05, 0.1, 0.5), light, 0)
box("Entrance canopy", (-3, -7, 3.85), (6, 3.2, 0.5), light)
for x in [-6.2, 0.2]:
    box("Entrance buttress", (x, -6.35, 2.1), (0.7, 1.1, 4.2))

# Board-form seams and shuttering tie marks add scale without texture downloads.
for z in [0.8, 1.6, 2.4, 3.2, 4.0, 5.9, 6.7, 10.5, 11.3]:
    box("Horizontal formwork seam", (-3, -6.018, z), (17.8, 0.025, 0.022), joints, 0)
for x in [-10.7, -8.5, 1.8, 4.2]:
    for z in [1.15, 2.75, 4.1, 6.3, 10.9]:
        box("Formwork tie recess", (x, -6.036, z), (0.07, 0.025, 0.07), joints, 0)

# Merge by material: five visible meshes, instead of hundreds of draw calls.
material_groups = {
    mat: [obj for obj in visuals if obj.data.materials[0] == mat]
    for mat in [concrete, light, dark, glass, joints]
}
for mat, objects in material_groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    bpy.context.object.name = mat.name

# Closed volumes, matching the major silhouette (canopies stay walk-under).
box("Collider main block", (-3, 0, 7.3), (18, 12, 14.6), collider=True)
box("Collider tower", (8, 1, 11.75), (6.5, 12.5, 23.5), collider=True)
for z in [5, 9.65, 14.25, 15.3]:
    box("Collider projecting slab", (-3, 0, z), (20, 14, 0.8), collider=True)
box("Collider canopy", (-3, -7, 3.85), (6, 3.2, 0.5), collider=True)
for x in [-6.2, 0.2]:
    box("Collider entrance buttress", (x, -6.35, 2.1), (0.7, 1.1, 4.2), collider=True)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT), export_format="GLB", export_extras=True,
    export_cameras=False, export_lights=False, export_animations=False,
)
print(f"Exported {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
