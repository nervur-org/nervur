// SPDX-License-Identifier: Apache-2.0
// The shop module, as its author writes it: one ES module that imports
// nothing but 'nervur'. A contract, one faculty that fulfils it and one
// nobody fulfils, a shop, and a customer who takes it and lends the echo.
import { Being, Faculty, isSilence, isWord, told } from 'nervur';

export const module = 'org.example.shop';
export const version = '1';

const said = (x) => (isSilence(x) ? 'silence' : isWord(x) ? told(x) : x);

class Echoes extends Faculty {
  static kind = 'org.example.echoes';
}
class Echo extends Echoes {
  static kind = 'org.example.echo';
  static asks = { echo: {}, offers: {} };
  echo(args, asker) {
    return { echoed: args.text ?? null, to: asker.id ?? null };
  }
  offers() {
    return { offers: this.cells.offers ?? {} };
  }
}
class Unfulfilled extends Faculty {
  static kind = 'org.example.unfulfilled';
}

class Shop extends Being {
  static kind = 'org.example.shop';
  static cells = { sold: [] };
  static asks = { buy: {}, sold: {} };
  buy(args, asker) {
    this.cells.sold.push(String(args.item) + ' to ' + (asker.id ?? 'nobody'));
    return { bought: args.item ?? null };
  }
  sold() {
    return { sold: this.cells.sold };
  }
}

class Customer extends Being {
  static kind = 'org.example.customer';
  static asks = { join: {}, buy: {}, echo: {}, nothing: {} };
  async join(args) {
    return { joined: await this.stance.standings.take('shop', args.invitation) };
  }
  async buy(args) {
    return { said: said(await this.stance.standings.get('shop').ask('buy', args)) };
  }
  async echo(args) {
    const lent = this.stance.standings.get('echo') ? 'echo' : await this.stance.lend(Echoes, 'echo');
    if (lent === null) return { said: 'nothing lent' };
    return { said: said(await this.stance.standings.get('echo').ask('echo', args)) };
  }
  async nothing() {
    return { lent: await this.stance.lend(Unfulfilled, 'x') };
  }
}

export const classes = [Echo, Shop, Customer];
