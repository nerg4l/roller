<script>
    import * as THREE from 'three'
    import * as SC from 'svelte-cubed'

    const vertices = [
        [0, 0, 1],
        [0, 0, -1],
    ].flat()

    const sides = 10
    for (let i = 0; i < sides; ++i) {
        const b = (i * Math.PI * 2) / sides
        vertices.push(-Math.cos(b), -Math.sin(b), 0.105 * (i % 2 ? 1 : -1))
    }

    const indices = []
    for (let i = 0; i < sides; ++i) {
        indices.push(0, i+2, ((i+1)%sides)+2)
    }
    for (let i = 0; i < sides; ++i) {
        indices.push(1, ((i+1)%sides)+2, i+2)
    }
    console.log(indices)

    // Create a buffer geometry and set attributes
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Add random colors for each face
    const colors = [];
    for (let i = 0; i < indices.length/2; i += 3) {
        const color = new THREE.Color(0xffffff*i/indices.length/2);
        for (let j = 0; j < 3; j++) {
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);
        }
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Create material
</script>

<SC.Canvas antialias background={new THREE.Color('#1E3E62')}>
    <SC.Mesh geometry={geometry} material={new THREE.MeshBasicMaterial({ vertexColors: true })} />
    <SC.PerspectiveCamera position={[1, 1, 4]}/>
    <SC.OrbitControls enableZoom={false}/>
</SC.Canvas>
