import type { Instruction, InstructionType, AluOp, ParseResult, ParseError } from './types';

// R-type: opcode rd, rs1, rs2
const R_TYPE_OPS = ['ADD', 'SUB', 'MUL', 'AND', 'OR', 'XOR', 'SLT'];

// I-type: opcode rd, rs1, imm
const I_TYPE_ALU_OPS = ['ADDI', 'ANDI', 'ORI', 'XORI', 'SLTI'];

// Load: opcode rd, offset(rs1)
const LOAD_OPS = ['LW', 'LB', 'LH'];

// Store: opcode rs2, offset(rs1)
const STORE_OPS = ['SW', 'SB', 'SH'];

// Branch: opcode rs1, rs2, label
const BRANCH_OPS = ['BEQ', 'BNE', 'BLT', 'BGE'];

// Map opcodes to ALU operations
const OPCODE_TO_ALU: Record<string, AluOp> = {
	ADD: 'add',
	ADDI: 'add',
	SUB: 'sub',
	MUL: 'mul',
	AND: 'and',
	ANDI: 'and',
	OR: 'or',
	ORI: 'or',
	XOR: 'xor',
	XORI: 'xor',
	SLT: 'slt',
	SLTI: 'slt'
};

export function parseProgram(code: string): ParseResult {
	const lines = code.split('\n');
	const instructions: Instruction[] = [];
	const labels = new Map<string, number>();
	const errors: ParseError[] = [];

	// First pass: collect labels
	let instrIndex = 0;
	for (let lineNum = 0; lineNum < lines.length; lineNum++) {
		const line = lines[lineNum].trim();
		if (!line || line.startsWith('#') || line.startsWith('//')) continue;

		// Check for label definition
		const labelMatch = line.match(/^(\w+):\s*(.*)/);
		if (labelMatch) {
			const labelName = labelMatch[1];
			if (labels.has(labelName)) {
				errors.push({
					line: lineNum + 1,
					message: `Duplicate label: ${labelName}`
				});
			} else {
				labels.set(labelName, instrIndex);
			}
			// If there's an instruction after the label on the same line
			if (labelMatch[2].trim() && !labelMatch[2].trim().startsWith('#')) {
				instrIndex++;
			}
		} else {
			instrIndex++;
		}
	}

	// Second pass: parse instructions
	instrIndex = 0;
	for (let lineNum = 0; lineNum < lines.length; lineNum++) {
		let line = lines[lineNum].trim();
		if (!line || line.startsWith('#') || line.startsWith('//')) continue;

		// Remove comments
		const commentIdx = line.indexOf('#');
		if (commentIdx !== -1) {
			line = line.substring(0, commentIdx).trim();
		}
		const slashCommentIdx = line.indexOf('//');
		if (slashCommentIdx !== -1) {
			line = line.substring(0, slashCommentIdx).trim();
		}

		let label: string | undefined;

		// Check for label definition
		const labelMatch = line.match(/^(\w+):\s*(.*)/);
		if (labelMatch) {
			label = labelMatch[1];
			line = labelMatch[2].trim();
			if (!line) continue; // Label-only line
		}

		// Parse the instruction
		const instr = parseInstruction(line, instrIndex, lineNum + 1, errors);
		if (instr) {
			instr.label = label;
			instructions.push(instr);
			instrIndex++;
		}
	}

	return { instructions, labels, errors };
}

