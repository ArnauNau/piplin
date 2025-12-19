<script lang="ts">
	import { instructionDocs, getAllOps, type InstructionDoc } from '$lib/instructionData';
	import type { CycleEntry } from '$lib/types';

	let { selectedOp = $bindable(), selectedStage = $bindable() } = $props<{
		selectedOp: string | null;
		selectedStage?: {
			stage: string;
			cycle: number;
			entry: CycleEntry;
		} | null;
	}>();

	const allOps = getAllOps();

	let selectedDoc = $derived(selectedOp ? instructionDocs[selectedOp] : null);

	function selectOp(op: string) {
		selectedOp = op;
		selectedStage = null;
	}

	function clearStage() {
		selectedStage = null;
	}
</script>

<div class="docs-panel">
	{#if selectedStage}
		<div class="panel-header">
			<button class="back-btn" onclick={clearStage}>&larr; Back</button>
			<h3>Stage Details</h3>
		</div>
		<div class="doc-content">
			<div class="doc-header">
				<h2>
					{selectedStage.stage === 'stall' ? 'Stall' : selectedStage.stage} Stage
				</h2>
				<span class="badge type-special">
					Cycle {selectedStage.cycle}
				</span>
			</div>

			{#if selectedStage.entry.flushed}
				<div class="doc-section">
					<div class="alert warn">
						<strong>Flushed:</strong> This stage was flushed due to a branch misprediction.
					</div>
				</div>
			{/if}

			{#if selectedStage.stage === 'stall'}
				<div class="doc-section">
					<h4>Hazard Info</h4>
					<p>
						Pipeline stalled due to {selectedStage.entry.hazardType?.toUpperCase()}
						Hazard.
					</p>
				</div>
			{:else}
				{#if selectedStage.entry.cycleInStage}
					<div class="doc-section">
						<h4>Timing</h4>
						<p>
							Cycle {selectedStage.entry.cycleInStage} of
							{selectedStage.entry.totalCycles}
						</p>
					</div>
				{/if}

				{#if selectedStage.entry.forwardingFrom}
					<div class="doc-section">
						<h4>Forwarding Data</h4>
						<ul class="operand-list">
							{#each selectedStage.entry.forwardingFrom as fwd}
								<li>
									<span class="operand-name">
										{fwd.register}
									</span>
									<span class="operand-desc">
										Forwarded from {fwd.fromStage} (Instr #{fwd.fromInstruction})
									</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/if}
		</div>
	{:else}
		<div class="ops-list-container">
			<h3>Instructions</h3>
			<div class="ops-list">
				{#each allOps as op}
					<button
						class="op-chip"
						class:active={selectedOp === op}
						onclick={() => selectOp(op)}
					>
						{op}
					</button>
				{/each}
			</div>
		</div>

		<div class="doc-content">
			{#if selectedDoc}
				<div class="doc-header">
					<h2>{selectedDoc.name}</h2>
					<span class="badge type-{selectedDoc.type.toLowerCase()}"
						>{selectedDoc.type}-Type</span
					>
				</div>

				<div class="doc-section">
					<h4>Format</h4>
					<code class="format-code">{selectedDoc.format}</code>
				</div>

				{#if selectedDoc.operation}
					<div class="doc-section">
						<h4>Operation</h4>
						<div class="operation-card">
							<code class="operation-text">{selectedDoc.operation}</code>
						</div>
					</div>
				{/if}

				<div class="doc-section">
					<h4>Description</h4>
					<p>{selectedDoc.description}</p>
				</div>

				{#if selectedDoc.operands.length > 0}
					<div class="doc-section">
						<h4>Operands</h4>
						<ul class="operand-list">
							{#each selectedDoc.operands as operand}
								<li>
									<span class="operand-name">{operand.name}</span>
									<span class="operand-desc">{operand.desc}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="doc-section">
					<h4>Example</h4>
					<code class="example-code">{selectedDoc.example}</code>
				</div>
			{:else}
				<div class="empty-state">
					<p>Select an instruction to view documentation</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.docs-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.back-btn {
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
		color: var(--accent-light);
		background: none;
		border: none;
		cursor: pointer;
	}

	.back-btn:hover {
		text-decoration: underline;
	}

	.alert {
		padding: 0.75rem;
		border-radius: 4px;
		background: var(--bg-tertiary);
		border-left: 3px solid var(--text-secondary);
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.alert.warn {
		background: rgba(255, 171, 0, 0.1);
		border-left-color: #ffab00;
	}

	.ops-list-container {
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	h3 {
		margin: 0 0 0.75rem 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		color: var(--text-tertiary);
		font-weight: 600;
	}

	.ops-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
	}

	.op-chip {
		flex: 1 0 auto;
		text-align: center;
		padding: 0.5rem;
		font-size: 0.7rem;
		font-family: var(--font-mono);
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-secondary);
		border-radius: 0;
		cursor: pointer;
		transition: all 0.15s ease;
		margin-right: -1px;
		margin-bottom: -1px;
		position: relative;
	}

	.op-chip:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		z-index: 10;
		border-color: var(--text-tertiary);
	}

	.op-chip.active {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
		z-index: 20;
	}

	.doc-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.doc-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.badge {
		padding: 0.25rem 0.5rem;
		font-size: 0.65rem;
		text-transform: uppercase;
		font-weight: 600;
		border-radius: 4px;
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	.badge.type-r {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
	}
	.badge.type-i {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}
	.badge.type-s {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
	}
	.badge.type-b {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
	}
	.badge.type-j {
		background: rgba(139, 92, 246, 0.15);
		color: #a78bfa;
	}
	.badge.type-u {
		background: rgba(236, 72, 153, 0.15);
		color: #f472b6;
	}
	.badge.type-special {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.doc-section {
		margin-bottom: 1.5rem;
	}

	h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.format-code,
	.example-code {
		display: block;
		padding: 0.75rem;
		background: var(--bg-primary);
		border-radius: 6px;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--text-primary);
		white-space: pre-wrap;
	}

	.operation-card {
		padding: 1rem;
		background: var(--bg-primary);
		border-radius: 6px;
	}

	.operation-text {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.operand-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.operand-list li {
		display: flex;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
	}

	.operand-name {
		width: 60px;
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--accent-light);
	}

	.operand-desc {
		flex: 1;
		color: var(--text-secondary);
	}

	.empty-state {
		display: flex;
		height: 100%;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 0.9rem;
	}
</style>
