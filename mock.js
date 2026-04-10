var document = { 
  getElementById: function(){ return {}; }, 
  querySelector: function(){}, 
  createElement: function(){ return { setAttribute: function(){}, appendChild: function(){} }; }, 
  body: { appendChild: function(){} } 
};
var window = { 
  location: { search: '', origin: '', href: '' }, 
  addEventListener: function() {}, 
  history: { replaceState: function(){} } 
};
var URLSearchParams = function(){ this.has = function(){ return false; }; this.get = function(){}; this.toString = function(){ return ""; }; };
var localStorage = { getItem: function(){ return null; }, setItem: function(){}, removeItem: function(){} };
var console = { log: function(){}, error: function(){} };
var location = { hash: "" };
var fetch = function(){};
var navigator = { mediaDevices: null };
var Math = globalThis.Math;
var Date = globalThis.Date;
