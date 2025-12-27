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

	let leftPanelWidth = $state(350);
	let rightPanelWidth = $state(500);
	let isDraggingLeft = $state(false);
	let isDraggingRight = $state(false);

	let highlightedRegisters = $state<Map<string, string>>(new Map());

	function startResizeLeft(e: MouseEvent) {
		e.preventDefault();
		isDraggingLeft = true;
		window.addEventListener('mousemove', handleResizeLeft);
		window.addEventListener('mouseup', stopResizeLeft);
	}

	function handleResizeLeft(e: MouseEvent) {
		if (isDraggingLeft) {
			//clamp between 250px - 700px
			leftPanelWidth = Math.max(250, Math.min(700, e.clientX));
		}
	}

	function stopResizeLeft() {
		isDraggingLeft = false;
		window.removeEventListener('mousemove', handleResizeLeft);
		window.removeEventListener('mouseup', stopResizeLeft);
	}

	function startResizeRight(e: MouseEvent) {
		e.preventDefault();
		isDraggingRight = true;
		window.addEventListener('mousemove', handleResizeRight);
		window.addEventListener('mouseup', stopResizeRight);
	}

	function handleResizeRight(e: MouseEvent) {
		if (isDraggingRight) {
			//clamp between 250px - 700px. Right panel width is (WindowWidth - MouseX)
			rightPanelWidth = Math.max(250, Math.min(700, window.innerWidth - e.clientX));
		}
	}

	function stopResizeRight() {
		isDraggingRight = false;
		window.removeEventListener('mousemove', handleResizeRight);
		window.removeEventListener('mouseup', stopResizeRight);
	}
</script>

<svelte:head>
	<title>Pipeline Visualizer</title>
	<meta name="description" content="CPU Pipeline Visualization Tool for RISC-V instructions" />
</svelte:head>

<div class="app-container" class:dragging={isDraggingLeft || isDraggingRight}>
	<div class="main-content">
		<!-- Collapsible left panel -->
		<div
			class="left-panel"
			class:open={panelOpen}
			style="width: {panelOpen ? leftPanelWidth + 'px' : ''}"
		>
			<button
				class="panel-toggle"
				onclick={() => (panelOpen = !panelOpen)}
				aria-label="Toggle editor panel"
			>
				<span class="toggle-icon">{panelOpen ? '◀' : '▶'}</span>
				<span class="toggle-text">{panelOpen ? 'Hide' : 'Edit'}</span>
			</button>

			{#if panelOpen}
				<div class="panel-content" style="width: {leftPanelWidth + 'px'}">
					<div class="editor-wrapper">
						<InstructionEditor />
					</div>
					<div class="sidebar-wrapper">
						<ConfigSidebar />
					</div>
					<button
						class="resizer-handle left"
						onmousedown={startResizeLeft}
						aria-label="Resize left panel"
					></button>
				</div>
			{/if}
		</div>

		<!-- Pipeline visualization -->
		<div class="center-panel">
			<PipelineGrid
				onInspect={handleInstructionSelect}
				onInspectStage={handleStageSelect}
				{highlightedRegisters}
			/>
		</div>

		<!-- Collapsible right panel (Docs) -->
		<div
			class="right-panel"
			class:open={docsOpen}
			style="width: {docsOpen ? rightPanelWidth + 'px' : ''}"
		>
			<button
				class="panel-toggle right"
				onclick={() => (docsOpen = !docsOpen)}
				aria-label="Toggle docs panel"
			>
				<span class="toggle-icon">{docsOpen ? '◀' : '▶'}</span>
				<span class="toggle-text">{docsOpen ? 'Hide' : 'Docs'}</span>
			</button>

			{#if docsOpen}
				<div class="panel-content" style="width: {rightPanelWidth + 'px'}">
					<DocumentationPanel
						bind:selectedOp={selectedInstruction}
						bind:selectedStage
						bind:highlightedRegisters
						{selectedTraceEntry}
						{selectedTraceIndex}
						hazards={appState.result?.hazards ?? []}
					/>
				</div>
				<button
					class="resizer-handle right"
					onmousedown={startResizeRight}
					aria-label="Resize right panel"
				></button>
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

	.app-container.dragging {
		user-select: none;
		cursor: col-resize;
	}

	.app-container.dragging .left-panel,
	.app-container.dragging .right-panel {
		transition: none;
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
		position: relative;
	}

	.right-panel {
		display: flex;
		flex-direction: row-reverse;
		flex-shrink: 0;
		background: var(--bg-secondary);
		border-left: 1px solid var(--border-color);
		transition: width 0.3s ease;
		position: relative;
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
		position: relative;
	}

	.resizer-handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 4px;
		cursor: col-resize;
		z-index: 50;
		transition: background-color 0.2s;
		background: transparent;
		border: none;
		padding: 0;
	}

	.resizer-handle:hover,
	.resizer-handle:active {
		background-color: var(--accent-light);
	}

	.resizer-handle.left {
		right: 0;
	}

	.resizer-handle.right {
		left: 0;
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
