// File: app/index.js (New)
// https://xkcd.com/221/
function getRandomNumber()
{
  return 4; // chosen by fair dice roll. 
            // guaranteed to be random.
}

const djia = require('djia').default;
const md5 = require('md5');

// https://stackoverflow.com/a/5055821/78025
const hex2dec = (hex) => {
  hex = hex.split(/\./);
  var len = hex[1].length;
  hex[1] = parseInt(hex[1], 16);
  hex[1] *= Math.pow(16, -len);
  return parseInt(hex[0], 16) + hex[1];
}

// djia callback converts to async
const asyncDjia = async (date) => {
  return new Promise((resolve, error)  => {
    djia(date, (err, value) => {
      if (value) resolve(value);
      error(err)
    })
  })
}

// https://xkcd.com/426/
const geohash = async (date) => {
  const opening = await asyncDjia(date);
  const hash = md5(`${date}-${opening}`);
  const latOffset = hex2dec(`0.${hash.substr(0,16)}`);
  const lonOffset = hex2dec(`0.${hash.substr(16)}`);
  return {opening, hash, latOffset, lonOffset};
};

exports.handler =  async function(event, context) {
  // Add new path to handle
  // URL: /geohash/{date}
  if (event.rawPath.startsWith("/geohash/")) return geohash(event.pathParameters.date);

  if (event.rawPath == "/rolldice") return handleRollDice();
  return { statusCode: 500, body: "Unknown request" };
}
