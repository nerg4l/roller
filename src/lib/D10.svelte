<script lang="ts">
    import {T, useTask} from '@threlte/core'
    import * as THREE from 'three'
    import {interactivity} from '@threlte/extras'
    import {createTextTexture} from "$lib/texture";
    import {sideRotation} from "$lib/geometry";

    interactivity()

    export let sides: string[];
    export let position: number[] = [0, 0, 0];

    const step = 256
    const edgeOffset = 0.105

    const textScale = 1.5
    const texture = createTextTexture(sides, step)

    let rotation = sideRotation(0, sides.length)

    let rotationStart: number[] = [0, 0, 0]
    let rotationEnd: number[] = [0, 0, 0]

    const calcRadDiff = (rotationStart: number, rotationEnd: number, timer: number) => {
        if (rotationStart < rotationEnd) {
            rotationStart += 2 * Math.PI;
        }
        return rotationStart + ((rotationEnd - rotationStart) * timer)
    }

    let timer = 0
    const randomizeFaceTask = useTask((delta) => {
        if (timer >= 1) {
            return
        }
        if (timer == 0) {
            rotationStart = rotation
            rotationEnd = rotationEnd.map(() => Math.PI * 2 * Math.random())
            timer = 0
        }
        timer += delta
        if (timer >= 1) {
            randomizeFaceTask.stop()
            resolveFaceTask.start()
            timer = 1
            rotationStart = rotation
            const targetIndex = Math.floor(Math.random() * sides.length)
            rotationEnd = sideRotation(targetIndex, sides.length)
            return
        }
        rotation = [
            calcRadDiff(rotationStart[0], rotationEnd[0], timer),
            calcRadDiff(rotationStart[1], rotationEnd[1], timer),
            calcRadDiff(rotationStart[2], rotationEnd[2], timer),
        ]
    }, {autoStart: false})
    const resolveFaceTask = useTask((delta) => {
        if (timer >= 2) {
            return
        }
        timer += delta
        if (timer >= 2) {
            timer = 2
        }
        rotation = [
            calcRadDiff(rotationStart[0], rotationEnd[0], timer - 1),
            calcRadDiff(rotationStart[1], rotationEnd[1], timer - 1),
            calcRadDiff(rotationStart[2], rotationEnd[2], timer - 1),
        ]
        if (timer == 2) {
            resolveFaceTask.stop()
            timer = 0
        }
    }, {autoStart: false})

    const roll = async () => {
        if (timer > 0) {
            return
        }
        randomizeFaceTask.start()
        timer = 0
    }

    const turn = Math.PI * 2 / sides.length
    const vertexes = [
        [0, 1, 0],
        [Math.sin(turn), edgeOffset, Math.cos(turn)],
        [0, -edgeOffset, Math.cos(0)],
        [Math.sin(-turn), edgeOffset, Math.cos(-turn)],
    ]

    const path = new THREE.CurvePath<THREE.Vector3>();
    vertexes.forEach((_, i) => {
        const prev = (i - 1 + vertexes.length) % vertexes.length;
        const next = (i + 1) % vertexes.length;
        path.curves.push(new THREE.LineCurve3(
            new THREE.Vector3(
                (vertexes[i][0] + vertexes[prev][0]) / 2,
                (vertexes[i][1] + vertexes[prev][1]) / 2,
                (vertexes[i][2] + vertexes[prev][2]) / 2,
            ),
            new THREE.Vector3(...vertexes[i]),
        ))
        path.curves.push(new THREE.LineCurve3(
            new THREE.Vector3(...vertexes[i]),
            new THREE.Vector3(
                (vertexes[i][0] + vertexes[next][0]) / 2,
                (vertexes[i][1] + vertexes[next][1]) / 2,
                (vertexes[i][2] + vertexes[next][2]) / 2,
            ),
        ))
    })

    const offsetRadius = 0.08

    const standardMaterial = {
        metalness: 0.75,
        roughness: 0.35,
    }
</script>

<T.Mesh
        on:click={roll}
        rotation={rotation}
        position={position}
        castShadow
>
    {#each sides as _, i}
        <T.Mesh rotation={sideRotation(i, sides.length)} castShadow>
            <T.TubeGeometry args={[path, 500, offsetRadius, 20, true]}/>
            <T.MeshStandardMaterial color={0xcc00cc} {...standardMaterial}/>
        </T.Mesh>
        <T.Mesh rotation={sideRotation(i, sides.length)} castShadow>
            <T.BufferGeometry on:create={({ref}) => {
                ref.setAttribute('position', new THREE.Float32BufferAttribute(vertexes.map((v, i) => {
                    return [
                        v[0],
                        v[1] + Math.sin(Math.PI/4)*offsetRadius,
                        v[2] + Math.cos(Math.PI/4)*offsetRadius,
                    ]
                }).flat(), 3))
                ref.setIndex([
                    0, 2, 1,
                    0, 3, 2,
                ])
                ref.computeVertexNormals()
                ref.setAttribute('uv', new THREE.Float32BufferAttribute([
                    (0.5 + i) / sides.length, textScale,
                    (1 + i) / sides.length, edgeOffset * 2 * textScale,
                    (0.5 + i) / sides.length, 0,
                    (0 + i) / sides.length, edgeOffset * 2 * textScale,
                ], 2))
            }}></T.BufferGeometry>
            <T.MeshStandardMaterial  {...standardMaterial} map={texture}/>
        </T.Mesh>
    {/each}
</T.Mesh>