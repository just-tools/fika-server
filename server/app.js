'use strict';

const koa = require('koa');
const router = require('koa-router')();
const app = koa();
const conn = require('../conn');
const Word = require('../model/Word');
const Category = require('../model/Category');
const Dictionary = require('../model/Dictionary');
const _s = require('strman');
const BusinessError = require('./error/BusinessError.js');
const DEFAULT_SNAKE_SIZE = 10;
const DEFAULT_ASSOCIATE_SIZE = 1;
const QUERRY_SPLITER = /,/;
// connect to database
conn.connect();

/**
 * 词汇联想
 */
router.get('/associate', function*(next) {
  const query = this.query;
  const word = query.word;
  let size = query.size;
  size = size ? parseInt(size, 10) : DEFAULT_ASSOCIATE_SIZE;
  const categories = parseQueryToArray(query.categories);
  const dictionaries = parseQueryToArray(query.dictionaries);
  if (!word) {
    throw new BusinessError('args_required', 'need word params');
  }
  const lastChar = _s.last(word, 1);
  const filter = {
    text: new RegExp('^' + lastChar),
  };
  if (categories) {
    filter.cate = {
      $in: categories,
    };
  }
  if (dictionaries) {
    filter.dict = {
      $in: dictionaries,
    };
  }
  let words = yield randomWord(filter, size);
  if (size === 1) {
    words = [words];
  }
  this.body = words.map(word => word.text);
});


/**
 * 词汇接龙
 */
router.get('/snake', function*(next) {
  const query = this.query;
  const words = [];
  let word = query.word;
  let size = query.size;
  size = size ? parseInt(size, 10) : DEFAULT_SNAKE_SIZE;
  const categories = parseQueryToArray(query.categories);
  const dictionaries = parseQueryToArray(query.dictionaries);
  if (!word) {
    word = yield randomWord();
    if (!word) {
      return this.body = words;
    }
    word = word.text;
  }
  words.push(word);
  let curWord = word;
  let index = 1;
  while(index++ < size) {
    if (!curWord) { break; }
    const lastChar = _s.last(curWord, 1);
    const filter = {
      text: new RegExp('^' + lastChar),
    };
    if (categories) {
      filter.cate = {
        $in: categories,
      };
    }
    if (dictionaries) {
      filter.dict = {
        $in: dictionaries,
      };
    }
    const newWord = yield randomWord(filter, 1);
    if (!newWord) { break; }
    curWord = newWord.text;
    words.push(curWord);
  }
  this.body = words;
});


/**
 * 获取词库分类列表
 */
router.get('/categories', function*(next) {
  const query = this.query;
  const name = query.name;
  const filter = {};
  if (name) {
    filter._id = new RegExp(name);
  }
  const categories = yield Category.find(filter).exec();
  this.body = categories;
});


/**
 * 获取字典列表
 */
router.get('/dictionaries', function*(next) {
  const query = this.query;
  const name = query.name;
  const categories = parseQueryToArray(query.categories);
  const filter = {};
  if (name) {
    filter._id = new RegExp(name);
  }
  if (categories) {
    filter.categories = { $in : categories };
  }

  const dictionaries = yield Dictionary.find(filter).exec();
  this.body = dictionaries;
});

function randomWord(filter, size) {
  filter = filter || {};
  size = size || 1;
  return new Promise((resolve, reject) => {
    Word.aggregate({
      $match: filter,
    }).sample(size).exec((err, result) => {
      if (err) {
        reject(err);
      } else {
        if (result.length === 0) { return resolve(null); }
        if (size === 1) {
          resolve(result[0]);
        } else {
          resolve(result);
        }
      }
    });
  });
}

function parseQueryToArray(str) {
  return typeof str === 'string' ? str.split(QUERRY_SPLITER) : null;
}

app.use(function*(next) {
  try {
    yield next;
  } catch (err) {
    this.status = err.status || 500;
    this.body = {
      code: err.code,
      message: err.message
    };
    this.app.emit('error', err, this);
  }
});

app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3210);
