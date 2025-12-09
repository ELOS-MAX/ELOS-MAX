// dataCenterDemo.js
// High-performance, realistic data center load demo

// Author: James Chapman (iconoclastdao@gmail.com / 1jbchap@gmail.com / jameschapman@solavia)
//Date: 2025
//Dual License – Free for Individuals & Educational/Open-Source Use  
//Commercial/For-Profit Use Requires a Paid License

//This software is made available under the following dual-license terms:

//1. Free License (Individuals, Education, and Open-Source Projects)  
//   You are granted a perpetual, worldwide, non-exclusive, no-charge, royalty-free license to use, copy, modify, merge, publish, distribute, and sublicense the software PROVIDED THAT:
//   - You are an individual (natural person) using it for personal or non-commercial purposes, OR
//   - You are an educational institution or non-profit organization using it for teaching, learning, or research, OR
//   - You are distributing the software (with or without modifications) under an OSI-approved open-source license.
//
//   In these cases, the software is provided "AS IS" without warranty of any kind.

//2. Commercial/For-Profit License  
//   Any use of this software in a commercial product, by a for-profit entity, or in any revenue-generating activity (including internal business use that provides economic benefit) requires a paid commercial license.
//
 //  To obtain a commercial license or to discuss custom licensing terms, please contact:

 //  James Chapman  
 //  Email: iconoclastdao@gmail.com  
  //         1jbchap@gmail.com
//
// Unless you have obtained a separate written commercial license agreement from James Chapman, your use is limited to the free license described in section 1 above.
// ***

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
