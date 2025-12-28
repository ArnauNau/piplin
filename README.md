# Piplin

**A powerful, interactive pipeline visualizer for MIPS.**

Piplin is a web-based CPU simulation tool designed to help students and engineers visualize how instructions flow through a classic MIPS 5-stage pipeline. It provides deep insights into data hazards, forwarding logic, and branch prediction.

## Key Features

- **Dynamic Execution Trace**: Unlike static grids, Piplin shows a real-time trace of instruction execution, clearly demarcating stalls, bubbles (stalls), and multi-cycle operations.
- **Visual Hazard Detection**: Automatically identifies RAW (Read-After-Write) hazards and visualizes how the pipeline handles them.
- **Configurable Forwarding**: Toggle and visualize EX→EX and MEM→EX forwarding paths to see their impact on pipeline performance.
- **Branch Prediction**: Simulate 1-bit and 2-bit branch predictors and observe the cost of mispredictions and subsequent flushes.
- **Instruction Documentation**: Integrated reference for all supported instructions, accessible directly from the visualization.
- **Modern Aesthetic**: No need for software that looks like it was made in the 90s.

## Supported Instructions

Piplin supports a subset of the MIPS instruction set:

| Category            | Instructions                                   |
| :------------------ | :--------------------------------------------- |
| **ALU (Register)**  | `ADD`, `SUB`, `MUL`, `AND`, `OR`, `XOR`, `SLT` |
| **ALU (Immediate)** | `ADDI`, `ANDI`, `ORI`, `XORI`, `SLTI`          |
| **Memory**          | `LW`, `SW`                                     |
| **Branch**          | `BEQ`, `BNE`                                   |
| **Special**         | `NOP`                                          |

## Configuration

Tailor the simulation to your needs through the configuration sidebar:

- **Stage Latencies**: Configure how many cycles the ALU, Multiplier, and Memory access take.
- **Forwarding Paths**: Enable or disable specific forwarding bypasses.
- **Predictor Settings**: Choose between `None`, `1-bit`, and `2-bit` branch prediction, and set the initial state (Taken/Not Taken).

## Tech Stack

- **Language**: TypeScript
- **Framework**: Svelte
- **Tooling**: Vite, Prettier, ESLint.
- **Package Manager / Test Runner**: [Bun](https://bun.sh)

## Getting Started

### Development

Install dependencies:

```sh
bun install
# or
npm install
```

Start the development server:

```sh
bun run dev
# or
npm run dev
```

Format code (mandatory for contributions):

```sh
bunx prettier --write .
# or
npx prettier --write .
```

Run tests:

```sh
bun run test
# or
bun test
```

### Building for Production

The SvelteKit project is configured to be built into a static website, ready to be served by any static web server. (There are multiple high-quality free options available, such as Cloudflare Pages, GitHub Pages, Netlify, Vercel, etc)
Server-Side Rendering (SSR) can be enabled by changing the adapter settings in `svelte.config.ts`, which also has specific options for some hosting providers.

```sh
bun run build
# or
npm run build
```

## Future Plans

- **Interactive Debugger**: Step-by-step execution with real-time register and memory inspection.
- **Live Memory View**: A visual, interactive map of the simulated memory space.
- **Trace Export**: Support for exporting execution traces to JSON or CSV for further analysis.
- **Custom Architectures**: Tools for defining custom pipeline stages and specialized functional units.

---

Built by [Arnau Sanz](https://a.rnau.me)
