<script lang="ts">
	import { getAppState } from '$lib/stores.svelte';
	import type { CycleEntry, StageName } from '$lib/types';
	import { parseProgram } from '$lib/parser';

	const appState = getAppState();

	// Get instruction list from current code
	function getInstructions() {
		const parsed = parseProgram(appState.code);
		return parsed.instructions;
	}

	// Stage colors
	const stageColors: Record<string, string> = {
		F: 'var(--stage-fetch)',
		D: 'var(--stage-decode)',
		E: 'var(--stage-execute)',
		M: 'var(--stage-memory)',
		W: 'var(--stage-writeback)',
		stall: 'var(--stage-stall)',
		bubble: 'var(--stage-bubble)'
	};

	// Format cell content
	function formatCell(entry: CycleEntry): string {
		if (entry.stage === 'stall') return '**';
		if (entry.stage === 'bubble') return '';
		if (entry.flushed) return '~~';

		let text = entry.stage;
		if (entry.cycleInStage && entry.totalCycles && entry.totalCycles > 1) {
			text += `${entry.cycleInStage}`;
		}
		return text;
	}

	// Get tooltip for cell
	function getTooltip(entry: CycleEntry, _instrIdx: number): string {
		const lines: string[] = [];

		if (entry.stage === 'stall') {
			lines.push('Stalled due to data hazard');
			if (entry.hazardType) {
				lines.push(`Hazard type: ${entry.hazardType.toUpperCase()}`);
			}
		} else if (entry.flushed) {
			lines.push('Flushed due to branch misprediction');
		} else if (entry.stage !== 'bubble') {
			const stageNames: Record<StageName, string> = {
				F: 'Fetch',
				D: 'Decode',
				E: 'Execute',
				M: 'Memory',
				W: 'Writeback'
			};
			lines.push(stageNames[entry.stage as StageName] || entry.stage);

			if (entry.cycleInStage && entry.totalCycles) {
				lines.push(`Cycle ${entry.cycleInStage} of ${entry.totalCycles}`);
			}

			if (entry.forwardingFrom && entry.forwardingFrom.length > 0) {
				lines.push('');
				lines.push('Forwarding:');
				for (const fwd of entry.forwardingFrom) {
					lines.push(`  ${fwd.register}: ${fwd.fromStage}→E from I${fwd.fromInstruction + 1}`);
				}
			}
		}

		return lines.join('\n');
	}

	// Truncate instruction for display
	function truncateInstr(raw: string, maxLen: number = 20): string {
		// Remove comments
		let clean = raw.split('#')[0].split('//')[0].trim();
		if (clean.length > maxLen) {
			clean = clean.substring(0, maxLen - 2) + '..';
		}
		return clean;
	}
</script>

<div class="grid-container">
	{#if appState.result && appState.result.timeline.length > 0}
		{@const instructions = getInstructions()}
		{@const maxCycles = Math.max(...appState.result.timeline.map((t) => t.length))}

		<div class="grid-scroll">
			<table class="pipeline-grid">
				<thead>
					<tr>
						<th class="instr-header"></th>
						{#each Array(maxCycles) as _, i}
							<th class="cycle-header">{i + 1}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each appState.result.timeline as row, instrIdx}
						<tr>
							<td class="instr-cell" title={instructions[instrIdx]?.raw}>
								<span class="instr-num">I{instrIdx + 1}</span>
								<span class="instr-text">{truncateInstr(instructions[instrIdx]?.raw ?? '')}</span>
							</td>
							{#each row as entry, _cycleIdx}
								<td
									class="stage-cell"
									class:stall={entry.stage === 'stall'}
									class:bubble={entry.stage === 'bubble'}
									class:flushed={entry.flushed}
									class:has-forwarding={entry.forwardingFrom && entry.forwardingFrom.length > 0}
									style="--stage-color: {stageColors[entry.stage]}"
									title={getTooltip(entry, instrIdx)}
								>
									{formatCell(entry)}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if appState.parseErrors.length > 0}
		<div class="empty-state">
			<p>Fix parsing errors to see the pipeline</p>
		</div>
	{:else}
		<div class="empty-state">
			<p>Enter instructions to see the pipeline</p>
		</div>
	{/if}
</div>

<style>
	.grid-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-secondary);
		overflow: hidden;
	}

	.grid-scroll {
		flex: 1;
		overflow: auto;
		padding: 0.75rem;
	}

	.pipeline-grid {
		border-collapse: separate;
		border-spacing: 2px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	th,
	td {
		padding: 0.25rem 0.375rem;
		text-align: center;
		white-space: nowrap;
	}

	.instr-header {
		text-align: left;
		position: sticky;
		left: 0;
		background: var(--bg-secondary);
		z-index: 2;
		min-width: 140px;
	}

	.cycle-header {
		color: var(--text-tertiary);
		font-weight: normal;
		font-size: 0.65rem;
		min-width: 28px;
	}

	.instr-cell {
		text-align: left;
		position: sticky;
		left: 0;
		background: var(--bg-secondary);
		z-index: 1;
		padding-right: 0.75rem;
	}

	.instr-num {
		display: inline-block;
		width: 22px;
		color: var(--text-tertiary);
		font-size: 0.65rem;
	}

	.instr-text {
		color: var(--text-primary);
		font-size: 0.7rem;
	}

	.stage-cell {
		background: var(--stage-color);
		color: white;
		font-weight: 600;
		font-size: 0.7rem;
		min-width: 28px;
		height: 22px;
	}

	.stage-cell:not(.bubble):not(.stall):hover {
		opacity: 0.85;
	}

	.stage-cell.stall {
		background: var(--stage-stall);
		color: var(--text-secondary);
	}

	.stage-cell.bubble {
		background: transparent;
		color: var(--text-tertiary);
	}

	.stage-cell.flushed {
		background: var(--stage-bubble);
		color: var(--text-tertiary);
		text-decoration: line-through;
	}

	.stage-cell.has-forwarding {
		box-shadow: inset 0 0 0 1px var(--accent-color);
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 0.8rem;
	}

	.grid-scroll::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	.grid-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.grid-scroll::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 3px;
	}
</style>
