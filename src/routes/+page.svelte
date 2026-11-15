<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from '#lib/Scene.svelte';

	let scene: ReturnType<typeof Scene> | undefined = $state();
	let busy = $state(false);
	let waiting = false;
	let result = $state('');
	let countInput = $state(2);
	const count = $derived(Math.min(20, Math.max(1, Math.floor(countInput) || 1)));

	// Where the numbers come from. Replace the body with your backend call.
	async function requestRoll(n: number): Promise<number[]> {
		// const res = await fetch(`/api/roll?count=${n}`); // e.g. {"values": [7, 2]}
		// return (await res.json()).values;
		return Array.from({ length: n }, () => Math.floor(Math.random() * 10) + 1); // local random generator
	}

	async function rollFromSource() {
		if (busy || waiting) return;
		waiting = true; // also blocks double clicks while waiting
		result = '';
		try {
			const targets = await requestRoll(count);
			console.log('Rolled', targets);
			scene?.throwDice(count, targets);
		} catch (err) {
			console.error('Could not get a roll:', err);
		} finally {
			waiting = false;
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.code === 'Space') {
			e.preventDefault();
			rollFromSource();
		}
	}
</script>

<svelte:head>
	<title>Dice roller</title>
</svelte:head>

<svelte:window {onkeydown} />

<div class="stage">
	<Canvas>
		<Scene
			bind:this={scene}
			bind:busy
			onresult={(labels) =>
				(result =
					labels.length > 1
						? `Rolled ${labels.join(' + ')} = ${labels.reduce((a, b) => a + b, 0)}`
						: `Rolled ${labels.join('')}`)}
		/>
	</Canvas>
	<div class="ui">
		<button
			onclick={(e) => {
				rollFromSource();
				e.currentTarget.blur(); // otherwise Space would "click" the button a second time
			}}
			disabled={busy}>Throw</button
		>
		<label>
			Dice
			<input type="number" min="1" max="20" bind:value={countInput} disabled={busy} />
		</label>
		<span>{result}</span>
	</div>
</div>

<style>
	.stage {
		position: relative;
		width: 100vw;
		height: 100vh;
	}
	.ui {
		position: absolute;
		top: 1rem;
		left: 1rem;
		display: flex;
		gap: 1rem;
		align-items: center;
		color: #eee;
		font-family: sans-serif;
	}
	input {
		width: 3.5rem;
	}
</style>
