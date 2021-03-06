/**
 * Parses the tree structure into a container that
 * we can use to organize the data we need and will compile.
 *
 * Pass this container to the compiler.
 */

'use strict';

const Needle = require('node-needle');
const Token = require('./token');
const _ = require('./constants');

const Parser = function(taskFile, tokenList){
  this.taskFile = taskFile;
  this.tokenList = tokenList;
  this.tokenTree = new Needle.KaryTree(null);
  this.state = _.STARTING;
}

Parser.prototype.generateTokenTree = function(){
  var node = this.tokenList.head,
      token;
  while(node !== null){
    switch(node.data.label){
      case _.ENUM.COMMENT:
        if(this.state === _.STARTING || this.state === _.LOOKING_FOR_COMMENT || this.state === _.FOUND_A_COMMENT){
          this.parseCommentToken(node);
        }
        break;
      case _.ENUM.DATA_TYPE:
        if(this.state === _.FOUND_A_COMMENT){
          this.parseDataTypeToken(node);
        }
        break;
      case _.ENUM.PROTO:
        if(this.state === _.FOUND_A_COMMENT){
          this.parseProtoTypeToken(node);
        }
        break;
      default:
    }
    node = node.next;
  }
}

Parser.prototype.parseCommentToken = function(token){
  this.tokenTree.root.appendChild('NODE');
  var tokens = [];
  var data = token.data.content;
  var tokenizer = null;
  var lastChildIndex = this.tokenTree.root.children.length - 1;

  // Attempt to extract a description
  tokenizer = _.EXTRACT_DESC.exec(data);
  var descriptionText = tokenizer && tokenizer[1] || '_no description provided_';
  tokens.push(new Token(_.DESCRIPTION, descriptionText));

  // Parse into tokens with tags
  do{
    tokenizer = _.TAGFORMAT.exec(data);
    if(tokenizer){
      tokens.push(new Token(tokenizer[1], tokenizer[2]));
    }
  }while(tokenizer);

  // Clean the content
  tokens.map(function(tok, index){
    // Reset regex
    this.resetRegex();
    let firstCheck = true;

    // Clean up some content
    tokens[index].label = tok.label.split('@').join('');
    tokens[index].content = tok.content.split('/**').join('');
    tokens[index].content = tok.content.split('*/').join('');
    tokens[index].content = tok.content.split('*').join('');
    tokens[index].content = tok.content.replace(/ +(?= )/g, '').trim();

    // Parse for description
    do {
      tokenizer = _.EXTRACT_PROPERTY.exec(tok.content);
      if (tokenizer) {
        tok.description = tokenizer[3];
      }
    } while(tokenizer);

    // If types are defined, we want to split this up
    do{
      // Parse for type
      tokenizer = _.EXTRACT_TYPE.exec(tok.content);
      if(tokenizer) {
        if(typeof tok.type === 'undefined'){
          tok.type = [];
        }
        tok.type.push(tokenizer[1] || 'any');

        // If name is unset, set it
        if (!tok.argName) {
          tok.argName = tokenizer[2];
        }
      } else {
        // If a param was defined but its type was not specified, throw an error
        if (firstCheck && (tok.label === 'property' ||
           tok.label === _.RETURN ||
           tok.label === _.PARAM)) {
          throw new Error(`Missing argument type or argument description for a parameter in ${this.taskFile}`);
        }
      }
      firstCheck = false;
    }while(tokenizer);
    // If names are defined, we want to split this up
    do{
      tokenizer = _.EXTRACT_NAME.exec(tok.content);
      if(tokenizer){
        if(typeof tok.name === 'undefined'){
          tok.name = [];
        }
        tok.name.push(tokenizer[1].split(' ')[0]);
      }
    }while(tokenizer);
    this.tokenTree.root.children[lastChildIndex].appendChild(tok);
  }.bind(this));

  this.state = _.FOUND_A_COMMENT;
}

Parser.prototype.parseDataTypeToken = function(token){
  var tokens = [];
  var data = token.data.content;
  var tokenizer;
  var lastChildIndex = this.tokenTree.root.children.length - 1;
  do{
    tokenizer = _.DATA_TYPES.exec(data);
    if(tokenizer){
      tokens.push(new Token(tokenizer[1], tokenizer[4]));
    }
  }while(tokenizer);
  tokens.map(function(tok){
    this.tokenTree.root.children[lastChildIndex].appendChild(tok);
  }.bind(this));

  this.state = _.LOOKING_FOR_COMMENT;
}

Parser.prototype.parseProtoTypeToken = function(token){
  var tokens = [];
  var data = token.data.content;
  var tokenizer;
  var lastChildIndex = this.tokenTree.root.children.length - 1;
  do{
    tokenizer = _.PROTO_TYPE.exec(data);
    if(tokenizer){
      tokens.push(new Token(tokenizer[3], tokenizer[2]));
    }
  }while(tokenizer);
  tokens.map(function(tok){
    this.tokenTree.root.children[lastChildIndex].appendChild(tok);
  }.bind(this));

  this.state = _.LOOKING_FOR_COMMENT;
}

Parser.prototype.resetRegex = function () {
  _.DATA_TYPES.lastIndex = 0;
  _.PROTO_TYPE.lastIndex = 0;
  _.TAGFORMAT.lastIndex = 0;
  _.EXTRACT_PROPERTY.lastIndex = 0;
  _.EXTRACT_DESC.lastIndex = 0;
  _.EXTRACT_TYPE.lastIndex = 0;
  _.EXTRACT_NAME.lastIndex = 0;
}

module.exports = Parser;
