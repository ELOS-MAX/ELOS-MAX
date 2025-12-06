#!/usr/bin/env node
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
#!/usr/bin/env node
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Configurable parameters
const depth = Number(process.argv[2] || 4); // Simulated depth for ops calculation (>=1)
const branch = Number(process.argv[3] || 4); // Simulated branching for ops (>=1)
const pulseMs = Number(process.argv[4] || 250); // ms between pulses
const maxTasksPerPulse = Number(process.argv[5] || 200000); // Safety cap per pulse
const waves = Number(process.argv[6] || 4); // Top-level bursts (increased default)
const numThreads = Number(process.argv[7] || os.cpus().length); // Default to CPU cores

if (depth < 1 || branch < 1 || waves < 1 || numThreads < 1) {
  console.error('Parameters must be >= 1');
  process.exit(1);
}

const TARGET = "000000";
let totalChecked = 0;
let found = null;
let pulses = 0;
let lastPulseTasks = 0;
const charSet = "0123456789abcdef";

// Faster random address generator
function randomEthAddressFast() {
  const buf = Buffer.allocUnsafe(20);
  for (let i = 0; i < 20; i++) buf[i] = Math.floor(Math.random() * 256);
  return "0x" + buf.toString('hex');
}

// Worker thread logic for parallel execution
if (!isMainThread) {
  const { batchSize } = workerData;
  let result = null;
  let localChecked = 0;
  for (let i = 0; i < batchSize; i++) {
    const addr = randomEthAddressFast();
    localChecked++;
    if (addr.includes(TARGET)) {
      result = addr;
      break;
    }
  }
  parentPort.postMessage({ result, checked: localChecked });
  process.exit(0);
}

// Main thread: Execute pulse with multi-threading
async function executePulseTasks(tasks) {
  const batchSize = Math.ceil(tasks / numThreads);
  const workers = [];
  let completed = 0;
  let result = null;

  for (let i = 0; i < numThreads; i++) {
    const effectiveBatch = Math.min(batchSize, tasks - completed);
    if (effectiveBatch <= 0) break;

    workers.push(new Promise((resolve) => {
      const worker = new Worker(__filename, { workerData: { batchSize: effectiveBatch } });
      worker.on('message', (msg) => {
        if (msg.result) result = msg.result;
        completed += msg.checked;
        totalChecked += msg.checked; // Aggregate totalChecked from workers
        resolve();
      });
      worker.on('error', (err) => {
        console.error('Worker error:', err);
        resolve();
      });
    }));
  }

  await Promise.all(workers);
  return result;
}

// Pulse function: Simulate tree ops iteratively with parallelism
let lastTotal = 0;
const rateWindow = [];
const RATE_WINDOW_SIZE = 6;
async function globalPulse() {
  if (found) return;
  pulses++;
  const t0 = process.hrtime.bigint();
  let tasksThisPulse = 0;
  let r = null;

  // Simulate full tree ops but cap per pulse
  const maxOpsPerWave = Math.pow(branch, depth); // Simulated full tree size
  for (let w = 0; w < waves; w++) {
    const remaining = maxTasksPerPulse - tasksThisPulse;
    if (remaining <= 0) break;
    const batch = Math.min(maxOpsPerWave, remaining);
    r = await executePulseTasks(batch);
    tasksThisPulse += batch;
    if (r) break;
  }

  lastPulseTasks = tasksThisPulse;
  if (r) {
    found = r;
    console.log('\n== MATCH FOUND ==\n', r);
    console.log('\n\nMatch found. Final stats:');
    console.log(`Pulses: ${pulses} | Total checked: ${totalChecked.toLocaleString()}`);
    process.exit(0);
  }

  const t1 = process.hrtime.bigint();
  const durMs = Number(t1 - t0) / 1e6;
  const ops = totalChecked - lastTotal;
  lastTotal = totalChecked;
  const opsPerSec = ops / (durMs / 1000 || 1);
  rateWindow.push(opsPerSec);
  if (rateWindow.length > RATE_WINDOW_SIZE) rateWindow.shift();
  const avgRate = Math.round(rateWindow.reduce((a, b) => a + b, 0) / rateWindow.length || 0);

  // Telemetry
  const mem = process.memoryUsage();
  process.stdout.write(
    `Pulse:${pulses} | SimDepth:${depth} Branch:${branch} Threads:${numThreads} | Checked:${totalChecked.toLocaleString()} | ` +
    `TasksThisPulse:${lastPulseTasks.toLocaleString()} | PulseMs:${durMs.toFixed(1)} | Rate:${avgRate.toLocaleString()}/s | ` +
    `RSS:${Math.round(mem.rss / 1024 / 1024)}MB Heap:${Math.round(mem.heapUsed / 1024 / 1024)}MB \r`
  );
}

// Start
console.log(`ELOS-MAX starting — sim_depth=${depth} branch=${branch} pulseMs=${pulseMs} maxTasksPerPulse=${maxTasksPerPulse} waves=${waves} threads=${numThreads}`);
console.log('Press Ctrl-C to stop.\n');
const interval = setInterval(globalPulse, pulseMs);

// Periodic summary
setInterval(() => {
  const mem = process.memoryUsage();
  console.log('\n--- SUMMARY ---');
  console.log(`Pulses: ${pulses} | TotalChecked: ${totalChecked.toLocaleString()} | LastPulseTasks: ${lastPulseTasks.toLocaleString()}`);
  console.log(`HeapUsed: ${Math.round(mem.heapUsed / 1024 / 1024)} MB | RSS: ${Math.round(mem.rss / 1024 / 1024)} MB`);
  console.log('---------------\n');
}, 10000);

// Graceful exit
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n\nInterrupted. Final stats:');
  console.log(`Pulses: ${pulses} | Total checked: ${totalChecked.toLocaleString()}`);
  process.exit(0);
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught error:', err);
  process.exit(1);
});
