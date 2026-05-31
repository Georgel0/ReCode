'use client';

export function runRuleValidation(streams, rules) {
  if (!streams || !streams.length || !rules?.trim()) return [];

  const results = [];
  const rulesText = rules.toLowerCase();

  // 1. Monotonic timestamps
  if (rulesText.includes('monoton') || rulesText.includes('increasing')) {
    streams.forEach(stream => {
      const tsKeys = ['timestamp', 'ts', 'event_time', 'created_at', 'occurred_at'];

      // Guard: empty stream has no events to validate
      if (stream.events.length === 0) {
        results.push({ rule: 'Monotonic timestamps', status: 'warn', message: `Stream "${stream.streamName}" has no events to validate`, stream: stream.streamName });
        return;
      }

      const tsKey = tsKeys.find(k => stream.events[0][k] !== undefined) || null;
      if (!tsKey) {
        results.push({ rule: 'Monotonic timestamps', status: 'warn', message: `No timestamp field found in "${stream.streamName}"`, stream: stream.streamName });
        return;
      }
      let isMonotonic = true;
      let badIdx = -1;

      for (let i = 1; i < stream.events.length; i++) {
        const a = new Date(stream.events[i - 1][tsKey]).getTime();
        const b = new Date(stream.events[i][tsKey]).getTime();

        if (isNaN(a) || isNaN(b)) { isMonotonic = null; break; }
        if (b < a) { isMonotonic = false; badIdx = i; break; }
      }
      if (isMonotonic === null) {
        results.push({ rule: 'Monotonic timestamps', status: 'warn', message: `Unparseable timestamps in "${stream.streamName}"`, stream: stream.streamName });
      } else if (isMonotonic === false) {
        results.push({ rule: 'Monotonic timestamps', status: 'fail', message: `Order violation at event #${badIdx + 1} in "${stream.streamName}"`, stream: stream.streamName });
      } else {
        results.push({ rule: 'Monotonic timestamps', status: 'pass', message: `All ${stream.events.length} timestamps increase correctly in "${stream.streamName}"`, stream: stream.streamName });
      }
    });
  }

  // 2. Error rate (e.g. "5% of events should be error")
  const errorRateMatch = rulesText.match(/(\d+)%.*?error/);
  if (errorRateMatch) {
    const targetPct = parseInt(errorRateMatch[1], 10);

    streams.forEach(stream => {
      const total = stream.events.length;

      const errCount = stream.events.filter(e => {
        const typeVal = String(e.event_type || e.type || e.name || '').toLowerCase();
        // Use != null (covers null and undefined) so a status_code of 0 is NOT treated as absent
        const statusVal = Number(
          e.status_code != null ? e.status_code :
          e.status      != null ? e.status      : 0
        );
        return typeVal.includes('error') || typeVal.includes('fail') || statusVal >= 400;
      }).length;

      const actualPct = Math.round((errCount / total) * 100);
      const tolerance = Math.max(3, targetPct * 0.5); // ±50% or min 3pp
      const ok = Math.abs(actualPct - targetPct) <= tolerance;

      results.push({
        rule: `Error rate ~${targetPct}%`,
        status: ok ? 'pass' : 'warn',
        message: ok
          ? `${actualPct}% errors (${errCount}/${total}) in "${stream.streamName}" — within tolerance`
          : `${actualPct}% errors (${errCount}/${total}) in "${stream.streamName}" — expected ~${targetPct}%`,
        stream: stream.streamName,
      });
    });
  }

  // 3. Session correlation
  if (rulesText.includes('session') && (rulesText.includes('contiguous') || rulesText.includes('shared') || rulesText.includes('correlation'))) {
    streams.forEach(stream => {
      const sessionKey = ['session_id', 'sessionId', 'session', 'trace_id', 'correlation_id']
        .find(k => stream.events[0]?.[k] !== undefined);

      if (!sessionKey) {
        results.push({ rule: 'Session correlation', status: 'warn', message: `No session key found in "${stream.streamName}"`, stream: stream.streamName });
        return;
      }
      const sessions = {};

      stream.events.forEach((e, i) => {
        const sid = e[sessionKey];
        if (!sessions[sid]) sessions[sid] = [];
        sessions[sid].push(i);
      });

      const sessionArr = Object.values(sessions);

      // Guard: no sessions means no events (or all session IDs were undefined)
      if (sessionArr.length === 0) {
        results.push({ rule: 'Session correlation', status: 'warn', message: `No session events found in "${stream.streamName}"`, stream: stream.streamName });
        return;
      }

      const contiguousCount = sessionArr.filter(idxArr => {
        for (let i = 1; i < idxArr.length; i++) if (idxArr[i] !== idxArr[i - 1] + 1) return false;
        return true;
      }).length;

      const pct = Math.round((contiguousCount / sessionArr.length) * 100);
      const ok = pct >= 80;

      results.push({
        rule: 'Session correlation',
        status: ok ? 'pass' : 'warn',
        message: ok
          ? `${sessionArr.length} sessions found; ${pct}% are contiguous in "${stream.streamName}"`
          : `Only ${pct}% of ${sessionArr.length} sessions are contiguous in "${stream.streamName}"`,
        stream: stream.streamName,
      });
    });
  }

  // 4. Partition spread (e.g. "4 partition keys")
  const partitionMatch = rulesText.match(/(\d+)\s*partition/);
  if (partitionMatch) {
    const targetCount = parseInt(partitionMatch[1], 10);

    streams.forEach(stream => {
      const partKey = ['region', 'partition', 'shard', 'partition_key']
        .find(k => stream.events[0]?.[k] !== undefined);

      if (!partKey) {
        results.push({ rule: 'Partition spread', status: 'warn', message: `No partition key found in "${stream.streamName}"`, stream: stream.streamName });
        return;
      }

      const distinct = new Set(stream.events.map(e => e[partKey])).size;
      const ok = distinct === targetCount;

      results.push({
        rule: 'Partition spread',
        status: ok ? 'pass' : 'warn',
        message: ok
          ? `${distinct} distinct partition values found — matches target in "${stream.streamName}"`
          : `${distinct} partition values found (expected ${targetCount}) in "${stream.streamName}"`,
        stream: stream.streamName,
      });
    });
  }

  // 5. Business hours
  if (rulesText.includes('business') || rulesText.includes('09:00') || rulesText.includes('weekday')) {
    streams.forEach(stream => {
      const tsKey = ['timestamp', 'ts', 'event_time', 'created_at'].find(k => stream.events[0]?.[k]);
      if (!tsKey) return;

      const violations = stream.events.filter(e => {
        const d = new Date(e[tsKey]);
        if (isNaN(d)) return false;
        // Use local-time accessors — the rule template says "local time on weekdays"
        const day = d.getDay();   // 0=Sun, 6=Sat (local)
        const hour = d.getHours(); // local hour
        return day === 0 || day === 6 || hour < 9 || hour >= 18;
      });

      const ok = violations.length === 0;

      results.push({
        rule: 'Business hours',
        status: ok ? 'pass' : 'warn',
        message: ok
          ? `All events fall within business hours in "${stream.streamName}"`
          : `${violations.length} events outside business hours in "${stream.streamName}"`,
        stream: stream.streamName,
      });
    });
  }

  return results;
}