function parseInstruction(
	line: string,
	index: number,
	lineNum: number,
	errors: ParseError[]
): Instruction | null {
	if (!line) return null;

	// Normalize: remove extra spaces, convert to uppercase for opcode
	const parts = line.split(/[\s,]+/).filter((p) => p);
	if (parts.length === 0) return null;

	const opcode = parts[0].toUpperCase();

	// NOP
	if (opcode === 'NOP') {
		return {
			raw: line,
			index,
			opcode: 'NOP',
			type: 'nop'
		};
	}

	// R-type: ADD rd, rs1, rs2
	if (R_TYPE_OPS.includes(opcode)) {
		if (parts.length < 4) {
			errors.push({
				line: lineNum,
				message: `${opcode} requires 3 operands: rd, rs1, rs2`
			});
			return null;
		}
		const rd = normalizeReg(parts[1]);
		const rs1 = normalizeReg(parts[2]);
		const rs2 = normalizeReg(parts[3]);
		return {
			raw: line,
			index,
			opcode,
			type: 'alu',
			rd,
			rs1,
			rs2,
			aluOp: OPCODE_TO_ALU[opcode]
		};
	}

	// I-type ALU: ADDI rd, rs1, imm
	if (I_TYPE_ALU_OPS.includes(opcode)) {
		if (parts.length < 4) {
			errors.push({
				line: lineNum,
				message: `${opcode} requires 3 operands: rd, rs1, imm`
			});
			return null;
		}
		const rd = normalizeReg(parts[1]);
		const rs1 = normalizeReg(parts[2]);
		const imm = parseImmediate(parts[3]);
		if (imm === null) {
			errors.push({
				line: lineNum,
				message: `Invalid immediate value: ${parts[3]}`
			});
			return null;
		}
		return {
			raw: line,
			index,
			opcode,
			type: 'alu',
			rd,
			rs1,
			imm,
			aluOp: OPCODE_TO_ALU[opcode]
		};
	}

	// Load: LW rd, offset(rs1)
	if (LOAD_OPS.includes(opcode)) {
		if (parts.length < 3) {
			errors.push({
				line: lineNum,
				message: `${opcode} requires: rd, offset(rs1)`
			});
			return null;
		}
		const rd = normalizeReg(parts[1]);
		const memPart = parts.slice(2).join('');
		const memMatch = memPart.match(/(-?\d+)?\((\$?\w+)\)/);
		if (!memMatch) {
			errors.push({
				line: lineNum,
				message: `Invalid memory operand: ${memPart}`
			});
			return null;
		}
		const imm = memMatch[1] ? parseInt(memMatch[1], 10) : 0;
		const rs1 = normalizeReg(memMatch[2]);
		return {
			raw: line,
			index,
			opcode,
			type: 'load',
			rd,
			rs1,
			imm
		};
	}

	// Store: SW rs2, offset(rs1)
	if (STORE_OPS.includes(opcode)) {
		if (parts.length < 3) {
			errors.push({
				line: lineNum,
				message: `${opcode} requires: rs2, offset(rs1)`
			});
			return null;
		}
		const rs2 = normalizeReg(parts[1]);
		const memPart = parts.slice(2).join('');
		const memMatch = memPart.match(/(-?\d+)?\((\$?\w+)\)/);
		if (!memMatch) {
			errors.push({
				line: lineNum,
				message: `Invalid memory operand: ${memPart}`
			});
			return null;
		}
		const imm = memMatch[1] ? parseInt(memMatch[1], 10) : 0;
		const rs1 = normalizeReg(memMatch[2]);
		return {
			raw: line,
			index,
			opcode,
			type: 'store',
			rs1,
			rs2,
			imm
		};
	}

	// Branch: BEQ rs1, rs2, label
	if (BRANCH_OPS.includes(opcode)) {
		if (parts.length < 4) {
			errors.push({
				line: lineNum,
				message: `${opcode} requires: rs1, rs2, label`
			});
			return null;
		}
		const rs1 = normalizeReg(parts[1]);
		const rs2 = normalizeReg(parts[2]);
		const targetLabel = parts[3];
		return {
			raw: line,
			index,
			opcode,
			type: 'branch',
			rs1,
			rs2,
			targetLabel
		};
	}

	errors.push({
		line: lineNum,
		message: `Unknown instruction: ${opcode}`
	});
	return null;
}

// Normalize register names: x1, r1, $1, 1 -> $1
function normalizeReg(reg: string): string {
	reg = reg.trim().toLowerCase();
	// Handle x0, x1, etc.
	if (reg.startsWith('x')) {
		reg = '$' + reg.substring(1);
	}
	// Handle r0, r1, etc.
	else if (reg.startsWith('r')) {
		reg = '$' + reg.substring(1);
	}
	// Handle just numbers
	else if (/^\d+$/.test(reg)) {
		reg = '$' + reg;
	}
	// Handle $0, $1, etc. - already in correct format
	else if (!reg.startsWith('$')) {
		reg = '$' + reg;
	}
	return reg;
}

function parseImmediate(val: string): number | null {
	val = val.trim();
	// Handle hex
	if (val.startsWith('0x') || val.startsWith('0X')) {
		const num = parseInt(val, 16);
		return isNaN(num) ? null : num;
	}
	// Handle decimal
	const num = parseInt(val, 10);
	return isNaN(num) ? null : num;
}
