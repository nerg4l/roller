<script lang="ts">
    import {T, useTask} from '@threlte/core'
    import * as THREE from 'three'
    import {interactivity, TrackballControls} from '@threlte/extras'

    interactivity()

    const numbers = [0, 1, 2, 5, 8, 3, 4, 9, 6, 7]
    const ones = numbers.map(x => String(x))
    const tens = numbers.map(x => String(x * 10).padStart(2, '0'))
    const sides = ones.length
    const step = 256
    const edgeOffset = 0.105

    const textScale = 1.25

    const calcSideVertex = (i: number, sign: number) => {
        const b = (i * Math.PI * 2) / sides
        return [-Math.cos(b), -Math.sin(b), edgeOffset * sign]
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
            ctx.fillText(numbers[i], step * 0.5 + step * i, step * 0.5)
            if (numbers[i] === '6' || numbers[i] === '9') {
                ctx.fillText('_', step * 0.5 + step * i, step * 0.6)
            }
        }

        let texture = new THREE.CanvasTexture(c)
        texture.colorSpace = THREE.SRGBColorSpace
        return texture
    }

    let baseRotation = -Math.PI / 2 // right angle
    let onesRotation = [Math.PI/2+0.55, Math.PI, 0]
    let tensRotation = [Math.PI/2+0.55, Math.PI, 0]
    let state: 'rolling' | '-' = '-'

    let randoms = Array.apply(1, Array(onesRotation.length + tensRotation.length)) as number[]

    useTask((delta) => {
        if (state === 'rolling') {
            onesRotation = onesRotation.map((_, i) => {
                return onesRotation[0] + delta * ((6 * (randoms[i] - 0.5)) + 7)
            })
            tensRotation = tensRotation.map((_, i) => {
                return tensRotation[0] + delta * ((6 * (randoms[i+3] - 0.5)) + 7)
            })
        }
    })

    const roll = () => {
        state = 'rolling'
        setTimeout(() => {
            state = '-'
        }, 1_000)
        randoms = randoms.map(() => Math.random())
        setTimeout(() => {
            randoms = randoms.map(() => Math.random())
        }, 200)
    }
</script>

<T.PerspectiveCamera
        makeDefault
        position={[0, 0, 5]}
        on:create={({ ref }) => {
            ref.lookAt(0, 1, 0)
        }}
>
    <TrackballControls/>
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
        on:click={roll}
        rotation={onesRotation}
        position={[1.25, 0, 0]}
        castShadow
>
    {#each ones as _, i}
        <T.Mesh rotation={[0, 0, baseRotation + ((Math.PI * 2 * i)/sides)]} castShadow>
            <T.BufferGeometry on:create={({ref}) => {
                ref.setAttribute('position', new THREE.Float32BufferAttribute([
                    0, 0, 1.15 * (i % 2 ? -1 : 1),
                    ...calcSideVertex(-1, i % 2 ? -1 : 1),
                    ...calcSideVertex(0, i % 2 ? 1 : -1),
                    ...calcSideVertex(1, i % 2 ? -1 : 1),
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
                    ((i % 2 ? 1 : 0) + i) / sides, edgeOffset * 2 * textScale,
                    (0.5 + i) / sides, 0,
                    ((i % 2 ? 0 : 1) + i) / sides, edgeOffset * 2 * textScale,
                ], 2))
            }}></T.BufferGeometry>
            <T.MeshStandardMaterial metalness={0.75} roughness={0.35} map={createTexture(ones)}/>
        </T.Mesh>
    {/each}
</T.Mesh>

<T.Mesh
        on:click={roll}
        rotation={tensRotation}
        position={[-1.25, 0, 0]}
        castShadow
>
    {#each tens as _, i}
        <T.Mesh rotation={[0, 0, baseRotation + ((Math.PI * 2 * i)/sides)]} castShadow>
            <T.BufferGeometry on:create={({ref}) => {
                ref.setAttribute('position', new THREE.Float32BufferAttribute([
                    0, 0, 1.15 * (i % 2 ? -1 : 1),
                    ...calcSideVertex(-1, i % 2 ? -1 : 1),
                    ...calcSideVertex(0, i % 2 ? 1 : -1),
                    ...calcSideVertex(1, i % 2 ? -1 : 1),
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
                    ((i % 2 ? 1 : 0) + i) / sides, edgeOffset * 2 * textScale,
                    (0.5 + i) / sides, 0,
                    ((i % 2 ? 0 : 1) + i) / sides, edgeOffset * 2 * textScale,
                ], 2))
            }}></T.BufferGeometry>
            <T.MeshStandardMaterial metalness={0.75} roughness={0.35} map={createTexture(tens)}/>
        </T.Mesh>
    {/each}
</T.Mesh>
