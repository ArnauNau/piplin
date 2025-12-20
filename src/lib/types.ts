export type StageName = 'F' | 'D' | 'E' | 'M' | 'W';

export type InstructionType = 'alu' | 'load' | 'store' | 'branch' | 'nop';

export type AluOp = 'add' | 'sub' | 'mul' | 'and' | 'or' | 'xor' | 'slt';

export type HazardType = 'structural' | 'raw' | 'control';

export type BranchPredictorType = 'none' | '1bit' | '2bit';

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

export interface RegisterFile {
	[register: string]: number;
}

export function createDefaultRegisters(): RegisterFile {
	const regs: RegisterFile = {};
	for (let i = 0; i < 32; i++) {
		regs[`$${i}`] = 0;
	}
	return regs;
}

export interface Memory {
	get(address: number): number | undefined;
	set(address: number, value: number): void;
	entries(): IterableIterator<[number, number]>;
}

export interface TraceEntry {
	instruction: Instruction;
	timeline: CycleEntry[];
	label?: string;
}

export interface Config {
	latencies: {
		alu: number; // default ALU latency (add, sub, etc.)
		mul: number;
		mem: number;
	};
	forwarding: {
		exToEx: boolean;
		memToEx: boolean;
	};
	branchPredictor: BranchPredictorType;
	predictorInitial: 'taken' | 'not-taken';
	initialRegisters: RegisterFile;
	initialMemory: Memory;
	regFileTransparency: boolean; //true = allow simultaneous / split-cycle, false = wait for WB
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
		initialMemory: new Map(),
		regFileTransparency: false
	};
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

export interface SimulationResult {
	trace: TraceEntry[];
	totalCycles: number;
	hazards: HazardInfo[];
	predictions: BranchPrediction[];
	mispredictions: number;
	finalRegisters: RegisterFile;
	finalMemory: Memory;
}
