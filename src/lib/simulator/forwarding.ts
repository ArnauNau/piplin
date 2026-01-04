import type { Instruction, ForwardingInfo, RegisterFile, ExecutionId } from '../types';
import { getSourceRegisters, getDestRegister } from './hazards';

//check if forwarding can resolve a hazard
//returns forwarding info if possible, null otherwise
export function checkForwarding(
	consumer: Instruction, // instruction needing value
	producer: Instruction, // instruction producing value
	producerExecutionId: ExecutionId,
	producerStage: 'E' | 'M', // stage where producer's result is available
	producerValue: number // the computed value
): ForwardingInfo | null {
	const destReg = getDestRegister(producer);
	if (!destReg) return null;

	const sources = getSourceRegisters(consumer);
	if (!sources.includes(destReg)) return null;

	return {
		fromExecution: producerExecutionId,
		fromStage: producerStage,
		toStage: 'E',
		register: destReg,
		value: producerValue
	};
}

//apply forwarding to get effective register values for an instruction
//returns a modified register file with forwarded values
export function applyForwarding(
	regs: RegisterFile,
	forwardingInfos: ForwardingInfo[]
): RegisterFile {
	const effectiveRegs = { ...regs };

	for (const fwd of forwardingInfos) {
		if (fwd.register !== '$0') {
			effectiveRegs[fwd.register] = fwd.value;
		}
	}

	return effectiveRegs;
}

// EX→EX (EX/MEM to EX): Forward ALU result from previous instruction
// - available at end of EX stage
// - can be used by next instruction in its EX stage
// - resolves RAW hazard with 0 stall cycles for back-to-back ALU ops
//
// MEM→EX (MEM/WB to EX): Forward memory result or ALU result
// - available at end of MEM stage
// - can be used by instruction 2 cycles later in its EX stage
// - for loads: still requires 1 stall (load-use hazard)

export interface ForwardingPath {
	name: string;
	fromStage: 'E' | 'M';
	description: string;
}

export const FORWARDING_PATHS: ForwardingPath[] = [
	{
		name: 'EX→EX',
		fromStage: 'E',
		description: "Forward ALU result to next instruction's EX stage"
	},
	{
		name: 'MEM→EX',
		fromStage: 'M',
		description: 'Forward memory/ALU result to EX stage (2 cycles later)'
	}
];

export function getForwardingPathName(info: ForwardingInfo): string {
	if (info.fromStage === 'E') {
		return 'EX→EX';
	} else {
		return 'MEM→EX';
	}
}
