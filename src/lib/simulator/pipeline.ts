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
	BranchPrediction,
	ExecutionInstance,
	ExecutionId
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

interface PipelineStage {
	instr: Instruction | null;
	cycleInStage: number;
	totalCyclesInStage: number;
	computedValue?: number;
	forwardingUsed: ForwardingInfo[];
	flushed: boolean;
}

//tracking for dynamic tracing
interface ActiveStage {
	executionId: ExecutionId; //unique ID for this execution instance
	stage: PipelineStage;
}

export function simulatePipeline(
	instructions: Instruction[],
	labels: Map<string, number>,
	config: Config
): SimulationResult {
	if (instructions.length === 0) {
		return {
			trace: [],
			instanceMap: new Map(),
			totalCycles: 0,
			hazards: [],
			predictions: [],
			mispredictions: 0,
			finalRegisters: config.initialRegisters ?? createDefaultRegisters(),
			finalMemory: config.initialMemory ?? new Map()
		};
	}

	const regs: RegisterFile = cloneRegisters(config.initialRegisters ?? createDefaultRegisters());
	const mem: Memory = cloneMemory(config.initialMemory ?? new Map());
	const predictor: BranchPredictor = createBranchPredictor(
		config.branchPredictor,
		config.predictorInitial
	);

	//dynamic execution trace
	const trace: ExecutionInstance[] = [];
	const instanceMap: Map<ExecutionId, ExecutionInstance> = new Map();
	const hazards: HazardInfo[] = [];
	const predictions: BranchPrediction[] = [];

	//execution instance tracking
	let nextExecutionId: ExecutionId = 0;
	const iterationCounts: Map<number, number> = new Map(); // instrIndex -> iteration count

	//current state
	let pc = 0;
	let cycle = 1;

	//pending flush flag to defer invalidation until end of cycle
	let pendingFlush = false;

	const stages: Record<StageName, ActiveStage | null> = {
		F: null,
		D: null,
		E: null,
		M: null,
		W: null
	};

	//results available for forwarding (from EX and MEM stages); maps register name to value and source info
	const forwardableResults: Map<
		string,
		{ value: number; fromExecution: ExecutionId; fromStage: 'E' | 'M' }
	> = new Map();

	//to prevent infinite loops (no static analysis for now)
	const MAX_CYCLES = 1000;

	//initialize first instruction in Fetch
	if (instructions.length > 0) {
		const label = Array.from(labels.entries()).find(([_, idx]) => idx === 0)?.[0];
		const execId = nextExecutionId++;
		const iteration = 0;
		iterationCounts.set(0, 1);

		const instance: ExecutionInstance = {
			executionId: execId,
			instruction: instructions[0],
			timeline: [],
			label: label ? `${label}:` : undefined,
			iteration
		};
		trace.push(instance);
		instanceMap.set(execId, instance);

		stages.F = {
			executionId: execId,
			stage: {
				instr: instructions[0],
				cycleInStage: 1,
				totalCyclesInStage: 1,
				forwardingUsed: [],
				flushed: false
			}
		};
		pc = 1;
	}

	while (cycle <= MAX_CYCLES) {
		//check termination
		const isPipelineEmpty = Object.values(stages).every((stage) => stage === null);
		if (isPipelineEmpty && pc >= instructions.length && cycle > 1) {
			break;
		}

		//clear forwards from last cycle
		forwardableResults.clear();
		pendingFlush = false;

		//#region WRITEBACK STAGE
		if (stages.W && !stages.W.stage.flushed) {
			const { stage } = stages.W;
			const { instr } = stage;
			//write result to register file
			if (instr && instr.rd && instr.rd !== '$0') {
				if (instr.type === 'alu' || instr.type === 'load') {
					setRegValue(regs, instr.rd, stage.computedValue ?? 0);
				}
			}
		}

		//#region MEMORY STAGE
		let memResult: number | undefined;

		if (stages.M && !stages.M.stage.flushed) {
			const { stage, executionId } = stages.M;
			const { instr } = stage;

			if (instr) {
				//execute at end of MEM stage
				if (stage.cycleInStage === stage.totalCyclesInStage) {
					if (instr.type === 'load') {
						memResult = executeLoad(instr, regs, mem);
						if (instr.rd && config.forwarding.memToEx) {
							forwardableResults.set(instr.rd, {
								value: memResult,
								fromExecution: executionId,
								fromStage: 'M'
							});
						}
					} else if (instr.type === 'store') {
						executeStore(instr, regs, mem);
					} else if (instr.type === 'alu' && instr.rd && config.forwarding.memToEx) {
						forwardableResults.set(instr.rd, {
							value: stage.computedValue ?? 0,
							fromExecution: executionId,
							fromStage: 'M'
						});
					}
				} else {
					//if MEM latency > 1, can we forward early? usually only at end, but for ALU in MEM stage, value is ready
					if (instr.type === 'alu' && instr.rd && config.forwarding.memToEx) {
						forwardableResults.set(instr.rd, {
							value: stage.computedValue ?? 0,
							fromExecution: executionId,
							fromStage: 'M'
						});
					}
				}
			}
		}

		//#region EXECUTE STAGE
		let exeResult: number | undefined;
		let branchTaken = false;
		let branchTarget = -1;

		if (stages.E && !stages.E.stage.flushed) {
			const { stage, executionId } = stages.E;
			const { instr } = stage;

			if (instr) {
				// Logic execution at end of stage
				if (stage.cycleInStage === stage.totalCyclesInStage) {
					const effectiveRegs = { ...regs };
					for (const fwd of stage.forwardingUsed) {
						if (fwd.register !== '$0') effectiveRegs[fwd.register] = fwd.value;
					}

					if (instr.type === 'alu') {
						exeResult = executeAlu(instr, effectiveRegs);
						if (instr.rd && config.forwarding.exToEx) {
							forwardableResults.set(instr.rd, {
								value: exeResult,
								fromExecution: executionId,
								fromStage: 'E'
							});
						}
					} else if (instr.type === 'branch') {
						branchTaken = evaluateBranch(instr, effectiveRegs);
						if (branchTaken && instr.targetLabel) {
							branchTarget = labels.get(instr.targetLabel) ?? -1;
						}

						const predicted = predictor.predict(instr.index);
						predictor.update(instr.index, branchTaken);

						const prediction: BranchPrediction = {
							executionId,
							predicted,
							actual: branchTaken,
							correct: predicted === branchTaken,
							flushCycles: 0
						};

						if (predicted !== branchTaken) {
							//flush earlier stages (deferred)
							//F, D are 'younger' than E
							pendingFlush = true;
							if (stages.F) {
								prediction.flushCycles++;
							}
							if (stages.D) {
								prediction.flushCycles++;
							}

							//correct PC
							pc = branchTaken && branchTarget >= 0 ? branchTarget : instr.index + 1;
						}

						predictions.push(prediction);
					} else if (instr.type === 'load' || instr.type === 'store') {
						const effectiveRegs2 = { ...regs };

						for (const fwd of stage.forwardingUsed) {
							if (fwd.register !== '$0') effectiveRegs2[fwd.register] = fwd.value;
						}

						const addr = (effectiveRegs2[instr.rs1 ?? '$0'] ?? 0) + (instr.imm ?? 0);
						exeResult = addr;
					}
				}
			}
		}
		//#endregion
		//#region DECODE STAGE
		let decodeStalled = false;
		let hazardInfo: HazardInfo | undefined;

		if (stages.D && !stages.D.stage.flushed) {
			const { stage, executionId } = stages.D;
			const { instr } = stage;

			if (instr) {
				//check for structural hazard (EX busy in multi-cycle op?)
				if (stages.E && stages.E.stage.cycleInStage < stages.E.stage.totalCyclesInStage) {
					decodeStalled = true;
					hazardInfo = {
						type: 'structural',
						cycle,
						executionId,
						description: 'Structural Hazard: Unit Busy',
						dependsOnExecution: stages.E.executionId,
						register: 'ALU'
					};
				}

				const sources = getSourceRegisters(instr);
				for (const source of sources) {
					//check W hazard
					//transparency check, if OFF can't read register in D while written in W. Stall until W completes.
					if (
						!config.regFileTransparency &&
						stages.W &&
						!stages.W.stage.flushed &&
						stages.W.stage.instr
					) {
						const wDest = getDestRegister(stages.W.stage.instr);
						if (wDest === source && wDest !== '$0') {
							decodeStalled = true;
							hazardInfo = {
								type: 'structural',
								cycle,
								executionId,
								description: `Wait for WB on ${source}`,
								dependsOnExecution: stages.W.executionId,
								register: source
							};
							break;
						}
					}

					//check E Hazard
					if (stages.E && !stages.E.stage.flushed && stages.E.stage.instr) {
						const exDest = getDestRegister(stages.E.stage.instr);
						if (exDest === source) {
							const isLoad = stages.E.stage.instr.type === 'load';

							//if data depends on instruction in EX:

							//case 1: LOAD. result is NOT ready until MEM ends. must stall D->E regardless of forwarding.
							if (isLoad) {
								decodeStalled = true;
								hazardInfo = {
									type: 'raw',
									cycle,
									executionId,
									description: `Data (Load-use) hazard: ${source}`,
									dependsOnExecution: stages.E.executionId,
									register: source
								};
								break;
							}

							//case 2: ALU. result is computed in EX. if EX->EX forwarding is ON, proceed. if OFF, stall.
							if (!config.forwarding.exToEx) {
								decodeStalled = true;
								hazardInfo = {
									type: 'raw',
									cycle,
									executionId,
									description: `Data (Read-After-Write) hazard: ${source}`,
									dependsOnExecution: stages.E.executionId,
									register: source
								};
								break;
							}
						}
					}

					//check M hazard
					if (stages.M && !stages.M.stage.flushed && stages.M.stage.instr) {
						const memDest = getDestRegister(stages.M.stage.instr);
						if (memDest === source) {
							const remaining =
								stages.M.stage.totalCyclesInStage - stages.M.stage.cycleInStage;

							//if M stage is not finished (multi-cycle latency), must stall.
							if (remaining > 0) {
								decodeStalled = true;
								hazardInfo = {
									type: 'raw',
									cycle,
									executionId,
									description: `Data (Read-After-Write) hazard: ${source}`,
									dependsOnExecution: stages.M.executionId,
									register: source
								};
								break;
							}

							//if M stage is finished (remaining == 0):
							//if forwarding (memToEx) is OFF, cannot bypass from M.
							//must wait for the instruction to reach WB (next cycle) to ensure registers are updated before D reads them (or D->E happens).
							if (!config.forwarding.memToEx) {
								decodeStalled = true;
								hazardInfo = {
									type: 'raw',
									cycle,
									executionId,
									description: `Data (Read-After-Write) hazard: ${source}`,
									dependsOnExecution: stages.M.executionId,
									register: source
								};
								break;
							}

							//if forwarding enabled, proceed.
						}
					}
				}
			}

			if (hazardInfo) {
				hazards.push(hazardInfo);
			}
		}

		//#region UPDATE TIMELINE
		const addCycleToTimeline = (execId: ExecutionId, entry: CycleEntry) => {
			const instance = instanceMap.get(execId);
			if (!instance) return;
			while (instance.timeline.length < cycle - 1) {
				instance.timeline.push({ stage: 'bubble' });
			}
			instance.timeline[cycle - 1] = entry;
		};

		if (decodeStalled && stages.D) {
			addCycleToTimeline(stages.D.executionId, { stage: 'stall', hazardType: 'raw' });
		}

		for (const sName of ['F', 'D', 'E', 'M', 'W'] as StageName[]) {
			const active = stages[sName];
			if (active) {
				if (sName === 'D' && decodeStalled) {
					// Already handled stall entry above
				} else if (sName === 'F' && decodeStalled) {
					// F stalled
					addCycleToTimeline(active.executionId, {
						stage: 'stall',
						hazardType: 'structural'
					});
				} else {
					// Normal execution
					addCycleToTimeline(active.executionId, {
						stage: sName,
						flushed: active.stage.flushed,
						cycleInStage:
							active.stage.totalCyclesInStage > 1
								? active.stage.cycleInStage
								: undefined,
						totalCycles:
							active.stage.totalCyclesInStage > 1
								? active.stage.totalCyclesInStage
								: undefined,
						forwardingFrom:
							active.stage.forwardingUsed.length > 0
								? active.stage.forwardingUsed
								: undefined
					});
				}
			}
		}

		//#region ADVANCE PIPELINE
		if (pendingFlush) {
			if (stages.F) {
				stages.F.stage.flushed = true;
			}
			if (stages.D) {
				stages.D.stage.flushed = true;
			}
		}

		// W stage complete
		stages.W = null;

		// M -> W
		if (stages.M) {
			if (stages.M.stage.cycleInStage >= stages.M.stage.totalCyclesInStage) {
				stages.W = {
					executionId: stages.M.executionId,
					stage: {
						...stages.M.stage,
						cycleInStage: 1,
						totalCyclesInStage: 1,
						computedValue:
							stages.M.stage.instr?.type === 'load'
								? memResult
								: stages.M.stage.computedValue
					}
				};
				stages.M = null;
			} else {
				stages.M.stage.cycleInStage++;
			}
		}

		// E -> M
		if (stages.E && !stages.M) {
			if (stages.E.stage.cycleInStage >= stages.E.stage.totalCyclesInStage) {
				const memCycles =
					stages.E.stage.instr?.type === 'load' || stages.E.stage.instr?.type === 'store'
						? config.latencies.mem
						: 1;

				stages.M = {
					executionId: stages.E.executionId,
					stage: {
						...stages.E.stage,
						cycleInStage: 1,
						totalCyclesInStage: memCycles,
						computedValue: exeResult,
						forwardingUsed: []
					}
				};
				stages.E = null;
			} else {
				stages.E.stage.cycleInStage++;
			}
		}

		// D -> E (if not stalled)
		if (!decodeStalled && stages.D && !stages.E) {
			const instr = stages.D.stage.instr;

			//calculate forwarding
			const fwdUsed: ForwardingInfo[] = [];
			if (instr) {
				for (const src of getSourceRegisters(instr)) {
					const fwd = forwardableResults.get(src);
					if (fwd) {
						const canForward =
							(fwd.fromStage === 'E' && config.forwarding.exToEx) ||
							(fwd.fromStage === 'M' && config.forwarding.memToEx);
						if (canForward) {
							fwdUsed.push({
								fromExecution: fwd.fromExecution,
								fromStage: fwd.fromStage,
								toStage: 'E',
								register: src,
								value: fwd.value
							});
						}
					}
				}
			}

			let exeCycles = config.latencies.alu;
			if (instr?.aluOp === 'mul') {
				exeCycles = config.latencies.mul;
			}

			stages.E = {
				executionId: stages.D.executionId,
				stage: {
					...stages.D.stage,
					cycleInStage: 1,
					totalCyclesInStage: exeCycles,
					forwardingUsed: fwdUsed
				}
			};
			stages.D = null;
		}

		// F -> D
		if (!decodeStalled && stages.F && !stages.D) {
			stages.D = {
				executionId: stages.F.executionId,
				stage: {
					...stages.F.stage,
					cycleInStage: 1,
					totalCyclesInStage: 1,
					forwardingUsed: []
				}
			};
			stages.F = null;
		}

		//fetch new instruction (if not stalled and PC valid)
		if (!decodeStalled && !stages.F && pc < instructions.length) {
			const label = Array.from(labels.entries()).find(([_, idx]) => idx === pc)?.[0];
			const instrIndex = instructions[pc].index;
			const iteration = iterationCounts.get(instrIndex) ?? 0;
			iterationCounts.set(instrIndex, iteration + 1);
			const execId = nextExecutionId++;

			const instance: ExecutionInstance = {
				executionId: execId,
				instruction: instructions[pc],
				timeline: [],
				label: label ? `${label}:` : undefined,
				iteration
			};
			trace.push(instance);
			instanceMap.set(execId, instance);

			//backfill bubbles for missed cycles
			while (instance.timeline.length < cycle) {
				instance.timeline.push({ stage: 'bubble' });
			}

			stages.F = {
				executionId: execId,
				stage: {
					instr: instructions[pc],
					cycleInStage: 1,
					totalCyclesInStage: 1,
					forwardingUsed: [],
					flushed: false
				}
			};

			//determine next PC
			let nextPc = pc + 1;
			const currentInstr = instructions[pc];
			if (currentInstr.type === 'branch') {
				const predictedTaken = predictor.predict(currentInstr.index);
				if (predictedTaken && currentInstr.targetLabel) {
					const targetIndex = labels.get(currentInstr.targetLabel);
					if (targetIndex !== undefined) {
						nextPc = targetIndex;
					}
				}
			}
			pc = nextPc;
		}

		cycle++;
	}

	//final padding (TODO: this will change when repeating instructions are draw on same row)
	const totalCycles = cycle - 1;
	for (const t of trace) {
		while (t.timeline.length < totalCycles) {
			t.timeline.push({ stage: 'bubble' });
		}
	}

	return {
		trace,
		instanceMap,
		totalCycles,
		hazards,
		predictions,
		mispredictions: predictions.filter((p) => !p.correct).length,
		finalRegisters: regs,
		finalMemory: mem
	};
}
