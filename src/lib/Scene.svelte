<script lang="ts">
    import {T, useTask} from '@threlte/core'
    import * as THREE from 'three'
    import {TrackballControls} from '@threlte/extras'

    const numbers = [0, 1, 2, 5, 8, 3, 4, 9, 6, 7]
    const ones = numbers.map(x => String(x))
    const tens = numbers.map(x => String(x * 10).padEnd(2, '0'))
    const sides = ones.length
    const step = 256
    const edgeOffset = 0.105

    const textScale = 1.25

    const calcSideVertex = (i: number) => {
        const b = (i * Math.PI * 2) / sides
        return [-Math.cos(b), -Math.sin(b), edgeOffset * (i % 2 ? 1 : -1)]
    }

    const createTexture = (numbers: string[]) => {
        let c = document.createElement('canvas')
        c.width = step * sides
        c.height = step
        const ctx = c.getContext('2d')
        if (!ctx) {
            return
        }
        ctx.fillStyle = '#c0c'
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.font = '128px Creepster'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#0f0'
        ctx.textBaseline = 'middle'
        for (let i = 0; i < sides; i++) {
            let text = numbers[i]
            ctx.fillText(text, step * 0.5 + step * i, step * 0.5)
            if (numbers[i] === '6' || numbers[i] === '9') {
                ctx.fillText('_', step * 0.5 + step * i, step * 0.6)
            }
        }

        let texture = new THREE.CanvasTexture(c)
        texture.colorSpace = THREE.SRGBColorSpace
        return texture
    }

    let baseRotation = (-Math.PI/sides)
    let rotation = 0
    useTask((delta) => {
        rotation += (delta * 0.5)
    })
</script>

<T.PerspectiveCamera
        makeDefault
        position={[0, 0, 5]}
        on:create={({ ref }) => {
            ref.lookAt(0, 1, 0)
        }}
>
    <TrackballControls enabled={false}/>
</T.PerspectiveCamera>

<T.AmbientLight
        args={['#f0f400']}
        castShadow
/>

<T.DirectionalLight
        position={[0, 0, 5]}
        castShadow
/>

<T.Color attach="background" args={['#222']}/>
<T.Fog
        attach="fog"
        color="#222"
        near={4}
        far={5.25}
/>

<T.Mesh
        rotation={[Math.PI/2+0.55, Math.PI, baseRotation+rotation]}
        position={[1.25, 0, 0]}
        castShadow
>
    {#each ones as _, i}
        <T.Mesh rotation={[0, 0, ((Math.PI * 2 * (i+3))/(sides / 2))]} castShadow>
            <T.BufferGeometry on:create={({ref}) => {
                ref.setAttribute('position', new THREE.Float32BufferAttribute([
                    0, 0, 1.15 * (i % 2 ? -1 : 1),
                    ...calcSideVertex(i % 2 ? 0 : 1),
                    ...calcSideVertex(i % 2 ? 1 : 2),
                    ...calcSideVertex(i % 2 ? 2 : 3),
                ], 3))
                ref.setIndex(i % 2 ? [
                    2, 1, 0,
                    3, 2, 0,
                ] : [
                    0, 1, 2,
                    0, 2, 3,
                ])
                ref.computeVertexNormals()
                ref.setAttribute('uv', new THREE.Float32BufferAttribute([
                    (0.5 + i) / sides, 1.15 * textScale,
                    (0 + i) / sides, edgeOffset * 2 * textScale,
                    (0.5 + i) / sides, 0,
                    (1 + i) / sides, edgeOffset * 2 * textScale,
                ], 2))
            }}></T.BufferGeometry>
            <T.MeshStandardMaterial metalness={0.75} roughness={0.35} map={createTexture(ones)}/>
        </T.Mesh>
    {/each}
</T.Mesh>

<T.Mesh
        rotation={[Math.PI/2+0.55, Math.PI, baseRotation-rotation]}
        position={[-1.25, 0, 0]}
        castShadow
>
    {#each tens as _, i}
        <T.Mesh rotation={[0, 0, ((Math.PI * 2 * (i+3))/(sides / 2))]} castShadow>
            <T.BufferGeometry on:create={({ref}) => {
                ref.setAttribute('position', new THREE.Float32BufferAttribute([
                    0, 0, 1.15 * (i % 2 ? -1 : 1),
                    ...calcSideVertex(i % 2 ? 0 : 1),
                    ...calcSideVertex(i % 2 ? 1 : 2),
                    ...calcSideVertex(i % 2 ? 2 : 3),
                ], 3))
                ref.setIndex(i % 2 ? [
                    2, 1, 0,
                    3, 2, 0,
                ] : [
                    0, 1, 2,
                    0, 2, 3,
                ])
                ref.computeVertexNormals()
                ref.setAttribute('uv', new THREE.Float32BufferAttribute([
                    (0.5 + i) / sides, 1.15 * textScale,
                    (0 + i) / sides, edgeOffset * 2 * textScale,
                    (0.5 + i) / sides, 0,
                    (1 + i) / sides, edgeOffset * 2 * textScale,
                ], 2))
            }}></T.BufferGeometry>
            <T.MeshStandardMaterial metalness={0.75} roughness={0.35} map={createTexture(tens)}/>
        </T.Mesh>
    {/each}
</T.Mesh>
