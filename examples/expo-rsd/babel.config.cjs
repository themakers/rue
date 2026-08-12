const strictDOM = require('react-strict-dom/babel-preset')

module.exports = function (api) {
  const platform = api.caller((caller) => caller?.platform)
  const dev = api.caller((caller) => caller?.isDev ?? process.env.NODE_ENV === 'development')

  return {
    presets: ['babel-preset-expo', [strictDOM, { platform, dev, debug: dev }]],
  }
}
