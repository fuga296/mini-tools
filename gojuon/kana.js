/*
 * kana.js — 五十音の文字データと処理(画面に依存しない)
 *
 * ブラウザでは window.Gojuon、Node では require('./kana.js') で使える。
 * DOM・通信・保存には一切触れない純粋な関数とデータだけを置く。
 *
 * 用語
 *   行(ぎょう) … 子音でまとめた並び(あ行・か行…)。データ上は「列 column」。
 *   段(だん)   … 母音でまとめた並び(あ段・い段…)。各列は 5 段ぶんの配列を持つ。
 *   マス cell   … { id, h }。id は表記によらない固定の識別子、h はひらがな表記。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Gojuon = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAN = ['あ', 'い', 'う', 'え', 'お'];

  /* ---------- 文字データ ---------- */

  // 文字列 5 字(空きは '・')から列データを作る
  function col(id, label, five, extra) {
    var cells = Array.from(five).map(function (ch, i) {
      return ch === '・' ? null : { id: id + i, h: ch };
    });
    var c = { id: id, label: label, cells: cells };
    if (extra) for (var k in extra) c[k] = extra[k];
    return c;
  }
  // 拗音などの「あ・う・お段に 3 つ」の列
  function col3(id, label, a, u, o) {
    return { id: id, label: label, cells: [
      { id: id + 0, h: a }, null, { id: id + 2, h: u }, null, { id: id + 4, h: o }] };
  }

  // 清音(や行・わ行の空きは build 時に埋める)
  var SEION = [
    col('a', 'あ', 'あいうえお'),
    col('k', 'か', 'かきくけこ'),
    col('s', 'さ', 'さしすせそ'),
    col('t', 'た', 'たちつてと'),
    col('n', 'な', 'なにぬねの'),
    col('h', 'は', 'はひふへほ'),
    col('m', 'ま', 'まみむめも'),
    col('y', 'や', 'や・ゆ・よ'),
    col('r', 'ら', 'らりるれろ'),
    col('w', 'わ', 'わ・・・を')
  ];

  // 歴史的仮名(古い表記)。level: 'some' は「一部」で入る、'all' は「全部」でだけ入る
  var ARCHAIC = [
    { col: 'w', dan: 1, id: 'w1', h: 'ゐ', level: 'some' },
    { col: 'w', dan: 3, id: 'w3', h: 'ゑ', level: 'some' },
    { col: 'y', dan: 3, id: 'y3', h: '\u{1B001}', level: 'all' }, // や行え 𛀁
    { col: 'w', dan: 2, id: 'w2', h: '\u{1B11F}', level: 'all' }  // わ行う 𛄟
  ];
  var ARCHAIC_LABEL = { none: 'なし', some: '一部(ゐ・ゑ)', all: '全部(ゐ・ゑ・や行え・わ行う)' };

  var DAKUON = [
    col('g', 'が', 'がぎぐげご'),
    col('z', 'ざ', 'ざじずぜぞ'),
    col('d', 'だ', 'だぢづでど'),
    col('b', 'ば', 'ばびぶべぼ')
  ];
  var HANDAKUON = [col('p', 'ぱ', 'ぱぴぷぺぽ')];
  var VU = [col('v', 'ゔ', '・・ゔ・・')];
  var SMALL = [
    col('xa', 'ぁ', 'ぁぃぅぇぉ'),
    col('xk', 'ゕ', 'ゕ・・ゖ・'),
    col('xt', 'っ', '・・っ・・'),
    col('xy', 'ゃ', 'ゃ・ゅ・ょ'),
    col('xw', 'ゎ', 'ゎ・・・・')
  ];
  var YOUON_SEI = [
    col3('ky', 'きゃ', 'きゃ', 'きゅ', 'きょ'),
    col3('sy', 'しゃ', 'しゃ', 'しゅ', 'しょ'),
    col3('ty', 'ちゃ', 'ちゃ', 'ちゅ', 'ちょ'),
    col3('ny', 'にゃ', 'にゃ', 'にゅ', 'にょ'),
    col3('hy', 'ひゃ', 'ひゃ', 'ひゅ', 'ひょ'),
    col3('my', 'みゃ', 'みゃ', 'みゅ', 'みょ'),
    col3('ry', 'りゃ', 'りゃ', 'りゅ', 'りょ')
  ];
  var YOUON_DAKU = [
    col3('gy', 'ぎゃ', 'ぎゃ', 'ぎゅ', 'ぎょ'),
    col3('jy', 'じゃ', 'じゃ', 'じゅ', 'じょ'),
    col3('by', 'びゃ', 'びゃ', 'びゅ', 'びょ')
  ];
  var YOUON_HAN = [col3('py', 'ぴゃ', 'ぴゃ', 'ぴゅ', 'ぴょ')];

  // 「ん」の置き方
  var N_PLACES = {
    'col-top': 'わ行の次の列・あ段(上)',
    'col-mid': 'わ行の次の列・う段(中)',
    'col-bottom': 'わ行の次の列・お段(下)',
    'outside': '表の外に単独で',
    'none': '入れない'
  };
  // 追加の文字グループの置き方
  var PLACES = { none: '入れない', main: '本表に続けて', separate: '別の表にする' };
  var GROUPS = [
    { key: 'dakuon', name: '濁音', title: '濁音(だくおん)' },
    { key: 'handakuon', name: '半濁音', title: '半濁音(はんだくおん)' },
    { key: 'vu', name: '「ゔ」', title: '「ゔ」' },
    { key: 'small', name: '小書き文字', title: '小書き文字' },
    { key: 'youon', name: '拗音', title: '拗音(ようおん)' }
  ];

  // 既定 = 一般的な五十音表(清音 46 字、ん は わ行の次の列の上、ゐ・ゑ なし)
  var DEFAULTS = {
    n: 'col-top',
    archaic: 'none',
    gapFill: 'blank',   // 'blank' 空欄 / 'dup' あ行の字を薄く表示
    dakuon: 'none', handakuon: 'none', vu: 'none', small: 'none', youon: 'none'
  };

  /* ---------- 表を組み立てる ---------- */

  function cloneCol(c) {
    return { id: c.id, label: c.label, cells: c.cells.slice() };
  }

  function groupCols(key, o) {
    switch (key) {
      case 'dakuon': return DAKUON;
      case 'handakuon': return HANDAKUON;
      case 'vu': return VU;
      case 'small': return SMALL;
      case 'youon':
        return YOUON_SEI
          .concat(o.dakuon !== 'none' ? YOUON_DAKU : [])
          .concat(o.handakuon !== 'none' ? YOUON_HAN : []);
    }
    return [];
  }

  // 全部が空の段を落とす(別表で拗音なら ゃ・ゅ・ょ の 3 段になる)
  function compact(cols) {
    var keep = [0, 1, 2, 3, 4].filter(function (d) {
      return cols.some(function (c) { return c.cells[d] && !c.cells[d].filler; });
    });
    return keep;
  }

  /**
   * 設定から表を作る。
   * 戻り値: { tables: [{ id, title, cols:[{id,label,cells[5]}], dans:[段番号] }] }
   * cells の要素は { id, h } / { filler:'い' }(薄く表示する飾り) / null(空欄)
   */
  function build(options) {
    var o = Object.assign({}, DEFAULTS, options || {});
    var lv = o.archaic === 'all' ? 2 : o.archaic === 'some' ? 1 : 0;
    var main = SEION.map(cloneCol);
    var byId = {};
    main.forEach(function (c) { byId[c.id] = c; });
    ARCHAIC.forEach(function (a) {
      if ((a.level === 'some' && lv >= 1) || (a.level === 'all' && lv >= 2))
        byId[a.col].cells[a.dan] = { id: a.id, h: a.h, archaic: true };
    });
    if (o.gapFill === 'dup') {
      ['y', 'w'].forEach(function (cid) {
        byId[cid].cells.forEach(function (c, d) {
          if (!c) byId[cid].cells[d] = { filler: DAN[d] };
        });
      });
    }
    var tables = [];
    var nPos = { 'col-top': 0, 'col-mid': 2, 'col-bottom': 4 }[o.n];
    if (nPos !== undefined) {
      var nc = { id: 'nn', label: 'ん', cells: [null, null, null, null, null] };
      nc.cells[nPos] = { id: 'nn', h: 'ん' };
      main.push(nc);
    }
    var mainTable = { id: 'main', title: '五十音', cols: main, dans: [0, 1, 2, 3, 4] };
    tables.push(mainTable);
    if (o.n === 'outside') {
      var only = { id: 'nn', label: 'ん', cells: [{ id: 'nn', h: 'ん' }, null, null, null, null] };
      tables.push({ id: 'n', title: '「ん」', cols: [only], dans: [0] });
    }
    GROUPS.forEach(function (g) {
      var place = o[g.key];
      if (!place || place === 'none') return;
      var cols = groupCols(g.key, o).map(cloneCol);
      if (place === 'main') mainTable.cols = mainTable.cols.concat(cols);
      else tables.push({ id: g.key, title: g.title, cols: cols, dans: compact(cols) });
    });
    return { options: o, tables: tables };
  }

  // 表に含まれる全マス(飾りを除く)を、表→行→段の順で返す
  function cellsOf(built) {
    var out = [];
    built.tables.forEach(function (t) {
      t.cols.forEach(function (c) {
        t.dans.forEach(function (d) {
          var x = c.cells[d];
          if (x && !x.filler) out.push(x);
        });
      });
    });
    return out;
  }

  /* ---------- ひらがな・カタカナ ---------- */

  var SPECIAL_H2K = { '\u{1B001}': '\u{1B121}', '\u{1B11F}': '\u{1B122}' };
  var SPECIAL_K2H = { '\u{1B121}': '\u{1B001}', '\u{1B122}': '\u{1B11F}', '\u{1B000}': '\u{1B001}' };

  function toKatakana(s) {
    return Array.from(String(s)).map(function (ch) {
      if (SPECIAL_H2K[ch]) return SPECIAL_H2K[ch];
      var c = ch.codePointAt(0);
      return (c >= 0x3041 && c <= 0x3096) || c === 0x309D || c === 0x309E
        ? String.fromCodePoint(c + 0x60) : ch;
    }).join('');
  }
  function toHiragana(s) {
    return Array.from(String(s)).map(function (ch) {
      if (SPECIAL_K2H[ch]) return SPECIAL_K2H[ch];
      var c = ch.codePointAt(0);
      return (c >= 0x30A1 && c <= 0x30F6) || c === 0x30FD || c === 0x30FE
        ? String.fromCodePoint(c - 0x60) : ch;
    }).join('');
  }
  function isHiragana(ch) { var c = ch.codePointAt(0); return (c >= 0x3041 && c <= 0x309F) || ch === '\u{1B001}' || ch === '\u{1B11F}'; }
  function isKatakana(ch) { var c = ch.codePointAt(0); return (c >= 0x30A0 && c <= 0x30FF) || (c >= 0x1B120 && c <= 0x1B122) || c === 0x1B000; }

  // 表記: script は 'hira' | 'kata'
  function display(h, script) { return script === 'kata' ? toKatakana(h) : h; }

  // 文字列を「1 マス単位」に切る(きゃ のように小書きの ゃゅょぁぃぅぇぉゎ は前の字とまとめる)
  var COMBINING_SMALL = 'ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ';
  function splitUnits(text) {
    var out = [];
    Array.from(String(text)).forEach(function (ch) {
      if (!isHiragana(ch) && !isKatakana(ch)) return;
      var prev = out[out.length - 1];
      if (prev && COMBINING_SMALL.indexOf(ch) >= 0 && Array.from(prev).length === 1 &&
          COMBINING_SMALL.indexOf(prev) < 0 && 'っッー'.indexOf(prev) < 0) {
        out[out.length - 1] = prev + ch;
      } else out.push(ch);
    });
    return out;
  }

  /* ---------- 濁点・半濁点 ---------- */

  var DAKU_FROM = 'かきくけこさしすせそたちつてとはひふへほう';
  var DAKU_TO = 'がぎぐげござじずぜぞだぢづでどばびぶべぼゔ';
  var HAN_FROM = 'はひふへほ', HAN_TO = 'ぱぴぷぺぽ';
  var SMALL_FROM = 'あいうえおやゆよつわかけ', SMALL_TO = 'ぁぃぅぇぉゃゅょっゎゕゖ';

  // 1 字のひらがなを、濁点・半濁点・小書きに読み替えた候補(自分自身を含む)
  function variants(h) {
    var v = [h], i;
    if ((i = DAKU_FROM.indexOf(h)) >= 0) v.push(DAKU_TO[i]);
    if ((i = HAN_FROM.indexOf(h)) >= 0) v.push(HAN_TO[i]);
    if ((i = SMALL_FROM.indexOf(h)) >= 0) v.push(SMALL_TO[i]);
    return v;
  }
  // 濁点・半濁点・小書きを外した元の字
  function baseOf(h) {
    var i;
    if ((i = DAKU_TO.indexOf(h)) >= 0) return DAKU_FROM[i];
    if ((i = HAN_TO.indexOf(h)) >= 0) return HAN_FROM[i];
    if ((i = SMALL_TO.indexOf(h)) >= 0) return SMALL_FROM[i];
    return h;
  }

  /* ---------- 乱数 ---------- */

  function defaultRng() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296;
    }
    return Math.random();
  }
  function shuffle(list, rng) {
    rng = rng || defaultRng;
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /**
   * pool から n 個選ぶ。unique=true なら重複なし(n は pool の数まで)。
   */
  function sample(pool, n, opt) {
    opt = opt || {};
    var rng = opt.rng || defaultRng;
    n = Math.max(0, Math.floor(n) || 0);
    if (!pool.length) return [];
    if (opt.unique) return shuffle(pool, rng).slice(0, Math.min(n, pool.length));
    var out = [];
    for (var i = 0; i < n; i++) out.push(pool[Math.floor(rng() * pool.length)]);
    return out;
  }

  /* ---------- 札あそび用の山札 ---------- */

  // 清音 45 字 + ん(ゐ・ゑ を除く)を copies 枚ずつ。母音と「ん」は extraVowel 枚多く
  function makeDeck(copies, extraVowel, rng) {
    copies = copies || 2; extraVowel = extraVowel || 0;
    var deck = [];
    cellsOf(build(DEFAULTS)).forEach(function (c) {
      var k = copies + ('あいうえおん'.indexOf(c.h) >= 0 ? extraVowel : 0);
      for (var i = 0; i < k; i++) deck.push(c.h);
    });
    return shuffle(deck, rng);
  }

  return {
    DAN: DAN, DEFAULTS: DEFAULTS, N_PLACES: N_PLACES, PLACES: PLACES, GROUPS: GROUPS,
    ARCHAIC_LABEL: ARCHAIC_LABEL,
    data: { SEION: SEION, ARCHAIC: ARCHAIC, DAKUON: DAKUON, HANDAKUON: HANDAKUON, VU: VU,
            SMALL: SMALL, YOUON_SEI: YOUON_SEI, YOUON_DAKU: YOUON_DAKU, YOUON_HAN: YOUON_HAN },
    build: build, cellsOf: cellsOf,
    toKatakana: toKatakana, toHiragana: toHiragana, isHiragana: isHiragana, isKatakana: isKatakana,
    display: display, splitUnits: splitUnits, variants: variants, baseOf: baseOf,
    shuffle: shuffle, sample: sample, makeDeck: makeDeck
  };
});
