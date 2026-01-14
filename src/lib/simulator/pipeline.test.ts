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

//#region PIPELINE
describe('Pipeline', () => {
	describe('Hazards', () => {
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

	//#region BRANCH PREDICTION
	describe('Branch Prediction', () => {
		const SCENARIOS = [
			{
				name: 'Branch Not Taken',
				code: `
ADDI $1, $0, 5
ADDI $2, $0, 6
BEQ $1, $2, skip  # Not Taken ($1 != $2)
ADD $3, $3, $4    # Fallthrough (Correct path)
MUL $3, $3, $2
other:
SUB $5, $5, $6
skip:
ADDI $5, $5, 98   # Target (Wrong path)
				`,
				targetInstr: 'ADDI $5, $5, 98',
				fallthroughInstr: 'ADD $3, $3, $4',
				shouldTakeBranch: false
			},
			{
				name: 'Branch Taken',
				code: `
ADDI $1, $0, 5
ADDI $2, $0, 5
BEQ $1, $2, skip  # Taken ($1 == $2)
ADD $3, $3, $4    # Fallthrough (Wrong path)
MUL $3, $3, $2
other:
SUB $5, $5, $6
skip:
ADDI $5, $5, 98   # Target (Correct path)
				`,
				targetInstr: 'ADDI $5, $5, 98',
				fallthroughInstr: 'ADD $3, $3, $4',
				shouldTakeBranch: true
			}
		];

		SCENARIOS.forEach((scenario) => {
			describe(scenario.name, () => {
				it('should handle Predict Taken correctly', () => {
					const result = runSimulation(scenario.code, {
						branchPredictor: '1bit',
						predictorInitial: 'taken'
					});

					const branchIndex = result.trace.findIndex((t) =>
						t.instruction.raw.includes('BEQ $1, $2, skip')
					);
					const nextEntry = result.trace[branchIndex + 1];

					//predict Taken -> expect Target next
					expect(nextEntry).toBeDefined();
					expect(nextEntry.instruction.raw).toContain(scenario.targetInstr);

					const isCorrect = scenario.shouldTakeBranch === true; //predict Taken == actual Taken
					//if mispredicted, the speculatively fetched instruction won't complete (no W stage)
					const completed = nextEntry.timeline.some((t) => t.stage === 'W');

					//if correct (Taken), should complete. If incorrect (Not Taken), should be discarded.
					expect(completed).toBe(isCorrect);
				});

				it('should handle Predict Not Taken correctly', () => {
					const result = runSimulation(scenario.code, {
						branchPredictor: '1bit',
						predictorInitial: 'not-taken'
					});

					const branchIndex = result.trace.findIndex((t) =>
						t.instruction.raw.includes('BEQ $1, $2, skip')
					);
					const nextEntry = result.trace[branchIndex + 1];

					//predict Not Taken -> expect Fallthrough next
					expect(nextEntry).toBeDefined();
					expect(nextEntry.instruction.raw).toContain(scenario.fallthroughInstr);

					const isCorrect = scenario.shouldTakeBranch === false; //predict NT == actual NT
					//if mispredicted, the speculatively fetched instruction won't complete (no W stage)
					const completed = nextEntry.timeline.some((t) => t.stage === 'W');

					//if correct (NT), should complete. If incorrect (Taken), should be discarded.
					expect(completed).toBe(isCorrect);
				});
			});
		});

		it('should correctly simulate all stages for a loop with branch prediction', () => {
			const code = `
ADDI $1, $0, 5
second:
ADDI $2, $2, 5
BEQ $1, $2, second
ADD $3, $3, $4
SUB $5, $5, $2
ADD $3, $3, $3
			`;

			const result = runSimulation(code, {
				branchPredictor: '1bit',
				predictorInitial: 'not-taken',
				latencies: { alu: 1, mul: 1, mem: 1 },
				forwarding: { exToEx: true, memToEx: true }
			});

			//verify we have the expected number of trace entries
			//first iteration: ADDI $1, ADDI $2 (first time), BEQ, ADD (fetched but flushed), ADDI $2 (second time), BEQ (second time), ADD (correct)
			expect(result.trace.length).toBeGreaterThan(5);

			//find all instructions by their raw text
			const addi1Entries = result.trace.filter((t) =>
				t.instruction.raw.includes('ADDI $1, $0, 5')
			);
			const addi2Entries = result.trace.filter((t) =>
				t.instruction.raw.includes('ADDI $2, $2, 5')
			);
			const beqEntries = result.trace.filter((t) =>
				t.instruction.raw.includes('BEQ $1, $2, second')
			);
			const addEntries = result.trace.filter((t) =>
				t.instruction.raw.includes('ADD $3, $3, $4')
			);

			//validate ADDI $1 (executed once)
			expect(addi1Entries.length).toBe(1);
			const addi1 = addi1Entries[0];
			expect(addi1.timeline[0].stage).toBe('F'); //cycle 1: fetch
			expect(addi1.timeline[1].stage).toBe('D'); //cycle 2: decode
			expect(addi1.timeline[2].stage).toBe('E'); //cycle 3: execute
			expect(addi1.timeline[3].stage).toBe('M'); //cycle 4: memory
			expect(addi1.timeline[4].stage).toBe('W'); //cycle 5: writeback

			//validate first ADDI $2 (in loop, appears 3 times: 2 executed, 1 flushed)
			expect(addi2Entries.length).toBe(3);
			const addi2First = addi2Entries[0];
			expect(addi2First.timeline[0].stage).toBe('bubble'); //cycle 1: not yet fetched
			expect(addi2First.timeline[1].stage).toBe('F'); //cycle 2: fetch
			expect(addi2First.timeline[2].stage).toBe('D'); //cycle 3: decode
			expect(addi2First.timeline[3].stage).toBe('E'); //cycle 4: execute
			expect(addi2First.timeline[4].stage).toBe('M'); //cycle 5: memory
			expect(addi2First.timeline[5].stage).toBe('W'); //cycle 6: writeback

			//validate first BEQ (appears 3 times: 2 executed, 1 flushed)
			expect(beqEntries.length).toBe(3);
			const beqFirst = beqEntries[0];
			expect(beqFirst.timeline[1].stage).toBe('bubble'); //cycle 2: not yet fetched
			expect(beqFirst.timeline[2].stage).toBe('F'); //cycle 3: fetch
			expect(beqFirst.timeline[3].stage).toBe('D'); //cycle 4: decode
			expect(beqFirst.timeline[4].stage).toBe('E'); //cycle 5: execute (branch resolves here)
			expect(beqFirst.timeline[5].stage).toBe('M'); //cycle 6: memory
			expect(beqFirst.timeline[6].stage).toBe('W'); //cycle 7: writeback

			//validate first ADD
			expect(addEntries.length).toBeGreaterThanOrEqual(1);
			const addFirst = addEntries[0];

			//find fetch cycle
			const addFirstFetchCycle = addFirst.timeline.findIndex((t) => t.stage === 'F');
			expect(addFirstFetchCycle).toBeGreaterThan(0);

			//find flush cycle (should be the last 'active' cycle for this instruction)
			//it should be marked as 'flushed' in the timeline
			const flushedCycleIndex = addFirst.timeline.findIndex((t) => t.flushed === true);
			expect(flushedCycleIndex).toBeGreaterThan(addFirstFetchCycle);

			//verify it disappears after the flush cycle (next cycle should be bubble if not re-used, or just no more stages)
			//actually, timeline will be filled with bubbles or stalls, but no more valid stages
			const afterFlushStage = addFirst.timeline[flushedCycleIndex + 1]?.stage;
			expect(afterFlushStage === 'bubble' || afterFlushStage === undefined).toBe(true);

			//validate second ADDI $2 (loop iteration 2)
			const addi2Second = addi2Entries[1];
			//should be fetched after the flush
			const addi2SecondFetchCycle = addi2Second.timeline.findIndex((t) => t.stage === 'F');

			const cycle5Index = 4;
			const cycle6Index = 5;

			//verify cycle 5 status
			expect(beqFirst.timeline[cycle5Index].stage).toBe('E');
			expect(addFirst.timeline[cycle5Index].stage).toBe('D');
			expect(addFirst.timeline[cycle5Index].flushed).toBeFalsy();

			//verify cycle 6 status (Flush + Overlap)
			expect(addFirst.timeline[cycle6Index].flushed).toBe(true);
			expect(addi2Second.timeline[cycle6Index].stage).toBe('F');
			expect(addi2SecondFetchCycle).toBe(cycle6Index);

			//should complete normally
			expect(addi2Second.timeline.some((t) => t.stage === 'W')).toBe(true);

			//verify that first ADDI $2's Writeback and second ADDI $2's Fetch overlap logic
			// ADDI $2 #1 Writeback is Cycle 6 (index 5)
			// ADDI $2 #2 Fetch is Cycle 6 (index 5)

			const addi2FirstWritebackCycle = addi2First.timeline.findIndex((t) => t.stage === 'W');
			expect(addi2FirstWritebackCycle).toBe(5);
			expect(addi2SecondFetchCycle).toBe(5);
			//fetch happens in the same cycle as previous writeback
			expect(addi2FirstWritebackCycle).toBe(addi2SecondFetchCycle);

			//validate second BEQ (should now be predicted taken after first iteration)
			const beqSecond = beqEntries[1];
			const beqSecondFetchCycle = beqSecond.timeline.findIndex((t) => t.stage === 'F');
			expect(beqSecondFetchCycle).toBeGreaterThan(0);

			//if predicted taken, it should be flushed
			const beqSecondExecuteCycle = beqSecond.timeline.findIndex((t) => t.stage === 'E');
			expect(beqSecondExecuteCycle).toBeGreaterThan(beqSecondFetchCycle);

			//verify branch predictions
			expect(result.predictions.length).toBe(2); //two branch executions
			const firstPrediction = result.predictions[0];
			expect(firstPrediction.predicted).toBe(false); //initially predicted not-taken
			expect(firstPrediction.actual).toBe(true); //actually taken
			expect(firstPrediction.correct).toBe(false); //misprediction

			const secondPrediction = result.predictions[1];
			expect(secondPrediction.predicted).toBe(true); //predicted taken (1-bit learned)
			expect(secondPrediction.actual).toBe(false); //actually not taken ($2=10, $1=5)
			expect(secondPrediction.correct).toBe(false); //misprediction

			//verify total mispredictions
			expect(result.mispredictions).toBe(2);

			//verify that the pipeline eventually completes
			expect(result.totalCycles).toBeGreaterThan(10);

			//verify final register values
			expect(result.finalRegisters['$1']).toBe(5); //set once
			expect(result.finalRegisters['$2']).toBe(10); //0 + 5 + 5
		});
	});
});
