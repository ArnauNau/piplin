import type { Instruction, RegisterFile, Memory } from '../types';

// Execute an ALU operation and return the result
export function executeAlu(instr: Instruction, regs: RegisterFile): number {
	const rs1Val = instr.rs1 ? getRegValue(regs, instr.rs1) : 0;
	const rs2Val = instr.rs2 ? getRegValue(regs, instr.rs2) : (instr.imm ?? 0);

	switch (instr.opcode.toUpperCase()) {
		case 'ADD':
		case 'ADDI':
		case 'LW': //lw and sw use ADD logic (base + offset)
		case 'SW': //      ^^^
			return rs1Val + rs2Val;
		case 'SUB':
			return rs1Val - rs2Val;
		case 'MUL':
			return rs1Val * rs2Val;
		case 'AND':
		case 'ANDI':
			return rs1Val & rs2Val;
		case 'OR':
		case 'ORI':
			return rs1Val | rs2Val;
		case 'XOR':
		case 'XORI':
			return rs1Val ^ rs2Val;
		case 'SLT':
		case 'SLTI':
			return rs1Val < rs2Val ? 1 : 0;
		default:
			return 0;
	}
}

// Execute a load operation
export function executeLoad(instr: Instruction, regs: RegisterFile, mem: Memory): number {
	const baseAddr = instr.rs1 ? getRegValue(regs, instr.rs1) : 0;
	const offset = instr.imm ?? 0;
	const addr = baseAddr + offset;
	return mem.get(addr) ?? 0;
}

// Execute a store operation
export function executeStore(instr: Instruction, regs: RegisterFile, mem: Memory): void {
	const baseAddr = instr.rs1 ? getRegValue(regs, instr.rs1) : 0;
	const offset = instr.imm ?? 0;
	const addr = baseAddr + offset;
	const value = instr.rs2 ? getRegValue(regs, instr.rs2) : 0;
	mem.set(addr, value);
}

// Evaluate a branch condition (returns true if branch should be taken)
export function evaluateBranch(instr: Instruction, regs: RegisterFile): boolean {
	const rs1Val = instr.rs1 ? getRegValue(regs, instr.rs1) : 0;
	const rs2Val = instr.rs2 ? getRegValue(regs, instr.rs2) : 0;

	switch (instr.opcode.toUpperCase()) {
		case 'BEQ':
			return rs1Val === rs2Val;
		case 'BNE':
			return rs1Val !== rs2Val;
		case 'BLT':
			return rs1Val < rs2Val;
		case 'BGE':
			return rs1Val >= rs2Val;
		default:
			return false;
	}
}

// Calculate memory address for load/store
export function calculateAddress(instr: Instruction, regs: RegisterFile): number {
	const baseAddr = instr.rs1 ? getRegValue(regs, instr.rs1) : 0;
	const offset = instr.imm ?? 0;
	return baseAddr + offset;
}

// Get register value ($0 is always 0)
export function getRegValue(regs: RegisterFile, reg: string): number {
	if (reg === '$0') return 0;
	return regs[reg] ?? 0;
}

// Set register value ($0 cannot be written)
export function setRegValue(regs: RegisterFile, reg: string, value: number): void {
	if (reg === '$0') return;
	regs[reg] = value;
}

// Clone register file
export function cloneRegisters(regs: RegisterFile): RegisterFile {
	return { ...regs };
}

// Clone memory
export function cloneMemory(mem: Memory): Memory {
	return new Map(mem.entries());
}
