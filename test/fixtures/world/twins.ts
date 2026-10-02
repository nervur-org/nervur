// Two classes that claim one kind, which no house's classes may hold both of.
import { Being } from 'nervur/being';

export class TwinOne extends Being.of({ kind: 'org.example.twin', asks: { hi: {} } }) {
  hi() {}
}

export class TwinTwo extends Being.of({ kind: 'org.example.twin', asks: { hi: {} } }) {
  hi() {}
}