export function computeColumnDistribution(events, colKey) {
  if (!events?.length) return null;

  const values = events.map(e => e[colKey]).filter(v => v !== null && v !== undefined);
  if (!values.length) return null;

  const isNumeric = values.every(v => !isNaN(Number(v)) && v !== '');
  const isBool = values.every(v => v === true || v === false || v === 'true' || v === 'false');

  if (isBool) {
    const trueCount = values.filter(v => v === true || v === 'true').length;
    const falseCount = values.length - trueCount;
    return {
      type: 'categorical',
      counts: [{ label: 'true', count: trueCount }, { label: 'false', count: falseCount }],
      total: values.length,
    };
  }

  if (isNumeric) {
    const nums = values.map(Number);
    const min = nums.reduce((a, b) => (b < a ? b : a), nums[0]);
    const max = nums.reduce((a, b) => (b > a ? b : a), nums[0]);
    const range = max - min;
    const BINS = 8;

    // When all values are identical, a histogram of 8 same-labelled empty bars is meaningless.
    // Return a single categorical entry so the chart renders one clean bar.
    if (range === 0) {
      return {
        type: 'categorical',
        counts: [{ label: String(min), count: nums.length }],
        total: nums.length,
      };
    }

    const binSize = range / BINS;

    const bins = Array.from({ length: BINS }, (_, i) => ({
      label: `${(min + i * binSize).toFixed(1)}`,
      count: 0,
      rangeStart: min + i * binSize,
      rangeEnd: min + (i + 1) * binSize,
    }));

    nums.forEach(n => {
      const idx = Math.min(Math.floor((n - min) / binSize), BINS - 1);
      bins[idx].count++;
    });
    return { type: 'numeric', bins, min, max, mean: nums.reduce((a, b) => a + b, 0) / nums.length, total: values.length };
  }

  // Categorical
  const counts = {};
  values.forEach(v => { const s = String(v); counts[s] = (counts[s] || 0) + 1; });
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([label, count]) => ({ label, count }));
  return { type: 'categorical', counts: sorted, total: values.length };
}

