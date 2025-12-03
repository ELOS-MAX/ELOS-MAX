#!/usr/bin/env node
// elos-deep.js
// Explore deep ephemeral layer nesting and live-monitoring
// Usage: node elos-deep.js [depth] [branch] [pulseMs] [maxTasksPerPulse]
// Example: node monitor.js 5 3 250 100000

const depth = Number(process.argv[2] || 4);           // nested layers (>=1)
const branch = Number(process.argv[3] || 4);          // branching factor per layer (>=1)
const pulseMs = Number(process.argv[4] || 250);       // ms between global pulses
const maxTasksPerPulse = Number(process.argv[5] || 200000); // safety cap

if (depth < 1 || branch < 1) {
  console.error('depth and branch must be >= 1');
  process.exit(1);
}

const TARGET = "000000000000000000000";
let totalChecked = 0;
let found = null;
let pulses = 0;
let lastPulseTasks = 0;

const charSet = "0123456789abcdef";
function randomEthAddressFast() {
  // faster address generator using random bytes
  const buf = Buffer.allocUnsafe(20);
  for (let i = 0; i < 20; i++) buf[i] = Math.floor(Math.random() * 256);
  let s = buf.toString('hex');
  return "0x" + s;
}

// Nano operation (Layer deepest level): single test
function nanoOp() {
  const addr = randomEthAddressFast();
  totalChecked++;
  if (addr.includes(TARGET)) return addr;
  return null;
}

// The layered spawn function: executes a subtree of depth `remaining`
// Each node spawns `branch` children (unless remaining==1 -> run nanos)
function runLayer(remaining, tasksCounter) {
  // safety: if tasksCounter >= maxTasksPerPulse stop spawning
  if (tasksCounter.count >= maxTasksPerPulse) return null;

  if (remaining === 1) {
    // deepest: run `branch` nanoOps (treat branch as per-node nanos)
    for (let i = 0; i < branch; i++) {
      if (tasksCounter.count >= maxTasksPerPulse) break;
      tasksCounter.count++;
      const r = nanoOp();
      if (r) return r;
    }
    return null;
  } else {
    // spawn branch children that run layer(remaining-1)
    for (let b = 0; b < branch; b++) {
      if (tasksCounter.count >= maxTasksPerPulse) break;
      const r = runLayer(remaining - 1, tasksCounter);
      if (r) return r;
    }
    return null;
  }
}

// Pulse executor: spawn `waves` (treat waves as lightweight multiplier at top)
const waves = 1; // you can increase waves to simulate concurrent top-level bursts

let lastTotal = 0;
let lastTime = process.hrtime.bigint();
const rateWindow = [];
const RATE_WINDOW_SIZE = 6;

function globalPulse() {
  if (found) return;
  pulses++;
  const t0 = process.hrtime.bigint();
  const tasksCounter = { count: 0 };

  for (let w = 0; w < waves; w++) {
    const r = runLayer(depth, tasksCounter);
    if (r) {
      found = r;
      console.log('\n== MATCH FOUND ==\n', r);
      process.exit(0);
    }
    if (tasksCounter.count >= maxTasksPerPulse) break;
  }

  lastPulseTasks = tasksCounter.count;
  const t1 = process.hrtime.bigint();
  const durMs = Number(t1 - t0) / 1e6;

  // compute ops/sec estimate in this pulse and moving average
  const ops = totalChecked - lastTotal;
  lastTotal = totalChecked;
  const now = Date.now();
  const opsPerSec = ops / (durMs / 1000 || 1);
  rateWindow.push(opsPerSec);
  if (rateWindow.length > RATE_WINDOW_SIZE) rateWindow.shift();
  const avgRate = Math.round((rateWindow.reduce((a,b)=>a+b,0)/rateWindow.length) || 0);

  // telemetry
  const mem = process.memoryUsage();
  process.stdout.write(
    `Pulse:${pulses} | Depth:${depth} Branch:${branch} | Checked:${totalChecked.toLocaleString()} | ` +
    `TasksThisPulse:${lastPulseTasks} | PulseMs:${durMs.toFixed(1)} | Rate:${avgRate}/s | ` +
    `RSS:${Math.round(mem.rss/1024/1024)}MB Heap:${Math.round(mem.heapUsed/1024/1024)}MB    \r`
  );

  // safety: if no tasks produced this pulse (branch small), still continue
}

// Start timer
console.log(`elos-deep starting — depth=${depth} branch=${branch} pulseMs=${pulseMs} maxTasksPerPulse=${maxTasksPerPulse}`);
console.log('Press Ctrl-C to stop.\n');

const interval = setInterval(globalPulse, pulseMs);

// periodic summary
setInterval(()=>{
  const mem = process.memoryUsage();
  console.log('\n--- SUMMARY ---');
  console.log(`Pulses: ${pulses} | TotalChecked: ${totalChecked.toLocaleString()} | LastPulseTasks: ${lastPulseTasks}`);
  console.log(`HeapUsed: ${Math.round(mem.heapUsed/1024/1024)} MB | RSS: ${Math.round(mem.rss/1024/1024)} MB`);
  console.log('---------------\n');
}, 10000);

// graceful exit
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n\nInterrupted. Final stats:');
  console.log(`Pulses: ${pulses} | Total checked: ${totalChecked}`);
  process.exit(0);
});