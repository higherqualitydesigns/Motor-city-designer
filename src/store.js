const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'database.json');

const defaultData = {
  users: [],
  subscriptions: [],
  paymentEvents: [],
  orders: [],
  inboxMessages: []
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');

  try {
    const parsed = JSON.parse(raw);
    return {
      ...defaultData,
      ...parsed,
      users: parsed.users || [],
      subscriptions: parsed.subscriptions || [],
      paymentEvents: parsed.paymentEvents || [],
      orders: parsed.orders || [],
      inboxMessages: parsed.inboxMessages || []
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function writeData(nextData) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextData, null, 2));
}

function updateData(mutator) {
  const data = readData();
  const nextData = mutator(data) || data;
  writeData(nextData);
  return nextData;
}

module.exports = {
  readData,
  writeData,
  updateData
};
