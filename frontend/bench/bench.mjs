import fs from "fs-extra";
import path from "path";
import puppeteer from "puppeteer";

const URL = process.env.URL ?? "http://localhost:3000/feedback/1";
const LABEL = process.env.LABEL ?? "baseline";   // ex) "before", "after"
const RUNS = Number(process.env.RUNS ?? 5);

const TRACES_DIR = path.resolve("bench/traces");
await fs.ensureDir(TRACES_DIR);

for (let i = 1; i <= RUNS; i++) {
  const browser = await puppeteer.launch({
    headless: "new",
    // 실험 일관성을 위해 동일한 환경으로 띄우기
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-features=BackForwardCache,PaintHolding",
    ],
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
  });

  const [page] = await browser.pages();

  // 캐시/서비스워커/프리렌더 영향 제거
  await page.setCacheEnabled(false);
  await page._client().send("ServiceWorker.disable");

  // 네트워크/CPU 조건 고정 (원하면 값 바꿔서 실험)
  // CPU 4배 스로틀링: 브라우저마다 약간 다를 수 있음
  await page._client().send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // 네트워크 슬로틀링(예: Fast 3G)
  // await page._client().send("Network.emulateNetworkConditions", {
  //   offline: false, latency: 150, downloadThroughput: 1.6e6, uploadThroughput: 750e3,
  // });

  const tracePath = path.join(TRACES_DIR, `trace-${LABEL}-${i}.json`);

  await page.tracing.start({
    path: tracePath,
    categories: [
      "devtools.timeline",
      "v8.execute",
      "toplevel",
      "disabled-by-default-v8.cpu_profiler", // 선택
    ],
  });

  // 페이지 진입
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 120000 });

  // PDF 같은 비동기 렌더가 있다면 약간 대기(혹은 특정 셀렉터/이벤트까지 기다리기)
  await new Promise(r => setTimeout(r, 3000));

  await page.tracing.stop();
  await browser.close();

  console.log(`[OK] ${LABEL} run #${i} → ${tracePath}`);
}