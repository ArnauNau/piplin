import { type Config, type SimulationResult, defaultConfig } from './types';
import { parseProgram } from './parser';
import { simulatePipeline } from './simulator/pipeline';

// Default example program
const DEFAULT_CODE = `# Example: Forwarding demonstration
# Toggle forwarding to see the difference
ADDI $1, $0, 10
ADDI $2, $0, 20
ADD $3, $1, $2    # Uses forwarded values from $1 and $2
SUB $4, $3, $1    # Uses forwarded value from $3
MUL $5, $4, $2    # Uses forwarded value from $4`;

// Reactive state using Svelte 5 runes
export function createAppState() {
	let code = $state(DEFAULT_CODE);
	let config = $state<Config>(defaultConfig());
	let result = $state<SimulationResult | null>(null);
	let parseErrors = $state<Array<{ line: number; message: string }>>([]);

	// Derived: run simulation when code or config changes
	const simulate = () => {
		const parsed = parseProgram(code);
		parseErrors = parsed.errors;

		if (parsed.errors.length === 0 && parsed.instructions.length > 0) {
			result = simulatePipeline(parsed.instructions, parsed.labels, config);
		} else {
			result = null;
		}
	};

	// Run initial simulation
	simulate();

	return {
		get code() {
			return code;
		},
		set code(v: string) {
			code = v;
			simulate();
		},

		get config() {
			return config;
		},
		set config(v: Config) {
			config = v;
			simulate();
		},

		get result() {
			return result;
		},
		get parseErrors() {
			return parseErrors;
		},

		updateConfig(updates: Partial<Config>) {
			config = { ...config, ...updates };
			simulate();
		},

		updateLatency(key: keyof Config['latencies'], value: number) {
			config = {
				...config,
				latencies: { ...config.latencies, [key]: value }
			};
			simulate();
		},

		setRegister(reg: string, value: number) {
			const newRegs = { ...config.initialRegisters };
			newRegs[reg] = value;
			config = { ...config, initialRegisters: newRegs };
			simulate();
		},

		loadExample(name: string) {
			const examples: Record<string, string> = {
				hazard: `# Data hazard demonstration
ADD $1, $2, $3
SUB $4, $1, $5    # RAW hazard on $1`,

				'load-use': `# Load-use hazard
LW $1, 0($2)
ADD $3, $1, $4    # Must stall - LW result available after MEM`,

				forwarding: `# Forwarding demonstration
# Toggle forwarding to see the difference
ADDI $1, $0, 10
ADDI $2, $0, 20
ADD $3, $1, $2    # Uses forwarded values from $1 and $2
SUB $4, $3, $1    # Uses forwarded value from $3
MUL $5, $4, $2    # Uses forwarded value from $4`,

				branch: `# Branch prediction
ADDI $1, $0, 5
ADDI $2, $0, 5
BEQ $1, $2, skip  # Taken ($1 == $2)
ADD $3, $3, $4    # Flushed if mispredicted
skip:
SUB $5, $5, $6`,

				'mul-latency': `# Multi-cycle execution
# MUL takes multiple cycles in EX
ADD $1, $2, $3
MUL $4, $1, $5    # 6 cycles in EX (default)
ADD $6, $4, $7    # Must wait for MUL to complete`
			};

			if (examples[name]) {
				code = examples[name];
				simulate();
			}
		}
	};
}

// Create singleton instance
let appState: ReturnType<typeof createAppState> | null = null;

export function getAppState() {
	if (!appState) {
		appState = createAppState();
	}
	return appState;
}
