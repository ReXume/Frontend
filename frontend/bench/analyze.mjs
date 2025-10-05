import fs from "fs-extra";
import path from "path";
import { globby } from "globby";

const TRACES_DIR = "bench/traces";

function loadTrace(file) {
  const raw = fs.readFileSync(file, "utf8");
  // trace는 {"traceEvents":[...]} 또는 배열 자체로 올 때가 있음
  const json = JSON.parse(raw);
  return Array.isArray(json) ? json : json.traceEvents || [];
}

function pickThreads(events) {
  const threadNames = new Map(); // key: tid, val: {pid, name}
  for (const e of events) {
    if (e.ph === "M" && e.name === "thread_name" && e.args?.name) {
      threadNames.set(e.tid, { pid: e.pid, name: e.args.name });
    }
  }
  const mainTid = [...threadNames.entries()].find(([, v]) =>
    v.name.includes("CrRendererMain")
  )?.[0];

  const workerTids = [...threadNames.entries()]
    .filter(([, v]) =>
      /Worker|DedicatedWorker/i.test(v.name)
    )
    .map(([tid]) => tid);

  return { threadNames, mainTid, workerTids };
}

function sumDurMs(events, tidFilter) {
  let totalUs = 0;
  for (const e of events) {
    if (!e.dur || !tidFilter(e)) continue;
    // devtools.timeline 이벤트만 집계(과도 집계 방지)
    if (e.cat && !String(e.cat).includes("devtools.timeline")) continue;
    totalUs += e.dur; // μs
  }
  return totalUs / 1000; // ms
}

function calcTBTms(events, mainTid) {
  let tbtUs = 0;
  for (const e of events) {
    if (!e.dur || e.tid !== mainTid) continue;
    // Long task 근사: Task/RunTask 명칭 + 50ms 초과 부분
    const isTask = /Task|RunTask/i.test(e.name || "");
    if (!isTask) continue;
    if (e.dur > 50000) tbtUs += (e.dur - 50000);
  }
  return tbtUs / 1000;
}

function analyzeFile(file) {
  const events = loadTrace(file);
  const { mainTid, workerTids } = pickThreads(events);
  if (!mainTid) throw new Error(`Main thread not found in ${file}`);

  const mainMs = sumDurMs(events, (e) => e.tid === mainTid);
  const workerMs = sumDurMs(events, (e) => workerTids.includes(e.tid));
  const tbtMs = calcTBTms(events, mainTid);

  // 트레이스 구간 길이(ms)
  const times = events.filter((e) => typeof e.ts === "number");

  let start = Infinity;
  let end = 0;
  for (const e of times) {
    if (e.ts < start) start = e.ts;
    const finish = e.ts + (e.dur ?? 0);
    if (finish > end) end = finish;
  }
  const delta = end - start;          // trace ts/dur 단위: 일반적으로 μs
  // ns(≥1e10)면 1e6으로, 그 외(μs)면 1e3으로 보정
  const rangeMs = delta >= 1e10 ? delta / 1e6 : delta / 1e3;

  // 가드: 비정상 값 방지
  if (!Number.isFinite(rangeMs) || rangeMs <= 0) {
    throw new Error(`Invalid trace time range for ${file}: start=${start}, end=${end}`);
  }

  // 메인 스레드 “부하율” (%)
  const mainBusyRatio = (mainMs / rangeMs) * 100;

  return { file, rangeMs, mainMs, workerMs, tbtMs, mainBusyRatio };
}

function avg(rows, key) {
  return rows.reduce((s, r) => s + r[key], 0) / rows.length;
}

const pattern = process.argv[2] ?? `${TRACES_DIR}/trace-*.json`;
const files = await globby(pattern);
if (!files.length) throw new Error(`No traces found for pattern ${pattern}`);

const rows = files.map(analyzeFile);

const grouped = rows.reduce((acc, r) => {
  const label = r.file.match(/trace-([a-zA-Z0-9_-]+)-\d+\.json$/)?.[1] ?? "unknown";
  (acc[label] ||= []).push(r);
  return acc;
}, {});

for (const [label, arr] of Object.entries(grouped)) {
  const out = {
    label,
    runs: arr.length,
    rangeMs_avg: avg(arr, "rangeMs").toFixed(1),
    mainMs_avg: avg(arr, "mainMs").toFixed(1),
    workerMs_avg: avg(arr, "workerMs").toFixed(1),
    tbtMs_avg: avg(arr, "tbtMs").toFixed(1),
    mainBusyRatio_avg: avg(arr, "mainBusyRatio").toFixed(1) + " %",
  };
  console.table([out]);
}
