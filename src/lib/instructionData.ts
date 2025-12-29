export interface OperandDoc {
	name: string;
	desc: string;
}

export interface InstructionDoc {
	name: string;
	type: string;
	format: string;
	description: string;
	operation?: string;
	operands: OperandDoc[];
	example: string;
}

export const instructionDocs: Record<string, InstructionDoc> = {
	ADD: {
		name: 'ADD',
		type: 'R',
		format: 'ADD rd, rs1, rs2',
		description: 'Adds the values of registers rs1 and rs2 and stores the result in rd.',
		operation: 'R[rd] ← R[rs1] + R[rs2]',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' }
		],
		example: 'ADD $1, $2, $3  # $1 = $2 + $3'
	},
	SUB: {
		name: 'SUB',
		type: 'R',
		format: 'SUB rd, rs1, rs2',
		description: 'Subtracts the values of register rs2 from rs1 and stores the result in rd.',
		operation: 'R[rd] ← R[rs1] - R[rs2]',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' }
		],
		example: 'SUB $1, $2, $3  # $1 = $2 - $3'
	},
	MUL: {
		name: 'MUL',
		type: 'R',
		format: 'MUL rd, rs1, rs2',
		description: 'Multiplies the values of registers rs1 and rs2 and stores the result in rd.',
		operation: 'R[rd] ← R[rs1] × R[rs2]',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' }
		],
		example: 'MUL $1, $2, $3  # $1 = $2 * $3'
	},
	AND: {
		name: 'AND',
		type: 'R',
		format: 'AND rd, rs1, rs2',
		description: 'Bitwise AND on registers rs1 and rs2 and stores the result in rd.',
		operation: 'R[rd] ← R[rs1] & R[rs2]',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' }
		],
		example: 'AND $1, $2, $3  # $1 = $2 & $3'
	},
	OR: {
		name: 'OR',
		type: 'R',
		format: 'OR rd, rs1, rs2',
		description: 'Bitwise OR on registers rs1 and rs2 and stores the result in rd.',
		operation: 'R[rd] ← R[rs1] | R[rs2]',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' }
		],
		example: 'OR $1, $2, $3  # $1 = $2 | $3'
	},
	XOR: {
		name: 'XOR',
		type: 'R',
		format: 'XOR rd, rs1, rs2',
		description: 'Bitwise XOR on registers rs1 and rs2 and stores the result in rd.',
		operation: 'R[rd] ← R[rs1] ^ R[rs2]',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' }
		],
		example: 'XOR $1, $2, $3  # $1 = $2 ^ $3'
	},
	SLT: {
		name: 'SLT',
		type: 'R',
		format: 'SLT rd, rs1, rs2',
		description: 'Set on Less Than. Sets rd to 1 if rs1 < rs2, otherwise 0.',
		operation: 'R[rd] ← (R[rs1] < R[rs2]) ? 1 : 0',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' }
		],
		example: 'SLT $1, $2, $3  # if $2 < $3 then $1 = 1 else $1 = 0'
	},
	ADDI: {
		name: 'ADDI',
		type: 'I',
		format: 'ADDI rd, rs1, imm',
		description: 'Adds an immediate value to register rs1 and stores the result in rd.',
		operation: 'R[rd] ← R[rs1] + imm',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'imm', desc: 'Immediate value (integer)' }
		],
		example: 'ADDI $1, $2, 10  # $1 = $2 + 10'
	},
	ANDI: {
		name: 'ANDI',
		type: 'I',
		format: 'ANDI rd, rs1, imm',
		description: 'Bitwise AND on register rs1 and an immediate value.',
		operation: 'R[rd] ← R[rs1] & imm',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'imm', desc: 'Immediate value' }
		],
		example: 'ANDI $1, $2, 0xFF  # $1 = $2 & 0xFF'
	},
	ORI: {
		name: 'ORI',
		type: 'I',
		format: 'ORI rd, rs1, imm',
		description: 'Bitwise OR on register rs1 and an immediate value.',
		operation: 'R[rd] ← R[rs1] | imm',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'imm', desc: 'Immediate value' }
		],
		example: 'ORI $1, $2, 15  # $1 = $2 | 15'
	},
	XORI: {
		name: 'XORI',
		type: 'I',
		format: 'XORI rd, rs1, imm',
		description: 'Bitwise XOR on register rs1 and an immediate value.',
		operation: 'R[rd] ← R[rs1] ^ imm',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'imm', desc: 'Immediate value' }
		],
		example: 'XORI $1, $2, 1  # $1 = $2 ^ 1'
	},
	SLTI: {
		name: 'SLTI',
		type: 'I',
		format: 'SLTI rd, rs1, imm',
		description: 'Set on Less Than Immediate. Sets rd to 1 if rs1 < imm, otherwise 0.',
		operation: 'R[rd] ← (R[rs1] < imm) ? 1 : 0',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'imm', desc: 'Immediate value' }
		],
		example: 'SLTI $1, $2, 10  # if $2 < 10 then $1 = 1 else $1 = 0'
	},
	LW: {
		name: 'LW',
		type: 'I',
		format: 'LW rd, offset(rs1)',
		description: 'Loads a word from memory at address rs1 + offset into rd.',
		operation: 'R[rd] ← Mem[R[rs1] + offset]',
		operands: [
			{ name: 'rd', desc: 'Destination register' },
			{ name: 'offset', desc: 'Byte offset' },
			{ name: 'rs1', desc: 'Base address register' }
		],
		example: 'LW $1, 4($2)  # $1 = Memory[$2 + 4]'
	},
	// LB: {
	// 	name: 'LB',
	// 	type: 'I',
	// 	format: 'LB rd, offset(rs1)',
	// 	description: 'Loads a byte from memory at address rs1 + offset into rd.',
	// 	operands: [
	// 		{ name: 'rd', desc: 'Destination register' },
	// 		{ name: 'offset', desc: 'Byte offset' },
	// 		{ name: 'rs1', desc: 'Base address register' }
	// 	],
	// 	example: 'LB $1, 0($2)  # $1 = Memory[$2 + 0]'
	// },
	// LH: {
	// 	name: 'LH',
	// 	type: 'I',
	// 	format: 'LH rd, offset(rs1)',
	// 	description: 'Loads a half-word from memory at address rs1 + offset into rd.',
	// 	operands: [
	// 		{ name: 'rd', desc: 'Destination register' },
	// 		{ name: 'offset', desc: 'Byte offset' },
	// 		{ name: 'rs1', desc: 'Base address register' }
	// 	],
	// 	example: 'LH $1, 2($2)  # $1 = Memory[$2 + 2]'
	// },
	SW: {
		name: 'SW',
		type: 'S',
		format: 'SW rs2, offset(rs1)',
		description: 'Stores word from register rs2 into memory at address (rs1 + offset).',
		operation: 'Mem[R[rs1] + offset] ← R[rs2]',
		operands: [
			{ name: 'rs2', desc: 'Source register (value to store)' },
			{ name: 'offset', desc: 'Byte offset' },
			{ name: 'rs1', desc: 'Base address register' }
		],
		example: 'SW $1, 8($2)  # Memory[$2 + 8] = $1'
	},
	// SB: {
	// 	name: 'SB',
	// 	type: 'S',
	// 	format: 'SB rs2, offset(rs1)',
	// 	description: 'Stores byte from register rs2 into memory at address rs1 + offset.',
	// 	operands: [
	// 		{ name: 'rs2', desc: 'Source register (value to store)' },
	// 		{ name: 'offset', desc: 'Byte offset' },
	// 		{ name: 'rs1', desc: 'Base address register' }
	// 	],
	// 	example: 'SB $1, 0($2)  # Memory[$2 + 0] = $1'
	// },
	// SH: {
	// 	name: 'SH',
	// 	type: 'S',
	// 	format: 'SH rs2, offset(rs1)',
	// 	description: 'Stores half-word from register rs2 into memory at address rs1 + offset.',
	// 	operands: [
	// 		{ name: 'rs2', desc: 'Source register (value to store)' },
	// 		{ name: 'offset', desc: 'Byte offset' },
	// 		{ name: 'rs1', desc: 'Base address register' }
	// 	],
	// 	example: 'SH $1, 2($2)  # Memory[$2 + 2] = $1'
	// },
	BEQ: {
		name: 'BEQ',
		type: 'B',
		format: 'BEQ rs1, rs2, label',
		description: 'Branch if Equal. Jumps to label if rs1 == rs2.',
		operation: 'if (R[rs1] == R[rs2]) PC ← label',
		operands: [
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' },
			{ name: 'label', desc: 'Target label' }
		],
		example: 'BEQ $1, $2, LOOP'
	},
	BNE: {
		name: 'BNE',
		type: 'B',
		format: 'BNE rs1, rs2, label',
		description: 'Branch if Not Equal. Jumps to label if rs1 != rs2.',
		operation: 'if (R[rs1] != R[rs2]) PC ← label',
		operands: [
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' },
			{ name: 'label', desc: 'Target label' }
		],
		example: 'BNE $1, $2, EXIT'
	},
	BLT: {
		name: 'BLT',
		type: 'B',
		format: 'BLT rs1, rs2, label',
		description: 'Branch if Less Than. Jumps to label if rs1 < rs2.',
		operation: 'if (R[rs1] < R[rs2]) PC ← label',
		operands: [
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' },
			{ name: 'label', desc: 'Target label' }
		],
		example: 'BLT $3, $4, LOOP'
	},
	BGE: {
		name: 'BGE',
		type: 'B',
		format: 'BGE rs1, rs2, label',
		description: 'Branch if Greater or Equal. Jumps to label if rs1 >= rs2.',
		operation: 'if (R[rs1] >= R[rs2]) PC ← label',
		operands: [
			{ name: 'rs1', desc: 'Source register 1' },
			{ name: 'rs2', desc: 'Source register 2' },
			{ name: 'label', desc: 'Target label' }
		],
		example: 'BGE $3, $4, END'
	},
	NOP: {
		name: 'NOP',
		type: 'Special',
		format: 'NOP',
		description: 'No OPeration. Does nothing.',
		operands: [],
		example: 'NOP'
	}
};

export function getAllOps(): string[] {
	return Object.keys(instructionDocs).sort();
}
