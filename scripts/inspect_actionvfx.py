import bpy

for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    print(f'MATERIAL {material.name}')
    for node in material.node_tree.nodes:
        print(f' NODE {node.name} {node.bl_idname}')
        if node.type == 'ATTRIBUTE':
            print(f'  ATTRIBUTE {node.attribute_name}')
        if node.type == 'MATH':
            print(f'  OPERATION {node.operation}')
        for socket in node.inputs:
            if socket.is_linked:
                continue
            if hasattr(socket, 'default_value'):
                print(f'  INPUT {socket.name}: {str(socket.default_value)[:120]}')
        if node.type == 'VALTORGB':
            for element in node.color_ramp.elements:
                print(f'  RAMP {element.position}: {tuple(element.color)}')
    for link in material.node_tree.links:
        print(f' LINK {link.from_node.name}.{link.from_socket.name} -> {link.to_node.name}.{link.to_socket.name}')

for volume in bpy.data.volumes:
    print(f'VOLUME {volume.name} {volume.filepath}')
    try:
        print(' GRIDS', [(grid.name, grid.data_type) for grid in volume.grids])
    except Exception as exc:
        print(' GRID ERROR', exc)
