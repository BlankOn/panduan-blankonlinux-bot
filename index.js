'use strict'

const token = process.env.TOKEN;
const Telegram = require('telegram-node-bot')
const Axios = require('axios')
const TelegramBaseController = Telegram.TelegramBaseController
const TelegramBaseInlineQueryController = Telegram.TelegramBaseInlineQueryController
const InlineQueryResultArticle = Telegram.Models.InlineQueryResultArticle
const InputTextMessageContent = Telegram.Models.InputTextMessageContent
const TextCommand = Telegram.TextCommand
const tg = new Telegram.Telegram(token, { workers : 1})
const request = require('request');
const parseString = require('xml2js').parseString;

var registered = [];
var lastTitle = '';

let api = Axios.create({
  baseURL: 'http://panduan.blankonlinux.or.id/wp-json/wp/v2'
});
 

class PingController extends TelegramBaseController {
  /**
   * @param {Scope} $
   */
  pingHandler($) {
    $.sendMessage('pong')
  }

  get routes() {
    return {
      'pingCommand': 'pingHandler'
    }
  }
}

class RegisterController extends TelegramBaseController {
  /**
   * @param {Scope} $
   */
  registerHandler($) {
    let chatId = $._message._chat._id;
    let type = $._message._chat._type;
    console.log(registered);
    if (registered.indexOf(chatId) > -1) {
      if (type === 'group') {
        return $.sendMessage('Group ini telah terdaftar.');
      } else {
        return $.sendMessage('Anda ini telah terdaftar.');
      }
    }
    registered.push(chatId);
    return $.sendMessage('Terima kasih telah mendaftar. Untuk berhenti berlanggan, ketik /panduan_unregister.');
  }

  get routes() {
    return {
      'registerCommand': 'registerHandler'
    }
  }
}

class UnregisterController extends TelegramBaseController {
  /**
   * @param {Scope} $
   */
  unregisterHandler($) {
    let chatId = $._message._chat._id;
    if (registered.indexOf(chatId) > -1) {
      registered.splice(registered.indexOf(chatId), 1);
      console.log(registered);
      return $.sendMessage('Terima kasih telah berlanggan. Untuk kembali berlanggan, ketik /panduan_register.');
    }
  }

  get routes() {
    return {
      'unregisterCommand': 'unregisterHandler'
    }
  }
}

class QueryController extends TelegramBaseInlineQueryController {
    

    handle($){
      var query = $._inlineQuery._query;

      api.get('/posts?per_page=1&search='+query)
        .then(function (response) {

          var answers = [];

          response.data.forEach(function(item){
            console.log(item.slug);

            var title       = decodeHTMLEntities(item.title.rendered).replace(/(<([^>]+)>)/ig,"")
            var content     = decodeHTMLEntities(item.excerpt.rendered).replace(/(<([^>]+)>)/ig,"").substring(0,200);
            var inlineDesc  = content.substring(0,100)+'...';

            content = content + "...\n\n" + item.link;

            var message = new InputTextMessageContent(content);

            answers.push(new InlineQueryResultArticle(
              'article',                // type 
              item.id.toString(),       // id
              item.title.rendered,      // title
              message,                  // InputTextMessageContent
              null,                     // Reply markup
              item.link,                // URL
              false,                     // hide URL
              inlineDesc                // Description
            ));


          })

          return $.answer(answers);

        })
        .catch(function (error) {
          console.log(error);
          return $.answer(answers);
        });

    }

    chosenResult($){
      console.log('chosenResult');
      console.log($);
    }

}

tg.router
  .when(
    new TextCommand('ping', 'pingCommand'),
    new PingController()
  )
  .when(
    new TextCommand('panduan_register', 'registerCommand'),
    new RegisterController()
  )
  .when(
    new TextCommand('panduan_unregister', 'unregisterCommand'),
    new UnregisterController()
  );

// Inline query
tg.router
  .inlineQuery(new QueryController());

setInterval(() => {
  console.log(registered);
  if (registered.length > 0) {
    request('http://panduan.blankonlinux.or.id/feed/', (err, res, body) => {
      parseString(body, (err, result) => {
        console.log(result.rss.channel);
        console.log(result.rss.channel[0].item[0]);
        let newest = result.rss.channel[0].item[0];
        if (lastTitle === newest.title[0]) {
          return;
        }
        lastTitle = newest.title[0];
        for (var i in registered) {
          tg.api.sendMessage(registered[i], 'Tulisan terbaru dari Panduan.boi : ' + newest.link);
        }
      })
    })
  }
}, 1000 * 60 * 10);


var entities = {
  'amp': '&',
  'apos': '\'',
  '#x27': '\'',
  '#x2F': '/',
  '#39': '\'',
  '#47': '/',
  'lt': '<',
  'gt': '>',
  'nbsp': ' ',
  'quot': '"'
}

function decodeHTMLEntities (text) {
  return text.replace(/&([^;]+);/gm, function (match, entity) {
    return entities[entity] || match
  })
}