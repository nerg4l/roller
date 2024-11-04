<script lang="ts">
    import {T} from '@threlte/core'
    import {TrackballControls} from '@threlte/extras'
    import D10 from "$lib/D10.svelte";

    const numbers = [0, 6, 7, 1, 4, 9, 3, 2, 8, 5]
    const ones = numbers.map(x => String(x))
    const tens = numbers.map(x => String(x * 10).padStart(2, '0'))
</script>

<T.PerspectiveCamera
        makeDefault
        position={[0, Math.sin(Math.PI/4)*5, Math.cos(Math.PI/4)*5]}
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
        position={[0, Math.sin(Math.PI/4)*5, Math.cos(Math.PI/4)*5]}
        castShadow
/>

<T.Color attach="background" args={['#222']}/>
<T.Fog
        attach="fog"
        color="#222"
        near={4}
        far={5.25}
/>

<D10 sides={ones} position={[1.25, 0, 0]} />

<D10 sides={tens} position={[-1.25, 0, 0]} />
