import type {
	Instruction,
	Config,
	SimulationResult,
	CycleEntry,
	StageName,
	HazardInfo,
	RegisterFile,
	Memory,
	ForwardingInfo,
	BranchPrediction
} from '../types';
import { createDefaultRegisters } from '../types';
import {
	executeAlu,
	executeLoad,
	executeStore,
	evaluateBranch,
	setRegValue,
	cloneRegisters,
	cloneMemory
} from './execution';
import { getSourceRegisters, getDestRegister } from './hazards';
import { createBranchPredictor, type BranchPredictor } from './branchPredictor';

// Pipeline stage representation
interface PipelineStage {
	instr: Instruction | null;
	cycleInStage: number;
	totalCyclesInStage: number;
	computedValue?: number;
	forwardingUsed: ForwardingInfo[];
	flushed: boolean;
}

// In-flight instruction tracking
interface InFlightInstr {
	instr: Instruction;
	fetchCycle: number;
	stages: Map<StageName, { start: number; end: number }>;
	flushed: boolean;
	computedValue?: number;
}

export function simulatePipeline(
	instructions: Instruction[],
	labels: Map<string, number>,
	config: Config
): SimulationResult {
	if (instructions.length === 0) {
		return {
			timeline: [],
			totalCycles: 0,
			hazards: [],
			predictions: [],
			mispredictions: 0,
			finalRegisters: config.initialRegisters ?? createDefaultRegisters(),
			finalMemory: config.initialMemory ?? new Map()
		};
	}

	// Initialize state
	const regs: RegisterFile = cloneRegisters(config.initialRegisters ?? createDefaultRegisters());
	const mem: Memory = cloneMemory(config.initialMemory ?? new Map());
	const predictor: BranchPredictor = createBranchPredictor(
		config.branchPredictor,
		config.predictorInitial
	);

	// Timeline: for each instruction, what happens at each cycle
	const timeline: CycleEntry[][] = instructions.map(() => []);
	const hazards: HazardInfo[] = [];
	const predictions: BranchPrediction[] = [];

	// Track instructions in pipeline
	const _inFlight: InFlightInstr[] = [];

	// Current state
	let pc = 0; // Program counter (instruction index)
	let cycle = 1;
	const _stallCycles = 0;
	const _flushUntilCycle = 0;
	let completed = 0;

	// Pipeline registers (what's in each stage)
	const stages: Record<StageName, PipelineStage | null> = {
		F: null,
		D: null,
		E: null,
		M: null,
		W: null
	};

	// Results available for forwarding (from EX and MEM stages)
	const forwardableResults: Map<
		string,
		{ value: number; fromInstr: number; fromStage: 'E' | 'M' }
	> = new Map();

	// Maximum cycles to prevent infinite loops
	const maxCycles = instructions.length * 50 + 100;

	while (completed < instructions.length && cycle <= maxCycles) {
		// Clear forwardable results from last cycle
		forwardableResults.clear();

		// === WRITEBACK STAGE ===
		if (stages.W?.instr && !stages.W.flushed) {
			const instr = stages.W.instr;
			// Write result to register file
			if (instr.type === 'alu' && instr.rd) {
				setRegValue(regs, instr.rd, stages.W.computedValue ?? 0);
			} else if (instr.type === 'load' && instr.rd) {
				setRegValue(regs, instr.rd, stages.W.computedValue ?? 0);
			}
			completed++;
		}

		// === MEMORY STAGE ===
		let memResult: number | undefined;
		if (stages.M?.instr && !stages.M.flushed) {
			const instr = stages.M.instr;
			const cycleInStage = stages.M.cycleInStage;
			const totalCycles = stages.M.totalCyclesInStage;

			if (instr.type === 'load' && cycleInStage === totalCycles) {
				memResult = executeLoad(instr, regs, mem);
				// Add to forwardable results (MEM→EX path)
				if (instr.rd && config.forwarding.memToEx) {
					forwardableResults.set(instr.rd, {
						value: memResult,
						fromInstr: instr.index,
						fromStage: 'M'
					});
				}
			} else if (instr.type === 'store' && cycleInStage === totalCycles) {
				executeStore(instr, regs, mem);
			} else if (instr.type === 'alu' && instr.rd && config.forwarding.memToEx) {
				// ALU result can be forwarded from M stage too (MEM→EX path)
				forwardableResults.set(instr.rd, {
					value: stages.M.computedValue ?? 0,
					fromInstr: instr.index,
					fromStage: 'M'
				});
			}
		}

		// === EXECUTE STAGE ===
		let exeResult: number | undefined;
		let branchTaken = false;
		let branchTarget = -1;

		if (stages.E?.instr && !stages.E.flushed) {
			const instr = stages.E.instr;
			const cycleInStage = stages.E.cycleInStage;
			const totalCycles = stages.E.totalCyclesInStage;

			// On last cycle of EX, compute result
			if (cycleInStage === totalCycles) {
				// Get effective register values (with forwarding)
				const effectiveRegs = { ...regs };
				for (const fwd of stages.E.forwardingUsed) {
					if (fwd.register !== '$0') {
						effectiveRegs[fwd.register] = fwd.value;
					}
				}

				if (instr.type === 'alu') {
					exeResult = executeAlu(instr, effectiveRegs);
					// Add to forwardable results (EX→EX path)
					if (instr.rd && config.forwarding.exToEx) {
						forwardableResults.set(instr.rd, {
							value: exeResult,
							fromInstr: instr.index,
							fromStage: 'E'
						});
					}
				} else if (instr.type === 'branch') {
					branchTaken = evaluateBranch(instr, effectiveRegs);
					if (branchTaken && instr.targetLabel) {
						branchTarget = labels.get(instr.targetLabel) ?? -1;
					}

					// Check prediction
					const predicted = predictor.predict(instr.index);
					predictor.update(instr.index, branchTaken);

					const prediction: BranchPrediction = {
						instructionIndex: instr.index,
						predicted,
						actual: branchTaken,
						correct: predicted === branchTaken,
						flushCycles: 0
					};

					// If mispredicted, need to flush
					if (predicted !== branchTaken) {
						// Flush instructions in F and D stages
						if (stages.F?.instr) {
							stages.F.flushed = true;
							prediction.flushCycles++;
						}
						if (stages.D?.instr) {
							stages.D.flushed = true;
							prediction.flushCycles++;
						}

						// Update PC based on actual outcome
						if (branchTaken && branchTarget >= 0) {
							pc = branchTarget;
						} else {
							// Not taken - PC should be instruction after branch
							pc = instr.index + 1;
						}
					}

					predictions.push(prediction);
				} else if (instr.type === 'load' || instr.type === 'store') {
					// Calculate address for load/store
					const effectiveRegs2 = { ...regs };
					for (const fwd of stages.E.forwardingUsed) {
						if (fwd.register !== 'x0') {
							effectiveRegs2[fwd.register] = fwd.value;
						}
					}
					const addr = (effectiveRegs2[instr.rs1 ?? 'x0'] ?? 0) + (instr.imm ?? 0);
					exeResult = addr;
				}
			}
		}

		// === DECODE STAGE - Check for hazards ===
		let decodeStalled = false;
		let hazardInfo: HazardInfo | undefined;

		if (stages.D?.instr && !stages.D.flushed) {
			const instr = stages.D.instr;
			const sources = getSourceRegisters(instr);

			// Check for hazards with instructions in E and M stages
			for (const source of sources) {
				// Check E stage
				if (stages.E?.instr && !stages.E.flushed) {
					const exDest = getDestRegister(stages.E.instr);
					if (exDest === source) {
						const remainingExCycles = stages.E.totalCyclesInStage - stages.E.cycleInStage;
						if (remainingExCycles > 0) {
							// Need to stall
							decodeStalled = true;
							hazardInfo = {
								type: 'raw',
								cycle,
								instructionIndex: instr.index,
								description: `RAW hazard: ${source} from I${stages.E.instr.index + 1}`,
								dependsOn: stages.E.instr.index,
								register: source
							};
							break;
						} else if (stages.E.instr.type === 'load' && !config.forwarding.memToEx) {
							// Load-use hazard without MEM→EX forwarding
							decodeStalled = true;
							hazardInfo = {
								type: 'raw',
								cycle,
								instructionIndex: instr.index,
								description: `Load-use hazard: ${source} from I${stages.E.instr.index + 1}`,
								dependsOn: stages.E.instr.index,
								register: source
							};
							break;
						} else if (stages.E.instr.type === 'load' && config.forwarding.memToEx) {
							// Load-use hazard - must stall 1 cycle even with MEM→EX forwarding
							decodeStalled = true;
							hazardInfo = {
								type: 'raw',
								cycle,
								instructionIndex: instr.index,
								description: `Load-use hazard: ${source} from I${stages.E.instr.index + 1} (1 cycle stall)`,
								dependsOn: stages.E.instr.index,
								register: source
							};
							break;
						}
					}
				}

				// Check M stage (only matters without MEM→EX forwarding)
				if (!config.forwarding.memToEx && stages.M?.instr && !stages.M.flushed) {
					const memDest = getDestRegister(stages.M.instr);
					if (memDest === source) {
						decodeStalled = true;
						hazardInfo = {
							type: 'raw',
							cycle,
							instructionIndex: instr.index,
							description: `RAW hazard: ${source} from I${stages.M.instr.index + 1}`,
							dependsOn: stages.M.instr.index,
							register: source
						};
						break;
					}
				}
			}

			if (hazardInfo) {
				hazards.push(hazardInfo);
			}
		}

		// === UPDATE TIMELINE ===
		for (const stage of ['F', 'D', 'E', 'M', 'W'] as StageName[]) {
			const pStage = stages[stage];
			if (pStage?.instr) {
				const entry: CycleEntry = {
					stage: pStage.flushed ? 'bubble' : stage,
					flushed: pStage.flushed
				};

				if (pStage.totalCyclesInStage > 1) {
					entry.cycleInStage = pStage.cycleInStage;
					entry.totalCycles = pStage.totalCyclesInStage;
				}

				if (pStage.forwardingUsed.length > 0) {
					entry.forwardingFrom = pStage.forwardingUsed;
				}

				// Pad timeline if needed
				while (timeline[pStage.instr.index].length < cycle - 1) {
					timeline[pStage.instr.index].push({ stage: 'bubble' });
				}
				timeline[pStage.instr.index][cycle - 1] = entry;
			}
		}

		// Handle stall in decode
		if (decodeStalled && stages.D?.instr) {
			// Record stall
			const stallEntry: CycleEntry = {
				stage: 'stall',
				hazardType: 'raw'
			};
			// Don't advance D to E, don't fetch new instruction
			while (timeline[stages.D.instr.index].length < cycle) {
				timeline[stages.D.instr.index].push(stallEntry);
			}
		}

		// === ADVANCE PIPELINE ===
		// W stage completes
		stages.W = null;

		// M -> W
		if (stages.M?.instr) {
			const mStage = stages.M;
			const mInstr = mStage.instr!;
			if (mStage.cycleInStage >= mStage.totalCyclesInStage) {
				stages.W = {
					instr: mInstr,
					cycleInStage: 1,
					totalCyclesInStage: 1,
					computedValue: mInstr.type === 'load' ? memResult : mStage.computedValue,
					forwardingUsed: [],
					flushed: mStage.flushed
				};
				stages.M = null;
			} else {
				stages.M.cycleInStage++;
			}
		}

		// E -> M
		if (stages.E?.instr) {
			const eStage = stages.E;
			const eInstr = eStage.instr!;
			if (eStage.cycleInStage >= eStage.totalCyclesInStage) {
				const memCycles =
					eInstr.type === 'load' || eInstr.type === 'store' ? config.latencies.mem : 1;
				stages.M = {
					instr: eInstr,
					cycleInStage: 1,
					totalCyclesInStage: memCycles,
					computedValue: exeResult,
					forwardingUsed: [],
					flushed: eStage.flushed
				};
				stages.E = null;
			} else {
				stages.E.cycleInStage++;
			}
		}

		// D -> E (if not stalled)
		if (!decodeStalled && stages.D?.instr) {
			const dStage = stages.D;
			const dInstr = dStage.instr!;

			// Gather forwarding based on enabled paths
			const fwdUsed: ForwardingInfo[] = [];
			const sources = getSourceRegisters(dInstr);
			for (const src of sources) {
				const fwd = forwardableResults.get(src);
				if (fwd) {
					// Check if the relevant forwarding path is enabled
					const canForward =
						(fwd.fromStage === 'E' && config.forwarding.exToEx) ||
						(fwd.fromStage === 'M' && config.forwarding.memToEx);
					if (canForward) {
						fwdUsed.push({
							fromInstruction: fwd.fromInstr,
							fromStage: fwd.fromStage,
							toStage: 'E',
							register: src,
							value: fwd.value
						});
					}
				}
			}

			// Determine EX latency
			let exeCycles = config.latencies.alu;
			if (dInstr.aluOp === 'mul') {
				exeCycles = config.latencies.mul;
			}

			stages.E = {
				instr: dInstr,
				cycleInStage: 1,
				totalCyclesInStage: exeCycles,
				forwardingUsed: fwdUsed,
				flushed: dStage.flushed
			};
			stages.D = null;
		}

		// F -> D (if not stalled)
		if (!decodeStalled && stages.F?.instr) {
			stages.D = {
				instr: stages.F.instr,
				cycleInStage: 1,
				totalCyclesInStage: 1,
				forwardingUsed: [],
				flushed: stages.F.flushed
			};
			stages.F = null;
		}

		// Fetch new instruction (if not stalled and PC valid)
		if (!decodeStalled && !stages.F && pc < instructions.length) {
			stages.F = {
				instr: instructions[pc],
				cycleInStage: 1,
				totalCyclesInStage: 1,
				forwardingUsed: [],
				flushed: false
			};
			pc++;
		}

		cycle++;
	}

	// Pad timelines to equal length
	const maxLen = Math.max(...timeline.map((t) => t.length));
	for (const t of timeline) {
		while (t.length < maxLen) {
			t.push({ stage: 'bubble' });
		}
	}

	return {
		timeline,
		totalCycles: cycle - 1,
		hazards,
		predictions,
		mispredictions: predictions.filter((p) => !p.correct).length,
		finalRegisters: regs,
		finalMemory: mem
	};
}
