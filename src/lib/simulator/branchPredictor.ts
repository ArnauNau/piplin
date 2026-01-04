import type { BranchPredictorType, BranchPrediction } from '../types';

// 2-bit saturating counter states
type TwoBitState = 'strongly-not-taken' | 'weakly-not-taken' | 'weakly-taken' | 'strongly-taken';

// Branch predictor interface
export interface BranchPredictor {
	predict(pc: number): boolean;
	update(pc: number, taken: boolean): void;
	getState(): Map<number, unknown>;
}

// No branch prediction - always predict not taken
export class NoPrediction implements BranchPredictor {
	predict(_pc: number): boolean {
		return false;
	}

	update(_pc: number, _taken: boolean): void {
		// No state to update
	}

	getState(): Map<number, unknown> {
		return new Map();
	}
}

// 1-bit branch predictor
// Remembers last outcome for each branch
export class OneBitPredictor implements BranchPredictor {
	private state: Map<number, boolean>;
	private defaultPrediction: boolean;

	constructor(defaultPrediction: boolean = false) {
		this.state = new Map();
		this.defaultPrediction = defaultPrediction;
	}

	predict(pc: number): boolean {
		return this.state.get(pc) ?? this.defaultPrediction;
	}

	update(pc: number, taken: boolean): void {
		this.state.set(pc, taken);
	}

	getState(): Map<number, boolean> {
		return new Map(this.state);
	}
}

// 2-bit saturating counter branch predictor
export class TwoBitPredictor implements BranchPredictor {
	private state: Map<number, TwoBitState>;
	private defaultState: TwoBitState;

	constructor(defaultPrediction: 'taken' | 'not-taken' = 'not-taken') {
		this.state = new Map();
		this.defaultState = defaultPrediction === 'taken' ? 'weakly-taken' : 'weakly-not-taken';
	}

	predict(pc: number): boolean {
		const state = this.state.get(pc) ?? this.defaultState;
		return state === 'weakly-taken' || state === 'strongly-taken';
	}

	update(pc: number, taken: boolean): void {
		const currentState = this.state.get(pc) ?? this.defaultState;
		const newState = this.nextState(currentState, taken);
		this.state.set(pc, newState);
	}

	private nextState(current: TwoBitState, taken: boolean): TwoBitState {
		if (taken) {
			switch (current) {
				case 'strongly-not-taken':
					return 'weakly-not-taken';
				case 'weakly-not-taken':
					return 'weakly-taken';
				case 'weakly-taken':
					return 'strongly-taken';
				case 'strongly-taken':
					return 'strongly-taken';
			}
		} else {
			switch (current) {
				case 'strongly-not-taken':
					return 'strongly-not-taken';
				case 'weakly-not-taken':
					return 'strongly-not-taken';
				case 'weakly-taken':
					return 'weakly-not-taken';
				case 'strongly-taken':
					return 'weakly-taken';
			}
		}
	}

	getState(): Map<number, TwoBitState> {
		return new Map(this.state);
	}
}

// Create a branch predictor based on type
export function createBranchPredictor(
	type: BranchPredictorType,
	initialPrediction: 'taken' | 'not-taken' = 'not-taken'
): BranchPredictor {
	switch (type) {
		case 'none':
			return new NoPrediction();
		case '1bit':
			return new OneBitPredictor(initialPrediction === 'taken');
		case '2bit':
			return new TwoBitPredictor(initialPrediction);
	}
}

// Record a branch prediction result
export function recordPrediction(
	execId: number,
	predicted: boolean,
	actual: boolean,
	currentCycle: number,
	branchResolutionCycle: number
): BranchPrediction {
	const correct = predicted === actual;
	const flushCycles = correct ? 0 : branchResolutionCycle - currentCycle;

	return {
		executionId: execId,
		predicted,
		actual,
		correct,
		flushCycles
	};
}
