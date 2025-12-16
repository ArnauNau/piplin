import type { Instruction, HazardType } from '../types';

// Get source registers for an instruction
export function getSourceRegisters(instr: Instruction): string[] {
	const sources: string[] = [];
	if (instr.rs1 && instr.rs1 !== '$0') sources.push(instr.rs1);
	if (instr.rs2 && instr.rs2 !== '$0') sources.push(instr.rs2);
	return sources;
}

// Get destination register for an instruction
export function getDestRegister(instr: Instruction): string | null {
	// Store and branch instructions don't have a destination register that we track
	if (instr.type === 'store' || instr.type === 'branch' || instr.type === 'nop') {
		return null;
	}
	if (instr.rd && instr.rd !== '$0') {
		return instr.rd;
	}
	return null;
}

// Check for RAW (Read After Write) hazard between two instructions
// Returns the register causing the hazard, or null if no hazard
export function checkRawHazard(
	producer: Instruction, // earlier instruction that writes
	consumer: Instruction // later instruction that reads
): string | null {
	const destReg = getDestRegister(producer);
	if (!destReg) return null;

	const sourceRegs = getSourceRegisters(consumer);
	if (sourceRegs.includes(destReg)) {
		return destReg;
	}
	return null;
}

// Calculate how many cycles the consumer must stall due to RAW hazard
// This depends on:
// - When the producer's result is available
// - When the consumer needs the value
// - Whether forwarding is enabled
export function calculateStallCycles(
	producer: Instruction,
	consumer: Instruction,
	cyclesBetween: number, // cycles between when producer started E and consumer needs value
	producerExeCycles: number, // how many cycles producer spends in E
	forwardingEnabled: boolean
): number {
	// If producer is a load, result available after M stage (end of M)
	// If producer is ALU, result available after E stage (end of E)

	if (producer.type === 'load') {
		// Load result available at end of M stage
		// With forwarding: can forward from M to E (MEM→EX), but still 1 stall for load-use
		// Without forwarding: must wait until W to get value
		if (forwardingEnabled) {
			// Need at least 1 cycle between load and use (load-use hazard)
			const neededCycles = 1;
			return Math.max(0, neededCycles - cyclesBetween);
		} else {
			// Must wait until after W stage (3 cycles: E, M, W)
			const neededCycles = 3;
			return Math.max(0, neededCycles - cyclesBetween);
		}
	} else if (producer.type === 'alu') {
		// ALU result available at end of E stage
		if (forwardingEnabled) {
			// With forwarding: can forward from E to E (EX→EX)
			// Result available at end of producer's E stage
			// Consumer can use it in its E stage
			const neededCycles = producerExeCycles;
			return Math.max(0, neededCycles - cyclesBetween);
		} else {
			// Without forwarding: must wait until after W stage
			const neededCycles = producerExeCycles + 2; // E + M + W
			return Math.max(0, neededCycles - cyclesBetween);
		}
	}

	return 0;
}

// Information about a detected hazard with potential stall
export interface DetectedHazard {
	type: HazardType;
	register: string;
	producerIndex: number;
	stallCycles: number;
	canForward: boolean;
	forwardStage?: 'E' | 'M';
}

// Detect hazards for an instruction relative to in-flight instructions
export function detectHazards(
	currentInstr: Instruction,
	inflightInstrs: Array<{
		instr: Instruction;
		stage: string;
		cycleInStage: number;
		exeCycles: number;
	}>,
	forwardingEnabled: boolean,
	aluLatency: number,
	memLatency: number
): DetectedHazard[] {
	const hazards: DetectedHazard[] = [];
	const currentSources = getSourceRegisters(currentInstr);

	for (const inflight of inflightInstrs) {
		const destReg = getDestRegister(inflight.instr);
		if (!destReg || !currentSources.includes(destReg)) continue;

		// There's a potential RAW hazard
		// Determine if we need to stall and/or can forward

		const hazard: DetectedHazard = {
			type: 'raw',
			register: destReg,
			producerIndex: inflight.instr.index,
			stallCycles: 0,
			canForward: false
		};

		// Calculate stall based on producer's stage
		if (inflight.stage === 'E') {
			// Producer is executing
			const remainingExe = inflight.exeCycles - inflight.cycleInStage;
			if (forwardingEnabled && inflight.instr.type === 'alu') {
				// Can forward once E completes
				hazard.stallCycles = remainingExe;
				hazard.canForward = true;
				hazard.forwardStage = 'E';
			} else if (forwardingEnabled && inflight.instr.type === 'load') {
				// Must wait for M stage completion
				hazard.stallCycles = remainingExe + memLatency;
				hazard.canForward = true;
				hazard.forwardStage = 'M';
			} else {
				// No forwarding - wait until W completes
				hazard.stallCycles = remainingExe + memLatency + 1; // E + M + W
			}
		} else if (inflight.stage === 'M') {
			const remainingMem =
				(inflight.instr.type === 'load' ? memLatency : 1) - inflight.cycleInStage;
			if (forwardingEnabled) {
				hazard.stallCycles = remainingMem;
				hazard.canForward = true;
				hazard.forwardStage = 'M';
			} else {
				hazard.stallCycles = remainingMem + 1; // M + W
			}
		} else if (inflight.stage === 'W') {
			// Will complete this cycle, might still need 1 stall without forwarding
			if (!forwardingEnabled) {
				hazard.stallCycles = 1;
			}
		}

		if (hazard.stallCycles > 0 || !forwardingEnabled) {
			hazards.push(hazard);
		}
	}

	return hazards;
}
