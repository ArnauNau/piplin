<script lang="ts">
	import { getAppState } from '$lib/stores.svelte';

	const appState = getAppState();

	// Stage legend items
	const stages = [
		{ name: 'F', color: 'var(--stage-fetch)' },
		{ name: 'D', color: 'var(--stage-decode)' },
		{ name: 'E', color: 'var(--stage-execute)' },
		{ name: 'M', color: 'var(--stage-memory)' },
		{ name: 'W', color: 'var(--stage-writeback)' }
	];

	// Format forwarding status
	function getForwardingStatus(): string {
		const { exToEx, memToEx } = appState.config.forwarding;
		if (!exToEx && !memToEx) return 'OFF';
		const paths = [];
		if (exToEx) paths.push('EX→EX');
		if (memToEx) paths.push('MEM→EX');
		return paths.join(', ');
	}

	// Format branch predictor
	function getPredictorStatus(): string {
		const { branchPredictor, predictorInitial } = appState.config;
		if (branchPredictor === 'none') return 'None';
		const init = predictorInitial === 'taken' ? 'T' : 'NT';
		return `${branchPredictor} (${init})`;
	}
</script>

<div class="status-bar">
	<div class="config-summary">
		<span class="config-item">
			<span class="label">Fwd:</span>
			<span class="value">{getForwardingStatus()}</span>
		</span>
		<span class="separator">|</span>
		<span class="config-item">
			<span class="label">Cycles:</span>
			<span class="value"
				>ALU×{appState.config.latencies.alu} MUL×{appState.config.latencies.mul} MEM×{appState
					.config.latencies.mem}</span
			>
		</span>
		<span class="separator">|</span>
		<span class="config-item">
			<span class="label">BP:</span>
			<span class="value">{getPredictorStatus()}</span>
		</span>
	</div>

	{#if appState.result}
		<div class="stats">
			<span class="stat">{appState.result.totalCycles} cycles</span>
			<span class="stat">{appState.result.timeline.length} instr</span>
			{#if appState.result.hazards.length > 0}
				<span class="stat">{appState.result.hazards.length} hazards</span>
			{/if}
			{#if appState.result.predictions.length > 0}
				<span class="stat"
					>{appState.result.mispredictions}/{appState.result.predictions.length} mispred</span
				>
			{/if}
		</div>
	{/if}

	<div class="legend">
		{#each stages as stage}
			<span class="stage-item" style="--color: {stage.color}">{stage.name}</span>
		{/each}
		<span class="stage-item special">**</span>
	</div>
</div>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.config-summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-secondary);
	}

	.config-item {
		display: flex;
		gap: 0.25rem;
	}

	.label {
		color: var(--text-tertiary);
	}

	.value {
		color: var(--text-primary);
	}

	.separator {
		color: var(--border-color);
	}

	.stats {
		display: flex;
		gap: 0.75rem;
	}

	.stat {
		color: var(--text-secondary);
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.stage-item {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 16px;
		background: var(--color);
		color: white;
		font-size: 0.6rem;
		font-weight: 600;
	}

	.stage-item.special {
		background: var(--stage-stall);
		color: var(--text-secondary);
	}
</style>
