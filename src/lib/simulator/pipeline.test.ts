import { describe, it, expect } from 'bun:test';
import { simulatePipeline } from './pipeline';
import { defaultConfig } from '../types';
import { parseProgram } from '../parser';

// Helper to compile and run
function runSimulation(code: string, configUpdates: any = {}) {
	const parseResult = parseProgram(code);
	if (parseResult.errors.length > 0) {
		throw new Error(`Parse error: ${parseResult.errors[0].message}`);
	}

	const config = {
		...defaultConfig(),
		...configUpdates
	};

	return simulatePipeline(parseResult.instructions, parseResult.labels, config);
}

describe('Pipeline Hazards', () => {
	// TEST 1: Dependency on ALU in E (Running)
	it('should stall for multi-cycle ALU dependency', () => {
		const code = `
            MUL $1, $2, $3
            ADD $4, $1, $5
        `;

		for (const exToEx of [true, false]) {
			const result = runSimulation(code, {
				latencies: { mul: 6, alu: 1, mem: 1 },
				forwarding: { exToEx: exToEx, memToEx: false }
			});

			const addTrace = result.trace[1];
			const stalls = addTrace.timeline.filter((s) => s.stage === 'stall').length;

			//5 stalls expected while MULx6 completes (with EX->EX fwd ON)
			//8 stalls expected while MULx6 completes (with EX->EX fwd OFF)
			expect(stalls).toBe(exToEx ? 5 : 8);
		}
	});

	// TEST 2: Dependency on ALU in E (Finished)
	it('should forward EX->EX when enabled', () => {
		const code = `
            ADD $1, $2, $3
            SUB $4, $1, $5
        `;
		const result = runSimulation(code, {
			forwarding: { exToEx: true, memToEx: false }
		});

		const subTrace = result.trace[1];
		const stalls = subTrace.timeline.filter((s) => s.stage === 'stall').length;
		expect(stalls).toBe(0);
	});

	it('should stall EX->EX when forwarding disabled', () => {
		const code = `
            ADD $1, $2, $3
            SUB $4, $1, $5
        `;
		const result = runSimulation(code, {
			forwarding: { exToEx: false, memToEx: false }
		});

		const subTrace = result.trace[1];
		const stalls = subTrace.timeline.filter((s) => s.stage === 'stall').length;
		expect(stalls).toBeGreaterThan(0);
	});

	// TEST 3: Load-Use Hazard
	it('should stall correct cycles for Load-Use depending on memory latency', () => {
		const code = `
            LW $1, 0($2)
            ADD $3, $1, $4
        `;

		for (const memLatency of [1, 2, 3]) {
			const result = runSimulation(code, {
				forwarding: { exToEx: true, memToEx: true },
				latencies: { ...defaultConfig().latencies, mem: memLatency }
			});

			const addTrace = result.trace[1];
			const stalls = addTrace.timeline.filter((s) => s.stage === 'stall').length;
			expect(stalls).toBe(memLatency);
		}
	});

	it('should stall fully for Load-Use without forwarding', () => {
		const code = `
            LW $1, 0($2)
            ADD $3, $1, $4
        `;
		const result = runSimulation(code, {
			forwarding: { exToEx: false, memToEx: false }
		});

		const addTrace = result.trace[1];
		const stalls = addTrace.timeline.filter((s) => s.stage === 'stall').length;
		expect(stalls).toBeGreaterThan(1);
	});

	// TEST 4: Memory Stage Dependency
	it('should forward MEM->EX when enabled', () => {
		const code = `
            ADD $1, $2, $3
            NOP
            SUB $4, $1, $5
        `;
		const result = runSimulation(code, {
			forwarding: { exToEx: false, memToEx: true }
		});

		const subTrace = result.trace[2]; // SUB
		const stalls = subTrace.timeline.filter((s) => s.stage === 'stall').length;
		expect(stalls).toBe(0);
	});

	// TEST 5: Writeback Dependency (Transparency)
	it('should not stall if transparency is enabled', () => {
		const code = `
            ADD $1, $2, $3
            NOP
            NOP
            SUB $4, $1, $5
        `;
		const result = runSimulation(code, {
			regFileTransparency: true
		});

		const subTrace = result.trace[3];
		const stalls = subTrace.timeline.filter((s) => s.stage === 'stall').length;
		expect(stalls).toBe(0);
	});

	it('should stall if transparency is disabled', () => {
		const code = `
            ADD $1, $2, $3
            NOP
            NOP
            SUB $4, $1, $5
        `;
		const result = runSimulation(code, {
			regFileTransparency: false
		});

		const subTrace = result.trace[3];
		const stalls = subTrace.timeline.filter((s) => s.stage === 'stall').length;
		//must wait for W to complete, expecting 1 stall
		expect(stalls).toBe(1);
	});
});