export function generateCodeSnippet(events, streamName, format) {
  if (format === 'python_kafka') {
    return `from kafka import KafkaProducer
import json

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

events = ${JSON.stringify(events, null, 2)}

for event in events:
    producer.send('${streamName}', value=event)
    print(f"Sent: {event}")

producer.flush()
producer.close()`;
  }

  if (format === 'js_fetch') {
    return `const events = ${JSON.stringify(events, null, 2)};

async function publishEvents() {
  for (const event of events) {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  }
}

publishEvents().catch(console.error);`;
  }

  if (format === 'python_requests') {
    return `import requests
import json

events = ${JSON.stringify(events, null, 2)}

for event in events:
    r = requests.post(
        'https://your-endpoint/events',
        json=event,
        headers={'Content-Type': 'application/json'}
    )
    print(f"Status: {r.status_code}, Event: {event.get('event_type', event.get('type', 'unknown'))}")`;
  }

  if (format === 'curl') {
    const first = events[0];
    // Escape single quotes so the JSON payload can safely sit inside a single-quoted shell string.
    // Strategy: end the single-quote, emit a literal ', then reopen the single-quote.
    const escapeForShell = (json) => json.replace(/'/g, "'\\''");
    return `# Publish each event via curl
# Example using the first event:
curl -X POST https://your-endpoint/events \\
  -H "Content-Type: application/json" \\
  -d '${escapeForShell(JSON.stringify(first))}'

# To publish all ${events.length} events, run:
${events.map(e => `curl -X POST https://your-endpoint/events -H "Content-Type: application/json" -d '${escapeForShell(JSON.stringify(e))}'`).join('\n')}`;
  }

  // ndjson default
  return events.map(e => JSON.stringify(e)).join('\n');
}

export function buildCorrelatedView(streams) {
  if (!streams || streams.length < 2) return null;

  // Find the best correlation key across streams
  const CORR_KEYS = ['session_id', 'sessionId', 'trace_id', 'user_id', 'userId', 'correlation_id', 'request_id'];
  const TS_KEYS = ['timestamp', 'ts', 'event_time', 'created_at', 'occurred_at'];

  const sampleEvents = streams.map(s => s.events[0] || {});
  const corrKey = CORR_KEYS.find(k => sampleEvents.some(e => e[k] !== undefined)) || null;
  const tsKey = TS_KEYS.find(k => sampleEvents.some(e => e[k] !== undefined)) || null;

  // Interleave all events tagged with their source stream
  const combined = streams.flatMap((s, idx) =>
    s.events.map(e => ({ ...e, __streamName: s.streamName, __streamIdx: idx }))
  );

  // Sort by timestamp if possible
  if (tsKey) {
    combined.sort((a, b) => {
      const ta = new Date(a[tsKey]).getTime();
      const tb = new Date(b[tsKey]).getTime();
      if (isNaN(ta) || isNaN(tb)) return 0;
      return ta - tb;
    });
  }

  return { combined, corrKey, tsKey };
}