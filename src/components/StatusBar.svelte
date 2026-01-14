<script lang="ts">
	import { getAppState } from '$lib/stores.svelte';

	const appState = getAppState();

	// Stage legend items
	const stages = [
		{ name: 'F', label: 'Fetch', color: 'var(--stage-fetch)' },
		{ name: 'D', label: 'Decode', color: 'var(--stage-decode)' },
		{ name: 'E', label: 'Execute', color: 'var(--stage-execute)' },
		{ name: 'M', label: 'Memory', color: 'var(--stage-memory)' },
		{ name: 'W', label: 'Writeback', color: 'var(--stage-writeback)' }
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
		if (branchPredictor === 'none') return 'NONE';
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
			<span class="value">
				ALU×{appState.config.latencies.alu}
				MUL×{appState.config.latencies.mul}
				MEM×{appState.config.latencies.mem}
			</span>
		</span>
		<span class="separator">|</span>
		<span class="config-item">
			<span class="label">Branch Predictor:</span>
			<span class="value">{getPredictorStatus()}</span>
		</span>
	</div>

	{#if appState.result}
		<div class="stats">
			<span class="stat">{appState.result.totalCycles} cycles</span>

			{#if appState.result.hazards.length > 0}
				<span class="stat">{appState.result.hazards.length} hazards</span>
			{/if}
			{#if appState.result.predictions.length > 0}
				<span class="stat">
					{appState.result.mispredictions}/{appState.result.predictions.length} mispredictions
				</span>
			{/if}
		</div>
	{/if}

	<div class="legend">
		{#each stages as stage}
			<div class="legend-item">
				<span class="stage-badge" style="--color: {stage.color}">{stage.name}</span>
				<span class="stage-label">{stage.label}</span>
			</div>
		{/each}
		<div class="legend-item">
			<span class="stage-badge special">**</span>
			<span class="stage-label">Stall</span>
		</div>
		<div class="legend-item">
			<span class="stage-badge flushed">~~</span>
			<span class="stage-label">Flush</span>
		</div>
		{#if appState.config.forwarding.exToEx || appState.config.forwarding.memToEx}
			<div class="legend-item">
				<span class="stage-badge forwarded"></span>
				<span class="stage-label">Forwarded</span>
			</div>
		{/if}
		<span class="separator">|</span>
		<div class="credits">
			made by
			<a href="https://a.rnau.me" target="_blank" rel="noopener noreferrer"> Nau </a>
		</div>
		<span class="separator">|</span>
		<div class="credits">0.4.1</div>
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
		gap: 1.5rem;
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
		color: var(--text-secondary);
	}

	.value {
		color: var(--text-primary);
	}

	.separator {
		color: var(--text-secondary);
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
		gap: 0.75rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.stage-badge {
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

	.stage-badge.special {
		background: var(--stage-stall);
		color: var(--text-secondary);
	}

	.stage-badge.flushed {
		background: var(--stage-bubble);
		color: var(--text-tertiary);
		text-decoration: line-through;
	}

	.stage-badge.forwarded {
		box-shadow: inset 0 0 0 2px var(--forwarding-indicator);
	}

	.stage-label {
		font-size: 0.65rem;
		color: var(--text-secondary);
	}

	.credits {
		color: var(--text-secondary);
		font-size: 0.65rem;
	}

	.credits a {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px dotted currentColor;
		transition: color 0.2s;
	}

	.credits a:hover {
		color: var(--text-primary);
		border-bottom-style: solid;
	}
</style>
