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
ADD $6, $4, $7    # Must wait for MUL to complete`,

				'test-1-ex-running': `# TEST 1: Dependency on ALU in E (Running)
# Requires MUL latency > 1 (default is 6)
# Producer is busy in Execute stage.
MUL $1, $2, $3
ADD $4, $1, $5   # Consumer in Decode
# Behavior:
# - Always STALL until MUL completes (Structural/RAW)`,

				'test-2-ex-finished': `# TEST 2: Dependency on ALU in E (Finished)
# Standard 1-cycle ALU latency
# Producer finishes E same cycle Consumer is in D.
ADD $1, $2, $3
SUB $4, $1, $5   # Consumer in Decode
# Behavior:
# - Fwd ON: No Stall (Forward EX->EX)
# - Fwd OFF: Stall until W completes`,

				'test-3-load-ex': `# TEST 3: Dependency on Load in E
# Producer is Load in Execute stage.
LW $1, 0($2)
ADD $3, $1, $4   # Consumer in Decode
# Behavior:
# - Fwd ON: Stall 1 cycle (Load-Use hazard)
# - Fwd OFF: Stall until W completes`,

				'test-4-mem': `# TEST 4: Dependency on Instr in M
# Producer is in Memory stage.
ADD $1, $2, $3
NOP              # Delay slot
SUB $4, $1, $5   # Consumer in Decode, Producer in M
# Behavior:
# - Fwd ON: No Stall (Forward MEM->EX)
# - Fwd OFF: Stall until W completes`,

				'test-5-wb': `# TEST 5: Dependency on Instr in W
# Producer is in Writeback stage.
ADD $1, $2, $3
NOP
NOP
SUB $4, $1, $5   # Consumer in Decode, Producer in W
# Behavior:
# - Transparency ON: No Stall
# - Transparency OFF: Stall 1 cycle`
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
