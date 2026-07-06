export const ITEMS_PER_PAGE = 15;

export const DEFAULT_CONFIG = {
  schemaInput: '',
  rules: '',
  eventFormat: 'json',
  streamParadigm: 'telemetry',
  eventCount: '25',
  seed: '',
  dataQuality: 100,
  includeAnalysis: false,
  includeStateMachine: false,
};

export const STREAM_RULE_TEMPLATES = [
  { label: "Burst Pattern", value: "Events should arrive in bursts: 10–20 events within 5 seconds, followed by a 30–60s quiet period." },
  { label: "Business Hours", value: "Timestamps must cluster between 09:00–18:00 local time on weekdays only." },
  { label: "Error Rate 5%", value: "Approximately 5% of events should be error or failure events." },
  { label: "Sequential Correlation", value: "Each event's session_id must be shared across a contiguous run of 3–8 events." },
  { label: "Monotonic Timestamps", value: "All event timestamps must be strictly monotonically increasing." },
  { label: "Partition Key Spread", value: "Distribute events evenly across 4 partition keys (e.g. region: us-east, us-west, eu-west, ap-south)." },
];

export const EVENT_FORMATS = [
  { value: 'json', label: 'JSON (newline-delimited)' },
  { value: 'kafka', label: 'Kafka Message (JSON)' },
  { value: 'eventbridge', label: 'AWS EventBridge' },
  { value: 'cloudevents', label: 'CloudEvents v1.0' },
  { value: 'pubsub', label: 'Google Pub/Sub' },
  { value: 'kinesis', label: 'AWS Kinesis' },
];

export const STREAM_PARADIGMS = [
  { value: 'telemetry', label: 'Telemetry / Metrics', icon: 'fa-chart-line' },
  { value: 'access_log', label: 'Access Logs', icon: 'fa-list-alt' },
  { value: 'journey', label: 'Customer Journey', icon: 'fa-route' },
  { value: 'iot', label: 'IoT / Sensor', icon: 'fa-microchip' },
  { value: 'audit', label: 'Audit Trail', icon: 'fa-shield-alt' },
  { value: 'custom', label: 'Custom Schema', icon: 'fa-code' },
];

export const SAMPLE_TEMPLATES = [
  {
    label: "E-Commerce Checkout Journey (Funnel)",
    schema: `{\n  "event_type": "page_view | add_to_cart | begin_checkout | purchase",\n  "user_id": "UUID",\n  "session_id": "string",\n  "product_id": "string?",\n  "cart_value": "float?",\n  "timestamp": "ISO8601"\n}`,
    rules: "Events within a session must strictly follow the funnel: page_view -> add_to_cart -> begin_checkout -> purchase.\nNot all sessions reach purchase (simulate realistic drop-offs).\nTimestamps within a session must be monotonic, separated by 5-60 seconds.",
    streamParadigm: "journey",
    eventFormat: "json"
  },
  {
    label: "IoT Thermostat Telemetry",
    schema: `{\n  "device_id": "UUID",\n  "event_type": "telemetry",\n  "temperature": "float",\n  "humidity": "float",\n  "hvac_status": "cooling | heating | idle",\n  "timestamp": "ISO8601"\n}`,
    rules: "Temperature should fluctuate realistically between 68.0 and 74.0.\nHVAC status triggers 'cooling' when temp > 73.0, and goes 'idle' when temp drops below 69.0.\nEvents arrive in exact 1-minute increments.",
    streamParadigm: "iot",
    eventFormat: "kafka"
  },
  {
    label: "Server Access Logs (Audit)",
    schema: `{\n  "request_id": "UUID",\n  "ip_address": "string",\n  "method": "GET | POST | PUT | DELETE",\n  "path": "string",\n  "status_code": "integer",\n  "latency_ms": "integer",\n  "timestamp": "ISO8601"\n}`,
    rules: "90% of requests should be GET requests with status 200.\n5% should be POST requests.\n5% should simulate errors (status 400, 401, 404, or 500).\nLatency for errors should be significantly higher.",
    streamParadigm: "access_log",
    eventFormat: "json"
  }
];