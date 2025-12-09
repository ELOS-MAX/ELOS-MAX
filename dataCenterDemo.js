// dataCenterDemo.js
// High-performance, realistic data center load demo

const os = require('os');
const { performance } = require('perf_hooks');

// Configurable parameters
const NUM_NODES = 8;                   // number of nodes
const INITIAL_LOAD = 66_000_000;       // ops/worker starting load
const LOAD_INCREMENT = 2_000_000;      // increase per pulse
const PULSE_INTERVAL_MS = 300;         // pulse period
const MAX_PULSES = 20;                 // demo duration

// Thresholds
const HOT_THRESHOLD_MS = 250;          // latency above which node is HOT

// Node state
class Node {
    constructor(name) {
        this.name = name;
        this.opsPerSec = 0;
        this.latencyMs = 0;
        this.status = 'OK';
    }

    // Simulate operations for this pulse
    execute(load) {
        // Simulate processing: ops/sec varies randomly around load
        const fluctuation = 0.85 + Math.random() * 0.3; // 0.85–1.15
        this.opsPerSec = Math.floor(load * fluctuation);

        // Latency inversely proportional to ops/sec, plus jitter
        const baseLatency = 200; // base ms
        this.latencyMs = +(baseLatency * (load / this.opsPerSec) * (0.9 + Math.random() * 0.2)).toFixed(2);

        // Determine HOT / OK
        this.status = this.latencyMs > HOT_THRESHOLD_MS ? 'HOT' : 'OK';
    }

    summary() {
        return `${this.name.padEnd(6)}  ${this.opsPerSec.toLocaleString().padStart(10)} ops/s  ${this.latencyMs.toFixed(2).padStart(7)} ms  ${this.status}`;
    }
}

// Initialize nodes
const nodes = [];
for (let i = 0; i < NUM_NODES; i++) {
    nodes.push(new Node(`node-${i + 1}`));
}

// Run pulses
let globalLoad = INITIAL_LOAD;

function runPulse(pulseNumber) {
    console.log(`\nPulse ${pulseNumber}`);
    console.log(`Global Load: ${ (globalLoad / 1e6).toFixed(2) }M ops/worker`);

    nodes.forEach(node => node.execute(globalLoad));

    nodes.forEach(node => console.log(node.summary()));

    globalLoad += LOAD_INCREMENT;
}

// Demo loop
(async function demo() {
    for (let pulse = 18; pulse < 18 + MAX_PULSES; pulse++) {
        const start = performance.now();
        runPulse(pulse);
        const elapsed = performance.now() - start;

        // Maintain pulse interval
        const waitTime = Math.max(PULSE_INTERVAL_MS - elapsed, 0);
        await new Promise(res => setTimeout(res, waitTime));
    }
})();
