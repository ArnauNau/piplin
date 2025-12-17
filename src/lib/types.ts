export type StageName = 'F' | 'D' | 'E' | 'M' | 'W';

export type InstructionType = 'alu' | 'load' | 'store' | 'branch' | 'nop';

export type AluOp = 'add' | 'sub' | 'mul' | 'and' | 'or' | 'xor' | 'slt';

export interface Instruction {
	raw: string;
	index: number;
	opcode: string;
	type: InstructionType;
	rd?: string; // destination register
	rs1?: string; // source register 1
	rs2?: string; // source register 2
	imm?: number; // immediate value
	aluOp?: AluOp; // for determining ALU latency
	targetLabel?: string; // branch target label
	label?: string; // label defined at this instruction
}

export interface CycleEntry {
	stage: StageName | 'stall' | 'bubble';
	cycleInStage?: number; // for multi-cycle stages: which cycle (1, 2, 3...)
	totalCycles?: number; // for multi-cycle stages: total cycles in this stage
	hazardType?: HazardType;
	forwardingFrom?: ForwardingInfo[];
	flushed?: boolean; // true if flushed due to misprediction
}

export type HazardType = 'raw' | 'structural' | 'control';

export interface HazardInfo {
	type: HazardType;
	cycle: number;
	instructionIndex: number;
	description: string;
	dependsOn?: number; // index of instruction causing hazard
	register?: string; // register involved in RAW hazard
}

export interface ForwardingInfo {
	fromInstruction: number;
	fromStage: 'E' | 'M';
	toStage: 'E';
	register: string;
	value: number;
}

export interface BranchPrediction {
	instructionIndex: number;
	predicted: boolean; // true = taken, false = not taken
	actual: boolean; // true = taken, false = not taken
	correct: boolean;
	flushCycles: number; // cycles lost due to misprediction
}

export type RegisterFile = Record<string, number>;

export type Memory = Map<number, number>;

export interface TraceEntry {
	instruction: Instruction;
	timeline: CycleEntry[];
	label?: string;
}

export interface SimulationResult {
	trace: TraceEntry[];
	totalCycles: number;
	hazards: HazardInfo[];
	predictions: BranchPrediction[];
	mispredictions: number;
	finalRegisters: RegisterFile;
	finalMemory: Memory;
}

export type BranchPredictorType = 'none' | '1bit' | '2bit';

export interface ForwardingConfig {
	exToEx: boolean; // EX→EX: forward ALU result to next instruction
	memToEx: boolean; // MEM→EX: forward from MEM stage to EX
}

export interface Config {
	latencies: {
		alu: number; // default ALU latency (add, sub, etc.)
		mul: number;
		mem: number;
	};
	forwarding: ForwardingConfig;
	branchPredictor: BranchPredictorType;
	predictorInitial: 'taken' | 'not-taken';
	initialRegisters: RegisterFile;
	initialMemory: Memory;
}

export function defaultConfig(): Config {
	return {
		latencies: {
			alu: 1,
			mul: 6,
			mem: 2
		},
		forwarding: {
			exToEx: true,
			memToEx: true
		},
		branchPredictor: 'none',
		predictorInitial: 'not-taken',
		initialRegisters: createDefaultRegisters(),
		initialMemory: new Map()
	};
}

export function createDefaultRegisters(): RegisterFile {
	const regs: RegisterFile = {};
	for (let i = 0; i < 32; i++) {
		regs[`$${i}`] = 0;
	}
	return regs;
}

export interface ParseResult {
	instructions: Instruction[];
	labels: Map<string, number>;
	errors: ParseError[];
}

export interface ParseError {
	line: number;
	message: string;
}
