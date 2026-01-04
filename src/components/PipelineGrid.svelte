<script lang="ts">
	import { getAppState } from '$lib/stores.svelte';
	import type { CycleEntry, ExecutionInstance } from '$lib/types';

	const appState = getAppState();

	let {
		onInspect,
		onInspectStage,
		highlightedRegisters,
		selectedTraceEntry = null
	} = $props<{
		onInspect: (entry: ExecutionInstance, index: number) => void;
		onInspectStage?: (stage: string, cycle: number, entry: CycleEntry) => void;
		highlightedRegisters: Map<string, string>;
		selectedTraceEntry?: ExecutionInstance | null;
	}>();

	const stageColors: Record<string, string> = {
		F: 'var(--stage-fetch)',
		D: 'var(--stage-decode)',
		E: 'var(--stage-execute)',
		M: 'var(--stage-memory)',
		W: 'var(--stage-writeback)',
		stall: 'var(--stage-stall)',
		bubble: 'var(--stage-bubble)'
	};

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

	function truncateInstr(raw: string, maxLen: number = 20): string {
		let clean = raw.split('#')[0].split('//')[0].trim();
		if (clean.length > maxLen) {
			clean = clean.substring(0, maxLen - 2) + '..';
		}

		return clean;
	}

	function handleInstrClick(entry: ExecutionInstance, index: number) {
		if (onInspect) {
			onInspect(entry, index);
		}
	}

	function handleStageClick(entry: CycleEntry, cycleIdx: number) {
		if (entry.stage === 'bubble') return;

		if (onInspectStage) {
			onInspectStage(entry.stage, cycleIdx + 1, entry);
		}
	}
</script>

<div class="grid-container">
	{#if appState.result && appState.result.trace.length > 0}
		{@const trace = appState.result.trace}
		{@const totalCycles = appState.result.totalCycles}

		<div class="grid-scroll">
			<table class="pipeline-grid">
				<thead>
					<tr>
						<th class="instr-header"></th>
						{#each Array(totalCycles) as _, i}
							<th class="cycle-header">{i + 1}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each appState.instructions as instr, instrIndex}
						<!-- Label row -->
						{#if instr.label}
							<tr class="label-row">
								<td class="instr-cell label-cell">
									{instr.label}:
								</td>
								<td colspan={totalCycles} class="label-line"></td>
							</tr>
						{/if}

						<!-- Instruction row -->
						<tr>
							<td class="instr-cell">
								<button
									class="instr-btn"
									class:selected={selectedTraceEntry?.instruction.index ===
										instr.index}
									title="View documentation for {instr.opcode}"
									onclick={() => {
										/* use first trace entry for this instruction if available for context */
										const trace = appState.result?.trace;
										if (trace) {
											const traceIdx = trace.findIndex(
												(t) => t.instruction.index === instr.index
											);
											if (traceIdx !== -1) {
												handleInstrClick(trace[traceIdx], traceIdx);
											}
										}
									}}
								>
									<span class="instr-num">
										{instrIndex}
									</span>
									<span class="instr-text">
										{#if highlightedRegisters.size > 0}
											{@const tokens = truncateInstr(instr.raw ?? '').split(
												/([,\s()]+)/
											)}
											{#each tokens as token}
												{@const color = highlightedRegisters.get(token)}
												{#if color}
													<span
														class="token-highlight"
														style="background-color: {color}"
													>
														{token}
													</span>
												{:else}
													{token}
												{/if}
											{/each}
										{:else}
											{truncateInstr(instr.raw ?? '')}
										{/if}
									</span>
								</button>
							</td>

							{#each Array(totalCycles) as _, cycleIdx}
								{@const activeEntries = trace.filter(
									(t) =>
										t.instruction.index === instr.index &&
										t.timeline[cycleIdx] &&
										t.timeline[cycleIdx].stage !== 'bubble'
								)}

								{#if activeEntries.length > 1}
									<!-- Overlapping stages: show stacked mini-cells -->
									<td class="stage-cell overlapping clickable">
										<div class="overlap-container">
											{#each activeEntries as activeEntry}
												{@const cycleEntry = activeEntry.timeline[cycleIdx]}
												<button
													class="mini-stage"
													class:flushed={cycleEntry.flushed}
													style="background-color: {stageColors[
														cycleEntry.stage
													]}"
													title="Iteration {activeEntry.iteration}"
													onclick={() =>
														handleStageClick(cycleEntry, cycleIdx)}
												>
													{formatCell(cycleEntry)}
												</button>
											{/each}
										</div>
									</td>
								{:else}
									{@const entry =
										activeEntries.length > 0
											? activeEntries[0].timeline[cycleIdx]
											: { stage: 'bubble' as const }}
									{@const traceEntry =
										activeEntries.length > 0 ? activeEntries[0] : undefined}

									<td
										class="stage-cell"
										class:stall={entry.stage === 'stall'}
										class:bubble={entry.stage === 'bubble'}
										class:flushed={entry.flushed}
										class:has-forwarding={entry.forwardingFrom &&
											entry.forwardingFrom.length > 0}
										class:clickable={entry.stage !== 'bubble'}
										style={entry.stage !== 'bubble'
											? `--stage-color: ${stageColors[entry.stage]}`
											: ''}
										onclick={() => {
											if (entry.stage !== 'bubble' && traceEntry) {
												handleStageClick(entry, cycleIdx);
											}
										}}
									>
										{formatCell(entry)}
									</td>
								{/if}
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
		padding: 0;
	}

	.label-cell {
		color: var(--accent-light);
		font-weight: bold;
		font-size: 0.75rem;
		padding: 0.5rem 0.25rem 0.1rem 0.5rem; /* Reduced bottom padding */
	}

	.label-line {
		border-bottom: 1px dashed var(--border-color);
		padding: 0;
	}

	.instr-btn {
		display: flex;
		align-items: center;
		width: 100%;
		height: 100%;
		padding: 0.25rem 0.75rem 0.25rem 0;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: opacity 0.15s;
	}

	.instr-btn:hover {
		opacity: 0.7;
		background: var(--bg-tertiary);
	}

	.instr-num {
		display: inline-block;
		width: 28px;
		color: var(--text-tertiary);
		font-size: 0.65rem;
	}

	.instr-text {
		color: var(--text-primary);
		font-size: 0.7rem;
		font-family: var(--font-mono);
	}

	.stage-cell {
		background: var(--stage-color);
		color: white;
		font-weight: 600;
		font-size: 0.7rem;
		min-width: 28px;
		height: 22px;
		cursor: default;
	}

	.stage-cell.clickable {
		cursor: pointer;
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
		box-shadow: inset 0 0 0 2px var(--forwarding-indicator);
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

	.token-highlight {
		border-radius: 2px;
		padding: 0 1px;
		color: var(--text-primary);
		font-weight: bold;
	}

	/* Overlapping stages styles */
	.stage-cell.overlapping {
		padding: 1px;
		background: var(--bg-tertiary);
	}

	.overlap-container {
		display: flex;
		flex-direction: column;
		gap: 1px;
		height: 100%;
		justify-content: center;
	}

	.mini-stage {
		display: block;
		width: 100%;
		padding: 1px 3px;
		border: none;
		border-radius: 2px;
		font-size: 0.55rem;
		font-weight: 600;
		font-family: var(--font-mono);
		color: white;
		text-align: center;
		cursor: pointer;
		line-height: 1.2;
	}

	.mini-stage:hover {
		opacity: 0.85;
	}

	.mini-stage.flushed {
		opacity: 0.5;
		text-decoration: line-through;
	}
</style>
