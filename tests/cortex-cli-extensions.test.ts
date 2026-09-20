import test from "node:test";
import assert from "node:assert/strict";
import { formatTaskLine, renderBoardDetail } from "../extensions/cortex-todo.ts";
import {
  renderCompactBanner,
  CORTEX_BRAIN_RAW,
  CORTEX_TEXT_LOGO,
  BANNER_COLORS,
  BANNER_PALETTES,
  DEFAULT_BANNER_CONFIG,
  normalizeBannerConfig,
} from "../extensions/cortex-banner.ts";
import { renderCompactWidget } from "../extensions/cortex-shell.ts";
import { renderStatusSummary } from "../extensions/cortex-commands.ts";
import { visibleWidth } from "@earendil-works/pi-tui";
import {
  createCortexStatusSnapshotStore,
  selectCortexStatusBoard,
  type CortexBoardSummary,
  type CortexWorkItem,
  type CortexStatusSnapshot,
} from "../lib/cortex-cli.ts";

test("Task DAG line formatting for various states", () => {
  const statuses: Array<CortexWorkItem["status"]> = ["ready", "in_progress", "in_review", "done", "blocked", "backlog"];

  for (const st of statuses) {
    const item: CortexWorkItem = {
      id: `task-${st}`,
      title: `Sample ${st} task`,
      status: st,
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const line = formatTaskLine(item);
    assert.ok(line.includes(item.id), "Formatted line should contain task ID");
    assert.ok(line.includes(item.title), "Formatted line should contain task title");
    assert.ok(line.includes(st), "Formatted line should contain task status");
  }
});

const board = (id: string, status: CortexBoardSummary["status"] = "active", updated_at = "2026-01-01T00:00:00.000Z"): CortexBoardSummary => ({
  board_id: id,
  title: `Board ${id}`,
  description: "",
  status,
  revision: 1,
  counts: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at,
});

const item = (id: string, status: CortexWorkItem["status"]): CortexWorkItem => ({
  id,
  title: `Item ${id}`,
  status,
  revision: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

test("Cortex status snapshot shares in-flight CLI reads for concurrent consumers", async () => {
  let listCalls = 0;
  let statusCalls = 0;
  const boards = [board("active")];
  const store = createCortexStatusSnapshotStore({
    cwd: "workspace-a",
    client: {
      async boardList(cwd?: string) {
        listCalls += 1;
        assert.equal(cwd, "workspace-a");
        await new Promise((resolve) => setTimeout(resolve, 10));
        return boards;
      },
      async boardStatus(id: string) {
        statusCalls += 1;
        assert.equal(id, "active");
        return { board: { ...boards[0], counts: { ready: 1, blocked: 1 } }, items: [item("one", "ready"), item("two", "blocked")] };
      },
    },
  });

  const [a, b, c] = await Promise.all([store.getSnapshot(), store.getSnapshot(), store.getSnapshot()]);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(a.state, "available");
  assert.deepEqual(a.counts, { ready: 1, blocked: 1 });
  assert.equal(listCalls, 1);
  assert.equal(statusCalls, 1);

  await store.getSnapshot();
  assert.equal(listCalls, 1, "resolved snapshot is cached inside the session-scoped store");
});

test("Cortex status snapshot board selection is stable and can respect an explicit board", async () => {
  const older = board("alpha", "active", "2026-01-01T00:00:00.000Z");
  const archivedNewer = board("archived", "archived", "2026-09-01T00:00:00.000Z");
  const newer = board("zeta", "active", "2026-02-01T00:00:00.000Z");
  assert.equal(selectCortexStatusBoard([older, archivedNewer, newer])?.board_id, "zeta");
  assert.equal(selectCortexStatusBoard([older, newer], "alpha")?.board_id, "alpha");

  const statusIds: string[] = [];
  const store = createCortexStatusSnapshotStore({
    cwd: "workspace-b",
    boardId: "alpha",
    client: {
      async boardList() { return [newer, older, archivedNewer]; },
      async boardStatus(id: string) {
        statusIds.push(id);
        return { board: older, items: [item("alpha-task", "in_progress")] };
      },
    },
  });

  const snapshot = await store.getSnapshot();
  assert.equal(snapshot.selectedBoardId, "alpha");
  assert.deepEqual(snapshot.counts, { in_progress: 1 });
  assert.deepEqual(statusIds, ["alpha"]);
});

test("Cortex status snapshot reports missing or malformed CLI data as unavailable", async () => {
  const failing = createCortexStatusSnapshotStore({
    client: {
      async boardList() { throw new Error("cortex-ia not found"); },
      async boardStatus() { throw new Error("should not be called"); },
    },
  });
  const missing = await failing.getSnapshot();
  assert.equal(missing.state, "unavailable");
  assert.match(missing.unavailableReason ?? "", /not found/);

  const malformed = createCortexStatusSnapshotStore({
    client: {
      async boardList() { return [{ board_id: "bad", status: "active" }]; },
      async boardStatus() { return { board: board("bad"), items: [] }; },
    },
  });
  const bad = await malformed.getSnapshot();
  assert.equal(bad.state, "unavailable");
  assert.match(bad.unavailableReason ?? "", /Malformed/);
});

test("Cortex status snapshot invalidation and dispose prevent stale resurrection", async () => {
  let releaseFirst!: (value: unknown) => void;
  let listCalls = 0;
  const store = createCortexStatusSnapshotStore({
    client: {
      async boardList() {
        listCalls += 1;
        if (listCalls === 1) return new Promise((resolve) => { releaseFirst = resolve; });
        return [board("fresh")];
      },
      async boardStatus(id: string) {
        return { board: board(id), items: [item(`${id}-ready`, "ready")] };
      },
    },
  });

  const stale = store.getSnapshot();
  store.invalidate();
  const fresh = await store.getSnapshot();
  assert.equal(fresh.selectedBoardId, "fresh");
  releaseFirst([board("stale")]);
  await stale;
  const cached = await store.getSnapshot();
  assert.equal(cached.selectedBoardId, "fresh", "late stale result must not overwrite invalidated cache");
  assert.equal(listCalls, 2);

  store.dispose();
  const disposed = await store.getSnapshot();
  assert.equal(disposed.state, "unavailable");
  assert.match(disposed.unavailableReason ?? "", /disposed/);
  assert.equal(listCalls, 2, "disposed store does not resurrect or refetch cache");
});

test("Cortex status snapshot includes and aggregates valid ledger facts, progress, and drift", async () => {
  let ledgerCalls = 0;
  const store = createCortexStatusSnapshotStore({
    client: {
      async boardList() { return [board("ledger-board")]; },
      async boardStatus(id: string) {
        return { board: board(id), items: [item("t1", "done"), item("t2", "ready")] };
      },
      async ledgerStatus(opts) {
        ledgerCalls += 1;
        assert.equal(opts.board, "ledger-board");
        return {
          board_id: "ledger-board",
          facts: [
            { id: 1, board_id: "ledger-board", fact: "Architectural seam verified", source: "orchestrator", synced_cortex: true, created_at: "2026-01-01T00:00:00.000Z" },
            { id: 2, board_id: "ledger-board", text: "Dual ledger check complete", source: "reviewer" },
          ],
          progress: [
            { summary: "Built adapters", drift: false, action: "build" },
            { summary: "Found drift in tests", drift: true },
          ],
        };
      },
    },
  });

  const snapshot = await store.getSnapshot();
  assert.equal(snapshot.state, "available");
  assert.equal(snapshot.ledger?.state, "available");
  assert.equal(snapshot.ledger?.counts.facts, 2);
  assert.equal(snapshot.ledger?.counts.progress, 2);
  assert.equal(snapshot.ledger?.counts.drift, 1);
  assert.equal(ledgerCalls, 1);
});

test("Cortex status snapshot isolates ledger failure and strictly rejects malformed schemas and dates", async () => {
  const ledgerFailStore = createCortexStatusSnapshotStore({
    client: {
      async boardList() { return [board("b-ok")]; },
      async boardStatus(id: string) { return { board: board(id), items: [] }; },
      async ledgerStatus() { throw new Error("ledger offline"); },
    },
  });
  const snap1 = await ledgerFailStore.getSnapshot();
  assert.equal(snap1.state, "available", "board remains available when ledger fails");
  assert.equal(snap1.ledger?.state, "unavailable");
  assert.match(snap1.ledger?.unavailableReason ?? "", /ledger offline/);

  const numDateStore = createCortexStatusSnapshotStore({
    client: {
      async boardList() { return [{ ...board("b-bad"), created_at: 0 as any }]; },
      async boardStatus(id: string) { return { board: board(id), items: [] }; },
    },
  });
  const snap2 = await numDateStore.getSnapshot();
  assert.equal(snap2.state, "unavailable", "numeric timestamp in board must fail validation");

  const unparseableDateStore = createCortexStatusSnapshotStore({
    client: {
      async boardList() { return [board("b-bad-date")]; },
      async boardStatus(id: string) {
        return { board: board(id), items: [{ ...item("t1", "ready"), created_at: "not-a-date" }] };
      },
    },
  });
  const snap3 = await unparseableDateStore.getSnapshot();
  assert.equal(snap3.state, "unavailable", "unparseable date string in item must fail validation");
});

test("Cortex status snapshot shares single aggregate in-flight read across concurrent consumers including ledger", async () => {
  let listCalls = 0;
  let statusCalls = 0;
  let ledgerCalls = 0;
  const store = createCortexStatusSnapshotStore({
    client: {
      async boardList() {
        listCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [board("conc")];
      },
      async boardStatus(id: string) {
        statusCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { board: board(id), items: [item("c1", "in_progress")] };
      },
      async ledgerStatus() {
        ledgerCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { board_id: "conc", facts: [], progress: [] };
      },
    },
  });

  const [s1, s2, s3] = await Promise.all([store.getSnapshot(), store.getSnapshot(), store.getSnapshot()]);
  assert.equal(s1, s2);
  assert.equal(s2, s3);
  assert.equal(listCalls, 1);
  assert.equal(statusCalls, 1);
  assert.equal(ledgerCalls, 1);
  assert.equal(s1.ledger?.state, "available");
});

test("Pure renderers produce width-bounded output with zero Cortex I/O", () => {
  const snapshot: CortexStatusSnapshot = {
    state: "available",
    cwd: "test-cwd",
    selectedBoardId: "test-board",
    selectedBoard: board("test-board"),
    boards: [board("test-board")],
    items: [item("task-1", "done"), item("task-2", "in_progress")],
    counts: { done: 1, in_progress: 1 },
    ledger: {
      state: "available",
      board_id: "test-board",
      facts: [],
      progress: [],
      counts: { facts: 3, progress: 2, drift: 1 },
    },
  };

  const maxWidth = 60;
  const banner = renderCompactBanner(snapshot, { maxWidth });
  const widget = renderCompactWidget(snapshot, { maxWidth });
  const boardView = renderBoardDetail(snapshot, { maxWidth });
  const statusView = renderStatusSummary(snapshot, { maxWidth });

  for (const line of banner.split("\n")) {
    assert.ok(visibleWidth(line) <= maxWidth, `Banner line exceeds maxWidth: ${visibleWidth(line)} > ${maxWidth}`);
  }
  assert.ok(visibleWidth(widget) <= maxWidth, `Widget line exceeds maxWidth: ${visibleWidth(widget)} > ${maxWidth}`);
  for (const line of boardView.split("\n")) {
    assert.ok(visibleWidth(line) <= maxWidth, `Board view line exceeds maxWidth: ${visibleWidth(line)} > ${maxWidth}`);
  }
  for (const line of statusView.split("\n")) {
    assert.ok(visibleWidth(line) <= maxWidth, `Status view line exceeds maxWidth: ${visibleWidth(line)} > ${maxWidth}`);
  }
});

test("Pure renderers gracefully degrade to error rows when snapshot is unavailable without throwing", () => {
  const badSnapshot: CortexStatusSnapshot = {
    state: "unavailable",
    cwd: "test-cwd",
    boards: [],
    items: [],
    counts: {},
    unavailableReason: "Daemon unreachable",
  };

  const maxWidth = 50;
  assert.doesNotThrow(() => {
    const banner = renderCompactBanner(badSnapshot, { maxWidth });
    assert.match(banner, /Unavailable/);

    const widget = renderCompactWidget(badSnapshot, { maxWidth });
    assert.match(widget, /unavailable/);

    const boardView = renderBoardDetail(badSnapshot, { maxWidth });
    assert.match(boardView, /Unavailable/);

    const statusView = renderStatusSummary(badSnapshot, { maxWidth });
    assert.match(statusView, /Unavailable/);
  });
});

test("Pure banner and widget use theme tokens when provided", () => {
  const snapshot: CortexStatusSnapshot = {
    state: "available",
    cwd: "test-cwd",
    selectedBoardId: "b-themed",
    selectedBoard: board("b-themed"),
    boards: [board("b-themed")],
    items: [],
    counts: {},
  };

  const theme = {
    fg(token: string, text: string) {
      return `[${token}]${text}[/${token}]`;
    },
  };

  const banner = renderCompactBanner(snapshot, { theme, maxWidth: 100 });
  assert.match(banner, /\[accent\]/);
  assert.match(banner, /\[warning\]/);
});

test("Banner config normalizer handles invalid and partial inputs safely", () => {
  const def = normalizeBannerConfig(null);
  assert.deepEqual(def, DEFAULT_BANNER_CONFIG);

  const custom = normalizeBannerConfig({
    showBrain: false,
    showTextLogo: true,
    color: "magenta",
    animated: false,
  });
  assert.equal(custom.showBrain, false);
  assert.equal(custom.showTextLogo, true);
  assert.equal(custom.color, "magenta");
  assert.equal(custom.animated, false);

  const invalidColor = normalizeBannerConfig({ color: "neon-pink" });
  assert.equal(invalidColor.color, DEFAULT_BANNER_CONFIG.color);
});

test("Cortex ASCII & Braille art assets are well-formed", () => {
  assert.ok(CORTEX_BRAIN_RAW.length > 5, "Brain illustration should have multiple lines");
  assert.ok(CORTEX_TEXT_LOGO.length > 5, "Text logo should have multiple lines");

  for (const line of CORTEX_BRAIN_RAW) {
    assert.equal(typeof line, "string");
  }
  for (const line of CORTEX_TEXT_LOGO) {
    assert.equal(typeof line, "string");
  }
});

test("Banner palettes contain all expected color schemes with valid RGB tuples", () => {
  assert.deepEqual(BANNER_COLORS, ["cyan", "magenta", "amber", "green", "indigo"]);

  for (const color of BANNER_COLORS) {
    const palette = BANNER_PALETTES[color];
    assert.ok(palette, `Palette for ${color} should be defined`);
    assert.equal(palette.brain.length, 3);
    assert.equal(palette.label.length, 3);
    assert.equal(palette.value.length, 3);
    assert.equal(palette.logoFresh.length, 3);
    assert.equal(palette.logoDim.length, 3);

    for (const channel of [
      ...palette.brain,
      ...palette.label,
      ...palette.value,
      ...palette.logoFresh,
      ...palette.logoDim,
    ]) {
      assert.ok(channel >= 0 && channel <= 255, `RGB channel ${channel} should be in [0, 255]`);
    }
  }
});



