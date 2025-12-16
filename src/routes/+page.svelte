<script lang="ts">
	import InstructionEditor from '../components/InstructionEditor.svelte';
	import ConfigSidebar from '../components/ConfigSidebar.svelte';
	import PipelineGrid from '../components/PipelineGrid.svelte';
	import StatusBar from '../components/StatusBar.svelte';

	let panelOpen = $state(false);
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
		<div class="right-panel">
			<PipelineGrid />
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
	}

	.left-panel.open {
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
		transition: color 0.15s ease;
	}

	.panel-toggle:hover {
		color: var(--text-primary);
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
		min-height: 0;
		overflow: hidden;
	}

	.editor-wrapper {
		flex: 1;
		min-height: 150px;
		border-bottom: 1px solid var(--border-color);
	}

	.sidebar-wrapper {
		flex-shrink: 0;
		max-height: 45%;
		overflow-y: auto;
	}

	.right-panel {
		flex: 1;
		min-width: 0;
	}
</style>
