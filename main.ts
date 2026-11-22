import type { Buffer } from 'node:buffer';
import * as fs from 'node:fs';
import { join } from 'node:path';

type Handler = (operand: number) => number | void;
type Instruction = {
  width: number;
  need: number;
  grows: boolean;
  handle: Handler;
};

function run(program: Buffer, input: Buffer) {
  const data = new Int32Array(256);
  const memory = new Int32Array(256);
  const addresses = new Int32Array(64);
  const output = new Uint8Array(65_536);
  const dispatch: Instruction[] = [];
  let size = 0;
  let depth = 0;
  let pc = 0;
  let used = 0;
  let read = 0;

  function define(op: number, need: number, handle: Handler, width = 1, grows = false) {
    dispatch[op] = { width, need, grows, handle };
  }

  const push = (value: number) => { data[size++] = value; };
  const pop = () => data[--size];
  const top = () => data[size - 1];

  function producer(op: number, need: number, value: (operand: number) => number, width = 1) {
    define(op, need, operand => push(value(operand)), width, true);
  }

  function binary(op: number, calc: (a: number, b: number) => number, divides = false) {
    define(op, 2, () => {
      const rhs = top();
      if (divides && rhs === 0) return 4;
      const lhs = size - 2;
      // Storing into Int32Array truncates quotients and wraps results to 32 bits.
      data[lhs] = calc(data[lhs], rhs);
      size--;
    });
  }

  define(0x00, 0, () => 0);
  producer(0x01, 0, at => program.readInt8(at), 2);
  producer(0x02, 0, at => program.readInt32LE(at), 5);
  define(0x03, 1, () => { size--; });
  producer(0x04, 1, top);
  define(0x05, 2, () => {
    const last = pop();
    const first = top();
    data[size - 1] = last;
    push(first);
  });
  producer(0x06, 2, () => data[size - 2]);
  define(0x07, 3, () => {
    const last = pop();
    const middle = pop();
    const first = pop();
    push(middle);
    push(last);
    push(first);
  });

  binary(0x10, (a, b) => a + b);
  binary(0x11, (a, b) => a - b);
  binary(0x12, Math.imul);
  binary(0x13, (a, b) => a / b, true);
  binary(0x14, (a, b) => a % b, true);
  binary(0x15, (a, b) => (a >>> 0) / (b >>> 0), true);
  binary(0x16, (a, b) => (a >>> 0) % (b >>> 0), true);
  define(0x17, 1, () => { data[size - 1] = -top(); });
  binary(0x18, (a, b) => a & b);
  binary(0x19, (a, b) => a | b);
  binary(0x1a, (a, b) => a ^ b);
  define(0x1b, 1, () => { data[size - 1] = ~top(); });
  binary(0x1c, (a, b) => a << b);
  binary(0x1d, (a, b) => a >> b);
  binary(0x1e, (a, b) => a >>> b);
  binary(0x20, (a, b) => Number(a === b));
  binary(0x21, (a, b) => Number(a < b));
  binary(0x22, (a, b) => Number((a >>> 0) < (b >>> 0)));

  const jump = (at: number) => { pc += program.readInt16LE(at); };
  define(0x30, 0, jump, 3);
  define(0x31, 1, at => { if (pop() === 0) jump(at); }, 3);
  define(0x32, 1, at => { if (pop() !== 0) jump(at); }, 3);
  define(0x33, 0, at => {
    if (depth === addresses.length) return 7;
    addresses[depth++] = pc;
    pc = program.readUInt16LE(at);
  }, 3);
  define(0x34, 0, () => {
    if (depth === 0) return 8;
    pc = addresses[--depth];
  });

  define(0x40, 1, () => {
    const index = top() >>> 0;
    if (index >= memory.length) return 6;
    data[size - 1] = memory[index];
  });
  define(0x41, 2, () => {
    const index = top() >>> 0;
    if (index >= memory.length) return 6;
    size -= 2;
    memory[index] = data[size];
  });

  define(0x50, 1, () => {
    const decimal = String(top());
    if (used + decimal.length > output.length) return 11;
    for (let i = 0; i < decimal.length; i++) output[used++] = decimal.charCodeAt(i);
    size--;
  });
  define(0x51, 1, () => {
    if (used === output.length) return 11;
    output[used++] = pop();
  });
  producer(0x52, 0, () => read < input.length ? input[read++] : -1);
  define(0x53, 1, () => top() & 255);

  function execute() {
    for (let fuel = 1_000_000; fuel > 0; fuel--) {
      if ((pc >>> 0) >= program.length) return 9;
      const instruction = dispatch[program[pc]];
      if (!instruction) return 5;
      const operand = pc + 1;
      pc += instruction.width;
      if (pc > program.length) return 9;
      if (size < instruction.need) return 2;
      if (instruction.grows && size === data.length) return 3;
      const exit = instruction.handle(operand);
      if (exit !== undefined) return exit;
    }
    return 10;
  }

  const exit = execute();
  return { exit, bytes: output.subarray(0, used) };
}

const inputRoot = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

for (const id of fs.readdirSync(inputRoot).sort()) {
  const source = join(inputRoot, id);
  const program = fs.readFileSync(join(source, 'program.bin'));
  const input = fs.readFileSync(join(source, 'input.bin'));
  const { bytes, exit } = run(program, input);
  const destination = join(outputRoot, id);
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(join(destination, 'stdout.bin'), bytes);
  fs.writeFileSync(join(destination, 'exit.txt'), String(exit));
}
