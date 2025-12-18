<script lang="ts">
	import { getAppState } from '$lib/stores.svelte';
	import type { BranchPredictorType } from '$lib/types';

	const appState = getAppState();

	let showRegisters = $state(false);

	function updateLatency(key: 'alu' | 'mul' | 'mem', e: Event) {
		const target = e.target as HTMLInputElement;
		const value = Math.max(1, parseInt(target.value) || 1);
		appState.updateLatency(key, value);
	}

	function toggleExToEx() {
		appState.updateConfig({
			forwarding: {
				...appState.config.forwarding,
				exToEx: !appState.config.forwarding.exToEx
			}
		});
	}

	function toggleMemToEx() {
		appState.updateConfig({
			forwarding: {
				...appState.config.forwarding,
				memToEx: !appState.config.forwarding.memToEx
			}
		});
	}

	function updatePredictor(e: Event) {
		const target = e.target as HTMLSelectElement;
		appState.updateConfig({ branchPredictor: target.value as BranchPredictorType });
	}

	function updatePredictorInitial(e: Event) {
		const target = e.target as HTMLSelectElement;
		appState.updateConfig({ predictorInitial: target.value as 'taken' | 'not-taken' });
	}

	function updateRegister(reg: string, e: Event) {
		const target = e.target as HTMLInputElement;
		const value = parseInt(target.value) || 0;
		appState.setRegister(reg, value);
	}

	// Common registers to show
	const commonRegs = ['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', '$9', '$10'];
</script>

<div class="sidebar">
	<section>
		<h3>Stage Latencies</h3>
		<div class="config-group">
			<label>
				<span>ALU</span>
				<input
					type="number"
					min="1"
					max="20"
					value={appState.config.latencies.alu}
					oninput={(e) => updateLatency('alu', e)}
				/>
			</label>
			<label>
				<span>MUL</span>
				<input
					type="number"
					min="1"
					max="20"
					value={appState.config.latencies.mul}
					oninput={(e) => updateLatency('mul', e)}
				/>
			</label>
			<label>
				<span>MEM</span>
				<input
					type="number"
					min="1"
					max="20"
					value={appState.config.latencies.mem}
					oninput={(e) => updateLatency('mem', e)}
				/>
			</label>
		</div>
	</section>

	<section>
		<h3>Forwarding Paths</h3>
		<div class="forwarding-toggles">
			<label class="toggle-row">
				<span>EX→EX</span>
				<button
					class="toggle"
					class:active={appState.config.forwarding.exToEx}
					onclick={toggleExToEx}
					aria-pressed={appState.config.forwarding.exToEx}
					aria-label="Toggle EX to EX forwarding"
				></button>
			</label>
			<label class="toggle-row">
				<span>MEM→EX</span>
				<button
					class="toggle"
					class:active={appState.config.forwarding.memToEx}
					onclick={toggleMemToEx}
					aria-pressed={appState.config.forwarding.memToEx}
					aria-label="Toggle MEM to EX forwarding"
				></button>
			</label>
		</div>
	</section>

	<section>
		<h3>Branch Prediction</h3>
		<div class="config-group">
			<label>
				<span>Type</span>
				<select value={appState.config.branchPredictor} onchange={updatePredictor}>
					<option value="none">None</option>
					<option value="1bit">1-bit</option>
					<option value="2bit">2-bit</option>
				</select>
			</label>
			{#if appState.config.branchPredictor !== 'none'}
				<label>
					<span>Initial</span>
					<select
						value={appState.config.predictorInitial}
						onchange={updatePredictorInitial}
					>
						<option value="not-taken">NT</option>
						<option value="taken">T</option>
					</select>
				</label>
			{/if}
		</div>
	</section>

	<section>
		<button class="collapse-btn" onclick={() => (showRegisters = !showRegisters)}>
			<span class="arrow" class:open={showRegisters}>▶</span>
			Initial Registers
		</button>
		{#if showRegisters}
			<div class="registers-grid">
				{#each commonRegs as reg}
					<label class="reg-input">
						<span>{reg}</span>
						<input
							type="number"
							value={appState.config.initialRegisters[reg] ?? 0}
							oninput={(e) => updateRegister(reg, e)}
						/>
					</label>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.sidebar {
		padding: 1rem;
		background: var(--bg-secondary);
		overflow-y: auto;
	}

	h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	section {
		margin-bottom: 1.25rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--border-color);
	}

	section:last-child {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.config-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
		color: var(--text-primary);
	}

	label span {
		color: var(--text-secondary);
	}

	input[type='number'],
	select {
		width: 60px;
		padding: 0.25rem 0.375rem;
		font-size: 0.8rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 2px;
		color: var(--text-primary);
	}

	select {
		width: auto;
		min-width: 80px;
	}

	.forwarding-toggles {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.toggle-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.toggle {
		position: relative;
		width: 36px;
		height: 18px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 2px;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.toggle::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		background: var(--text-tertiary);
		border-radius: 1px;
		transition:
			transform 0.15s ease,
			background 0.15s ease;
	}

	.toggle.active {
		background: var(--accent-color);
		border-color: var(--accent-color);
	}

	.toggle.active::after {
		transform: translateX(18px);
		background: white;
	}

	.collapse-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.25rem 0;
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-tertiary);
		background: none;
		border: none;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.arrow {
		display: inline-block;
		transition: transform 0.15s ease;
		font-size: 0.6rem;
	}

	.arrow.open {
		transform: rotate(90deg);
	}

	.registers-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.reg-input {
		font-size: 0.75rem;
	}

	.reg-input input {
		width: 50px;
	}
</style>
