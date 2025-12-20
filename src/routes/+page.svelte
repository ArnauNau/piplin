<script lang="ts">
	import InstructionEditor from '../components/InstructionEditor.svelte';
	import ConfigSidebar from '../components/ConfigSidebar.svelte';
	import PipelineGrid from '../components/PipelineGrid.svelte';
	import StatusBar from '../components/StatusBar.svelte';
	import DocumentationPanel from '../components/DocumentationPanel.svelte';
	import type { CycleEntry, TraceEntry } from '$lib/types';
	import { getAppState } from '$lib/stores.svelte';

	const appState = getAppState();

	let panelOpen = $state(false);
	let docsOpen = $state(false);

	let selectedInstruction = $state<string | null>(null);
	let selectedTraceEntry = $state<TraceEntry | null>(null);
	let selectedTraceIndex = $state<number>(-1);

	let selectedStage = $state<{
		stage: string;
		cycle: number;
		entry: CycleEntry;
	} | null>(null);

	function handleInstructionSelect(entry: TraceEntry, index: number) {
		selectedInstruction = entry.instruction.opcode.toUpperCase();
		selectedTraceEntry = entry;
		selectedTraceIndex = index;
		selectedStage = null;
		if (!docsOpen) {
			docsOpen = true;
		}
	}

	function handleStageSelect(stage: string, cycle: number, entry: CycleEntry) {
		selectedStage = { stage, cycle, entry };
		selectedInstruction = null;
		selectedTraceEntry = null;
		selectedTraceIndex = -1;
		if (!docsOpen) {
			docsOpen = true;
		}
	}
</script>

<svelte:head>
	<title>Pipeline Visualizer</title>
	<meta name="description" content="CPU Pipeline Visualization Tool for RISC-V instructions" />
</svelte:head>

<div class="app-container">
	<div class="main-content">
		<!-- Collapsible left panel -->
		<div class="left-panel" class:open={panelOpen}>
			<button
				class="panel-toggle"
				onclick={() => (panelOpen = !panelOpen)}
				aria-label="Toggle editor panel"
			>
				<span class="toggle-icon">{panelOpen ? '◀' : '▶'}</span>
				<span class="toggle-text">{panelOpen ? 'Hide' : 'Edit'}</span>
			</button>

			{#if panelOpen}
				<div class="panel-content">
					<div class="editor-wrapper">
						<InstructionEditor />
					</div>
					<div class="sidebar-wrapper">
						<ConfigSidebar />
					</div>
				</div>
			{/if}
		</div>

		<!-- Pipeline visualization -->
		<div class="center-panel">
			<PipelineGrid onInspect={handleInstructionSelect} onInspectStage={handleStageSelect} />
		</div>

		<!-- Collapsible right panel (Docs) -->
		<div class="right-panel" class:open={docsOpen}>
			<button
				class="panel-toggle right"
				onclick={() => (docsOpen = !docsOpen)}
				aria-label="Toggle docs panel"
			>
				<span class="toggle-icon">{docsOpen ? '◀' : '▶'}</span>
				<span class="toggle-text">{docsOpen ? 'Hide' : 'Docs'}</span>
			</button>

			{#if docsOpen}
				<div class="panel-content">
					<DocumentationPanel
						bind:selectedOp={selectedInstruction}
						bind:selectedStage
						{selectedTraceEntry}
						{selectedTraceIndex}
						hazards={appState.result?.hazards ?? []}
					/>
				</div>
			{/if}
		</div>
	</div>

	<StatusBar />
</div>

<style>
	.app-container {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
	}

	.main-content {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.left-panel {
		display: flex;
		flex-shrink: 0;
		background: var(--bg-secondary);
		border-right: 1px solid var(--border-color);
		transition: width 0.3s ease;
	}

	.left-panel.open {
		width: 320px;
	}

	.right-panel {
		display: flex;
		flex-direction: row-reverse;
		flex-shrink: 0;
		background: var(--bg-secondary);
		border-left: 1px solid var(--border-color);
		transition: width 0.3s ease;
	}

	.right-panel.open {
		width: 320px;
	}

	.panel-toggle {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		writing-mode: vertical-rl;
		text-orientation: mixed;
		transition: all 0.15s ease;
		align-self: stretch;
	}

	.panel-toggle:hover {
		color: var(--text-primary);
		background: var(--bg-tertiary);
	}

	.left-panel .panel-toggle {
		border-right: 1px solid transparent;
	}

	.right-panel .panel-toggle {
		border-left: 1px solid transparent;
	}

	/* Rotate the right toggle text */
	.panel-toggle.right {
		transform: rotate(180deg);
	}

	.toggle-icon {
		font-size: 0.7rem;
		writing-mode: horizontal-tb;
	}

	.toggle-text {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.panel-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		width: 320px;
	}

	.editor-wrapper {
		flex: 1;
		overflow: hidden;
		border-bottom: 1px solid var(--border-color);
	}

	.sidebar-wrapper {
		flex: 1;
		overflow-y: auto;
	}

	.center-panel {
		flex: 1;
		overflow: hidden;
		background-color: var(--bg-primary);
		position: relative;
	}
</style>
