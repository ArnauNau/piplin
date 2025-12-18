<script lang="ts">
	import { getAppState } from '$lib/stores.svelte';

	const state = getAppState();

	let textareaRef: HTMLTextAreaElement;

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		state.code = target.value;
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Tab inserts spaces instead of changing focus
		if (e.key === 'Tab') {
			e.preventDefault();
			const start = textareaRef.selectionStart;
			const end = textareaRef.selectionEnd;
			const value = textareaRef.value;
			textareaRef.value = value.substring(0, start) + '  ' + value.substring(end);
			textareaRef.selectionStart = textareaRef.selectionEnd = start + 2;
			state.code = textareaRef.value;
		}
	}
</script>

<div class="editor-container">
	<div class="editor-header">
		<h3>Instructions</h3>
		<div class="examples">
			<span>Examples:</span>
			<button onclick={() => state.loadExample('hazard')}>Hazard</button>
			<button onclick={() => state.loadExample('load-use')}>Load-Use</button>
			<button onclick={() => state.loadExample('forwarding')}>Forwarding</button>
			<button onclick={() => state.loadExample('branch')}>Branch</button>
			<button onclick={() => state.loadExample('mul-latency')}>MUL Latency</button>
		</div>
	</div>

	<textarea
		bind:this={textareaRef}
		value={state.code}
		oninput={handleInput}
		onkeydown={handleKeyDown}
		spellcheck="false"
		placeholder="Enter instructions..."
	></textarea>

	{#if state.parseErrors.length > 0}
		<div class="errors">
			{#each state.parseErrors as error}
				<div class="error">Line {error.line}: {error.message}</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-secondary);
		overflow: hidden;
	}

	.editor-header {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
		border-bottom: 1px solid var(--border-color);
	}

	.editor-header h3 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.examples {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.75rem;
		width: 100%;
	}

	.examples span {
		color: var(--text-secondary);
	}

	.examples button {
		padding: 0.25rem 0.5rem;
		font-size: 0.7rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.examples button:hover {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	textarea {
		flex: 1;
		padding: 1rem;
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
		background: var(--bg-primary);
		color: var(--text-primary);
		border: none;
		resize: none;
		outline: none;
	}

	textarea::placeholder {
		color: var(--text-tertiary);
	}

	.errors {
		padding: 0.5rem 1rem;
		background: var(--error-bg);
		border-top: 1px solid var(--error-border);
	}

	.error {
		font-size: 0.75rem;
		color: var(--error-color);
		padding: 0.25rem 0;
	}
</style>
