// A second class claiming the counter's kind.
import { Being } from 'nervur/being';

export class Counter extends Being.of({ kind: 'org.example.counter', asks: { hello: {} } }) {
  hello() {}
}
