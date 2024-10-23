<script lang="ts">
    import {Canvas} from '@threlte/core'
    import Scene from '$lib/Scene.svelte'

    const loader = (async () => {
        async function loadFont(fontface: FontFace) {
            document.fonts.add(fontface);
            await fontface.load();
        }
        let fonts = [
            new FontFace(
                "Creepster",
                "url(https://fonts.gstatic.com/s/creepster/v13/AlZy_zVUqJz4yMrniH4Rcn35fh4Dog.woff2) format('woff2')"
            )
        ];
        for (let font in fonts) {
            //console.log(fonts[font]);
            await loadFont(fonts[font]);
        }
    })()
</script>

<svelte:head>
    <title>Dice roller</title>
</svelte:head>

<div>
    {#await loader}
        <p>...waiting</p>
    {:then number}
        <Canvas>
            <Scene/>
        </Canvas>
    {/await}
</div>

<style>
    div {
        width: 100vw;
        height: 100vh;
    }
</style>