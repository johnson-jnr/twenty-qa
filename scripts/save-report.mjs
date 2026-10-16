// Copies the last HTML report (playwright-report/) into reports/<test-name>_<run-time>/
// so it survives the next run. Usage: pnpm save-report
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const SOURCE = 'playwright-report';
const DESTINATION_ROOT = 'reports';

const fail = (message) => {
  console.error(`save-report: ${message}`);
  process.exit(1);
};

// The report embeds its data as a base64 zip inside index.html.
const readReportJson = () => {
  const indexPath = `${SOURCE}/index.html`;
  if (!existsSync(indexPath)) fail(`no report found at ${indexPath}. Run some tests first.`);

  const html = readFileSync(indexPath, 'utf8');
  const match = html.match(/data:application\/zip;base64,([A-Za-z0-9+/=]+)/);
  if (!match) fail('could not find the report data inside index.html.');

  return JSON.parse(readZipEntry(Buffer.from(match[1], 'base64'), 'report.json'));
};

// Minimal zip reader (central directory lookup + deflate), enough for the report zip.
const readZipEntry = (zip, entryName) => {
  const endOfDirectory = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = zip.readUInt32LE(endOfDirectory + 16);
  const entryCount = zip.readUInt16LE(endOfDirectory + 10);

  for (let index = 0; index < entryCount; index++) {
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);

    if (name === entryName) {
      const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const data = zip.subarray(dataStart, dataStart + compressedSize);
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  fail(`${entryName} not found in the report data.`);
};

const slugify = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

const formatTimestamp = (milliseconds) => {
  const date = new Date(milliseconds);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
};

const report = readReportJson();

// A --list or no-match run still writes a report, but with nothing executed.
const executedTests = report.files
  .flatMap((file) => file.tests)
  .filter((test) => test.results.length > 0);
if (executedTests.length === 0) {
  fail('the last report has no executed tests (was it a --list run?). Nothing saved.');
}

const titles = [...new Set(executedTests.map((test) => test.title))];
const runName =
  titles.length === 1 ? titles[0] : `${titles[0]} and ${titles.length - 1} more`;

const destination = `${DESTINATION_ROOT}/${slugify(runName)}_${formatTimestamp(report.startTime)}`;
if (existsSync(destination)) fail(`already saved at ${destination}.`);

cpSync(SOURCE, destination, { recursive: true });

const passed = executedTests.filter((test) => test.outcome === 'expected').length;
console.log(`Saved ${titles.length} test(s), ${passed} passed, to ${destination}`);
console.log(`Open it with: ./node_modules/.bin/playwright show-report ${destination}`);
