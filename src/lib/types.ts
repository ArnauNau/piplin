// Pipeline stage names
export type StageName = 'F' | 'D' | 'E' | 'M' | 'W';

// Instruction types
export type InstructionType = 'alu' | 'load' | 'store' | 'branch' | 'nop';

// ALU operations (for determining latency)
export type AluOp = 'add' | 'sub' | 'mul' | 'and' | 'or' | 'xor' | 'slt';

// Parsed instruction
export interface Instruction {
	raw: string;
	index: number; // position in program
	opcode: string; // ADD, SUB, LW, etc.
	type: InstructionType;
	rd?: string; // destination register
	rs1?: string; // source register 1
	rs2?: string; // source register 2
	imm?: number; // immediate value
	aluOp?: AluOp; // for determining ALU latency
	targetLabel?: string; // branch target label
	label?: string; // label defined at this instruction
}

// What's happening in a cycle for an instruction
export interface CycleEntry {
	stage: StageName | 'stall' | 'bubble';
	cycleInStage?: number; // for multi-cycle stages: which cycle (1, 2, 3...)
	totalCycles?: number; // for multi-cycle stages: total cycles in this stage
	hazardType?: HazardType;
	forwardingFrom?: ForwardingInfo[];
	flushed?: boolean; // true if this was flushed due to misprediction
}

// Hazard types
export type HazardType = 'raw' | 'structural' | 'control';

// Hazard information for display
export interface HazardInfo {
	type: HazardType;
	cycle: number;
	instructionIndex: number;
	description: string;
	dependsOn?: number; // index of instruction causing hazard
	register?: string; // register involved in RAW hazard
}

// Forwarding path info
export interface ForwardingInfo {
	fromInstruction: number;
	fromStage: 'E' | 'M';
	toStage: 'E';
	register: string;
	value: number;
}

// Branch prediction info
export interface BranchPrediction {
	instructionIndex: number;
	predicted: boolean; // true = taken, false = not taken
	actual: boolean; // true = taken, false = not taken
	correct: boolean;
	flushCycles: number; // cycles lost due to misprediction
}

// Register file: x0-x31
export type RegisterFile = Record<string, number>;

// Memory: address -> value
export type Memory = Map<number, number>;

// Simulation result
export interface SimulationResult {
	timeline: CycleEntry[][]; // [instructionIdx][cycle]
	totalCycles: number;
	hazards: HazardInfo[];
	predictions: BranchPrediction[];
	mispredictions: number;
	finalRegisters: RegisterFile;
	finalMemory: Memory;
}

// Branch predictor types
export type BranchPredictorType = 'none' | '1bit' | '2bit';

// Forwarding configuration per path
export interface ForwardingConfig {
	exToEx: boolean; // EX→EX: forward ALU result to next instruction
	memToEx: boolean; // MEM→EX: forward from MEM stage to EX
}

// Configuration
export interface Config {
	latencies: {
		alu: number; // default ALU latency (add, sub, etc.)
		mul: number; // multiply latency
		mem: number; // memory access latency
	};
	forwarding: ForwardingConfig;
	branchPredictor: BranchPredictorType;
	predictorInitial: 'taken' | 'not-taken';
	initialRegisters: RegisterFile;
	initialMemory: Memory;
}

// Default configuration
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

// Create default register file ($0-$31, $0 hardwired to 0)
export function createDefaultRegisters(): RegisterFile {
	const regs: RegisterFile = {};
	for (let i = 0; i < 32; i++) {
		regs[`$${i}`] = 0;
	}
	return regs;
}

// Parse result with potential errors
export interface ParseResult {
	instructions: Instruction[];
	labels: Map<string, number>; // label -> instruction index
	errors: ParseError[];
}

export interface ParseError {
	line: number;
	message: string;
}
